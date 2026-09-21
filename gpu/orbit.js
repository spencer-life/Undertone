import { effect, frame, init, sampler, surface, target } from 'vgpu';
import { orbitPalette } from './palettes.js';
import ORBIT_SHADER from './orbit.wgsl';
import BRIGHT_SHADER from './orbit-bright.wgsl';
import BLUR_SHADER from './orbit-blur.wgsl';
import POST_SHADER from './orbit-post.wgsl';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const rgba = (rgb) => [rgb[0], rgb[1], rgb[2], 1];
const BLURS = [
  { direction: [1, 0], radius: 1 },
  { direction: [0, 1], radius: 1 },
  { direction: [1, 0], radius: 2.25 },
  { direction: [0, 1], radius: 2.25 },
];

/**
 * Creates the optional Energy Orbit GPU renderer. The caller owns scheduling;
 * this module never creates an animation loop or DOM listener.
 */
export async function createOrbitRenderer(canvas, { onFailure } = {}) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new TypeError('createOrbitRenderer requires a canvas');
  }

  const gpu = await init({ powerPreference: 'low-power' });
  let canvasSurface;
  let disposed = false;
  let failureDelivered = false;

  const stats = {
    backend: 'WebGPU · vgpu', frameCount: 0, width: 1, height: 1, dpr: 1,
    lastSubmitMs: 0, averageSubmitMs: 0, lastError: null,
  };

  const disposeResources = () => {
    if (disposed) return;
    disposed = true;
    try { canvasSurface?.dispose?.(); } catch {}
    try { gpu.dispose(); } catch {}
  };

  const fail = (reason) => {
    if (failureDelivered || disposed) return;
    failureDelivered = true;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    stats.lastError = error.message;
    disposeResources();
    try { onFailure?.(error); } catch {}
  };

  try {
    canvasSurface = surface(gpu, canvas, {
      autoResize: false, size: [1, 1], alphaMode: 'opaque', label: 'undertone-orbit-surface',
    });
    const sceneTarget = target(gpu, { size: [1, 1], format: 'rgba16float', label: 'undertone-orbit-hdr' });
    const bloomTargets = [
      target(gpu, { size: [1, 1], format: 'rgba16float', label: 'undertone-orbit-bloom-a' }),
      target(gpu, { size: [1, 1], format: 'rgba16float', label: 'undertone-orbit-bloom-b' }),
    ];
    const linearSampler = sampler(gpu, { minFilter: 'linear', magFilter: 'linear' });
    const initialPalette = orbitPalette('ocean');
    const orbitEffect = effect(gpu, ORBIT_SHADER, {
      label: 'undertone-orbit-scene',
      set: { params: {
        viewport: [1, 1, 1, 1], dynamics: [0, 604, 0.8, 0],
        background: rgba(initialPalette.background), low: rgba(initialPalette.low),
        primary: rgba(initialPalette.primary), secondary: rgba(initialPalette.secondary),
        highlight: rgba(initialPalette.highlight),
      } },
    });
    const brightEffect = effect(gpu, BRIGHT_SHADER, {
      label: 'undertone-orbit-bright', set: { src: sceneTarget, samp: linearSampler },
    });
    const blurEffects = BLURS.map((options, index) => effect(gpu, BLUR_SHADER, {
      label: `undertone-orbit-blur-${index}`,
      set: { src: bloomTargets[index % 2], samp: linearSampler, blur: { texelSize: [1, 1], ...options } },
    }));
    const postEffect = effect(gpu, POST_SHADER, {
      label: 'undertone-orbit-post',
      set: {
        src: sceneTarget, bloom: bloomTargets[0], samp: linearSampler,
        post: { center: [0.5, 0.43], bloomStrength: 0.64, pad: 0 },
      },
    });

    await Promise.all([
      orbitEffect.compile(sceneTarget), brightEffect.compile(bloomTargets[0]),
      ...blurEffects.map((blur, index) => blur.compile(bloomTargets[(index + 1) % 2])),
      postEffect.compile({ colors: [canvasSurface.format], sampleCount: 1 }),
    ]);
    await gpu.settled();

    gpu.onError((error) => fail(error));
    gpu.gpu.lost.then((info) => {
      if (!disposed) fail(new Error(`WebGPU device lost: ${info?.message || info?.reason || 'unknown reason'}`));
    });

    const resize = (pixelWidth, pixelHeight) => {
      if (canvasSurface.size[0] === pixelWidth && canvasSurface.size[1] === pixelHeight) return;
      canvasSurface.resize([pixelWidth, pixelHeight]);
      sceneTarget.resize([pixelWidth, pixelHeight]);
      const bloomHeight = Math.max(1, Math.min(320, pixelHeight));
      const bloomSize = [Math.max(1, Math.round(bloomHeight * pixelWidth / pixelHeight)), bloomHeight];
      bloomTargets[0].resize(bloomSize);
      bloomTargets[1].resize(bloomSize);
      blurEffects.forEach((blur, index) => blur.set({
        src: bloomTargets[index % 2],
        blur: { texelSize: bloomTargets[index % 2].texelSize, ...BLURS[index] },
      }));
    };

    const draw = ({ width, height, dpr = 1, time = 0, seed = 604, theme = 'ocean', brightness = 80, energy = 0 } = {}) => {
      if (disposed) return false;
      const started = performance.now();
      try {
        const requestedWidth = Math.max(1, Number(width) || 1);
        const requestedHeight = Math.max(1, Number(height) || 1);
        const safeDpr = clamp(dpr, 0.5, 1.5);
        const renderScale = Math.min(safeDpr, 4096 / requestedWidth, 4096 / requestedHeight);
        const pixelWidth = Math.max(1, Math.round(requestedWidth * renderScale));
        const pixelHeight = Math.max(1, Math.round(requestedHeight * renderScale));
        resize(pixelWidth, pixelHeight);

        const palette = orbitPalette(theme);
        orbitEffect.set({ params: {
          viewport: [pixelWidth, pixelHeight, pixelWidth / pixelHeight, renderScale],
          dynamics: [Number(time) || 0, Number(seed) || 0, clamp(brightness, 10, 100) / 100, clamp(energy, 0, 1)],
          background: rgba(palette.background), low: rgba(palette.low),
          primary: rgba(palette.primary), secondary: rgba(palette.secondary), highlight: rgba(palette.highlight),
        } });

        frame(gpu, (currentFrame) => {
          currentFrame.pass(sceneTarget, orbitEffect);
          currentFrame.pass(bloomTargets[0], brightEffect);
          blurEffects.forEach((blur, index) => currentFrame.pass(bloomTargets[(index + 1) % 2], blur));
          currentFrame.pass(canvasSurface, postEffect);
        });

        const elapsed = performance.now() - started;
        stats.frameCount += 1; stats.width = pixelWidth; stats.height = pixelHeight; stats.dpr = renderScale;
        stats.lastSubmitMs = elapsed;
        stats.averageSubmitMs += (elapsed - stats.averageSubmitMs) / Math.min(stats.frameCount, 120);
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    };

    return { draw, dispose: disposeResources, stats };
  } catch (error) {
    disposeResources();
    throw error;
  }
}
