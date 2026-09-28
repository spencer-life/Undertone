// Adapted from the verified Optimized Black Hole pipeline.
// Undertone owns the animation loop, visibility, reduced motion and resize invalidation.
// This adapter owns only GPU resources and submits frames requested by that loop.
import type { Gpu, Surface } from 'vgpu';
import { createEffects, createTargets, destroyTargets, prewarm, renderChain,
  setBakeUniforms, setBindings, setPostUniforms, setShadeUniforms,
  type Effects, type Targets } from './pipeline';
import { defaultHeroSettings } from './settings';
import { blackHoleTime, blackHoleViewport, blackHoleLayout, paletteColor } from './runtime-state.mjs';

type Api = typeof import('vgpu');
type Options = { onFailure?: (error: Error) => void };
type Parameters = { width?: number; height?: number; time?: number; seed?: number;
  motion?: number; brightness?: number; energy?: number; reducedMotion?: boolean;
  eco?: boolean; palette?: string[] };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Number(value) || 0));

export function createBlackHoleRenderer(canvas: HTMLCanvasElement, { onFailure }: Options = {}) {
  const settings = defaultHeroSettings();
  const baseDiskBrightness = settings.disk.brightness;
  const baseStars = settings.stars.brightness;
  let api: Api | undefined, gpu: Gpu | undefined, surface: Surface | undefined;
  let effects: Effects | undefined, targets: Targets | undefined;
  let disposed = false, initialized = false, failed = false;
  let forceBake = true, paletteSignature = '', postDirty = true;
  let animationTime = 0, previousMs: number | null = null, yaw = 0, pointer = 0;
  let previousSeed = 604;
  const stats = { frameCount: 0, bakeCount: 0, width: 1, height: 1, time: 0, lastError: null as string | null };
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') pointer = clamp(event.clientX / Math.max(1, window.innerWidth) * 2 - 1, -1, 1);
  };
  const recenter = () => { pointer = 0; };

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('blur', recenter);
    // Attempt every cleanup even if an already-lost device rejects one operation.
    try { if (targets) destroyTargets(targets); } catch {}
    try { effects?.noiseVolume.destroy(); } catch {}
    try { surface?.dispose(); } catch {}
    try { gpu?.dispose(); } catch {}
    targets = undefined; effects = undefined; surface = undefined; gpu = undefined;
  }
  function fail(reason: unknown) {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (failed || disposed) return error;
    failed = true; stats.lastError = error.message; dispose();
    try { onFailure?.(error); } catch {}
    return error;
  }
  const ready = (async () => {
    const nextApi = await import('vgpu');
    if (disposed) return;
    const nextGpu = await nextApi.init({ powerPreference: 'low-power' });
    if (disposed) { nextGpu.dispose(); return; }
    api = nextApi; gpu = nextGpu;
    surface = api.surface(gpu, canvas, { autoResize: false, size: [1, 1], alphaMode: 'opaque' });
    effects = createEffects(api, gpu);
    targets = createTargets(api, gpu, [1, 1]);
    Object.assign(settings, blackHoleLayout(1, 1));
    // The first uniform write must be complete. Binding setup sends partial
    // resolution updates and is valid only after these structs are initialized.
    setBakeUniforms(effects, targets, settings);
    setShadeUniforms(effects, targets, settings, 0, 0);
    setBindings(effects, targets);
    setPostUniforms(effects, targets, settings);
    await prewarm(effects, targets, surface);
    if (disposed) return;
    await gpu.settled();
    if (disposed) return;
    gpu.onError(fail);
    gpu.gpu.lost.then(info => { if (!disposed) fail(new Error(`Event horizon device lost: ${info.message || info.reason}`)); });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('blur', recenter);
    initialized = true;
  })().catch(error => { if (!disposed) throw fail(error); });

  function update(parameters: Parameters = {}) {
    if (!initialized || disposed || !api || !gpu || !surface || !effects || !targets) return false;
    try {
      const box = canvas.parentElement?.getBoundingClientRect();
      const width = Math.max(1, Number(parameters.width) || box?.width || 1);
      const height = Math.max(1, Number(parameters.height) || box?.height || 1);
      const size = blackHoleViewport(width, height, parameters.eco);
      if (size[0] !== targets.scene.size[0] || size[1] !== targets.scene.size[1]) {
        const next = createTargets(api, gpu, size);
        try { setBindings(effects, next); surface.resize(size); }
        catch (error) { destroyTargets(next); throw error; }
        const previous = targets; targets = next; destroyTargets(previous);
        Object.assign(settings, blackHoleLayout(width, height));
        forceBake = true; postDirty = true;
      }
      const now = performance.now();
      const still = Boolean(parameters.reducedMotion) || parameters.motion === 0;
      if (!still && Number.isFinite(parameters.time)) animationTime = parameters.time!;
      else animationTime = blackHoleTime(animationTime, previousMs, now, parameters.motion ?? 60, still);
      previousMs = now;
      const energy = still ? 0 : clamp(parameters.energy ?? 0, 0, 1);
      if (!still) yaw += (pointer * settings.mouseYaw - yaw) * 0.09;
      const seed = Number(parameters.seed) || 604;
      if (seed !== previousSeed) { previousSeed = seed; yaw = 0; }
      const palette = parameters.palette;
      if (Array.isArray(palette) && palette.length >= 4) {
        const signature = palette.join('|');
        if (signature !== paletteSignature) {
          paletteSignature = signature;
          settings.palette.low = paletteColor(palette[1]);
          settings.palette.mid = paletteColor(palette[2]);
          settings.palette.high = paletteColor(palette[3]);
          settings.palette.accent = paletteColor(palette[Math.min(4, palette.length - 1)]);
          postDirty = true;
        }
      }
      const brightness = clamp(parameters.brightness ?? 100, 10, 100) / 100;
      settings.disk.brightness = baseDiskBrightness * brightness * (1 + energy * 0.1);
      settings.stars.brightness = baseStars * brightness;
      if (forceBake) setBakeUniforms(effects, targets, settings);
      if (postDirty) { setPostUniforms(effects, targets, settings); postDirty = false; }
      setShadeUniforms(effects, targets, settings, animationTime + seed * 0.031, yaw);
      const bake = forceBake;
      api.frame(gpu, frame => renderChain(frame, effects!, targets!, surface!, bake));
      forceBake = false;
      stats.frameCount++; if (bake) stats.bakeCount++;
      stats.width = size[0]; stats.height = size[1]; stats.time = animationTime;
      canvas.dataset.frameCount = String(stats.frameCount);
      canvas.dataset.bakeCount = String(stats.bakeCount);
      canvas.dataset.animationTime = String(stats.time);
      return true;
    } catch (error) { fail(error); return false; }
  }
  return { ready, update, dispose, stats };
}

export function createRenderer({ canvas, onFailure }: { canvas: HTMLCanvasElement } & Options) {
  return createBlackHoleRenderer(canvas, { onFailure });
}
