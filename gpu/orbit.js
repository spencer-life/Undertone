import { effect, frame, init, surface } from 'vgpu';
import { orbitPalette } from './palettes.js';
import ORBIT_SHADER from './orbit.wgsl';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const rgba = (rgb) => [rgb[0], rgb[1], rgb[2], 1];

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
    backend: 'WebGPU · vgpu',
    frameCount: 0,
    width: 1,
    height: 1,
    dpr: 1,
    lastSubmitMs: 0,
    averageSubmitMs: 0,
    lastError: null,
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
      autoResize: false,
      size: [1, 1],
      alphaMode: 'opaque',
      label: 'undertone-orbit-surface',
    });
    const initialPalette = orbitPalette('ocean');
    const orbitEffect = effect(gpu, ORBIT_SHADER, {
      label: 'undertone-orbit-scene',
      set: {
        params: {
          viewport: [1, 1, 1, 1], dynamics: [0, 604, 0.8, 0],
          background: rgba(initialPalette.background), low: rgba(initialPalette.low),
          primary: rgba(initialPalette.primary), secondary: rgba(initialPalette.secondary),
          highlight: rgba(initialPalette.highlight),
        },
      },
    });
    await orbitEffect.compile({ colors: [canvasSurface.format], sampleCount: 1 });
    await gpu.settled();

    gpu.onError((error) => fail(error));
    gpu.gpu.lost.then((info) => {
      if (!disposed) fail(new Error(`WebGPU device lost: ${info?.message || info?.reason || 'unknown reason'}`));
    });

    const draw = ({ width, height, dpr = 1, time = 0, seed = 604, theme = 'ocean', brightness = 80, eco = false, energy = 0 } = {}) => {
      if (disposed) return false;
      const started = performance.now();
      try {
        const requestedWidth = Math.max(1, Number(width) || 1);
        const requestedHeight = Math.max(1, Number(height) || 1);
        const safeDpr = clamp(dpr, 0.5, 1.5);
        const renderScale = Math.min(safeDpr, 4096 / requestedWidth, 4096 / requestedHeight);
        const pixelWidth = Math.max(1, Math.round(requestedWidth * renderScale));
        const pixelHeight = Math.max(1, Math.round(requestedHeight * renderScale));
        if (canvasSurface.size[0] !== pixelWidth || canvasSurface.size[1] !== pixelHeight) {
          canvasSurface.resize([pixelWidth, pixelHeight]);
        }

        const palette = orbitPalette(theme);
        orbitEffect.set({ params: {
          viewport: [pixelWidth, pixelHeight, pixelWidth / pixelHeight, renderScale],
          dynamics: [Number(time) || 0, Number(seed) || 0, clamp(brightness, 10, 100) / 100, clamp(energy, 0, 1)],
          background: rgba(palette.background), low: rgba(palette.low),
          primary: rgba(palette.primary), secondary: rgba(palette.secondary),
          highlight: rgba(palette.highlight),
        } });
        frame(gpu, currentFrame=>currentFrame.pass(canvasSurface, orbitEffect));

        const elapsed = performance.now() - started;
        stats.frameCount += 1;
        stats.width = pixelWidth;
        stats.height = pixelHeight;
        stats.dpr = renderScale;
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
