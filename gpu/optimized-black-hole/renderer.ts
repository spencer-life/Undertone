// Browser lifecycle for the baked black-hole pipeline. VGPU stays dynamically imported.

import type { Frame, Gpu, Surface } from "vgpu";

type VgpuApi = typeof import("vgpu");

import {
  createEffects,
  createTargets,
  destroyTargets,
  prewarm,
  renderChain,
  setBakeUniforms,
  setBindings,
  setPostUniforms,
  setShadeUniforms,
  type Effects,
  type Targets,
} from "./pipeline";
import { defaultHeroSettings } from "./settings";

const SCENE_YAW_TAU_S = 0.325;

const MAX_FRAME_DT_S = 0.1;

const TARGET_FPS = 60;

const FRAME_PACING_EPSILON_MS = 2;

const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FPS - FRAME_PACING_EPSILON_MS;
const MOBILE_QUERY = "(max-width: 767px)";

interface RendererOptions {
  canvas: HTMLCanvasElement;
  onFailure?: (error: Error) => void;
}

type RenderSize = { width: number; height: number };
type RuntimeState = {
  motion: number;
  brightness: number;
  energy: number;
  reducedMotion: boolean;
  eco: boolean;
  paletteSignature: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number(value) || 0));

const hexToRgba = (value: string): [number, number, number, number] => {
  const match = /^#([0-9a-f]{6})$/i.exec(value || "");
  if (!match) return [0.5, 0.5, 0.5, 1];
  const n = Number.parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};

export function createRenderer({ canvas, onFailure }: RendererOptions) {
  const settings = defaultHeroSettings();
  const baseDiskBrightness = settings.disk.brightness;
  const baseStarBrightness = settings.stars.brightness;
  const runtime: RuntimeState = {
    motion: 60,
    brightness: 100,
    energy: 0,
    reducedMotion: false,
    eco: false,
    paletteSignature: "",
  };
  let postDirty = true;
  const desktopLayout = {
    centerX: settings.centerX,
    centerY: settings.centerY,
    cameraRoll: settings.cameraRoll,
    mouseYaw: settings.mouseYaw,
    centerFade: settings.centerFade,
  };
  const mobileQuery = window.matchMedia(MOBILE_QUERY);
  const applyResponsiveLayout = () => {
    Object.assign(
      settings,
      mobileQuery.matches
        ? {
            centerX: 0,
            centerY: 0,
            cameraRoll: 0,
            mouseYaw: 0,
            centerFade: 1,
          }
        : desktopLayout
    );
  };
  applyResponsiveLayout();
  const bloomScale = Math.min(Math.max(window.devicePixelRatio, 1), 2) / 2;
  settings.bloom.radius *= bloomScale;
  settings.bloom.strength *= bloomScale;

  let disposed = false;

  let api: VgpuApi | undefined;
  let gpu: Gpu | undefined;
  let surface: Surface | undefined;
  let effects: Effects | undefined;
  let targets: Targets | undefined;
  let loop: { stop(): void } | undefined;
  let observer: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let documentVisible =
    typeof document === "undefined" ? true : !document.hidden;
  let canvasIntersecting = true;

  let started = false;
  let animationTime = 0;
  let lastFrameAt: number | undefined;
  let resizeFrame = 0;
  let pendingSize: RenderSize | undefined;
  let forceBake = true;
  let pointerXNormalized = 0;
  let currentSceneYaw = 0;
  let lastYawAt: number | undefined;

  const onLayoutChange = () => {
    applyResponsiveLayout();
    forceBake = true;
  };
  mobileQuery.addEventListener("change", onLayoutChange);

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const width = Math.max(window.innerWidth, 1);
    pointerXNormalized = Math.min(
      1,
      Math.max(-1, (event.clientX / width) * 2 - 1)
    );
  };

  const recenterPointer = () => {
    pointerXNormalized = 0;
  };
  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget === null) recenterPointer();
  };
  const onVisibilityChange = () => {
    if (document.hidden) recenterPointer();
    documentVisible = !document.hidden;
    reconcileLoop();
  };

  function reconcileLoop(): void {
    if (!started || !gpu || !api) return;
    const shouldRun = !disposed && documentVisible && canvasIntersecting;
    if (shouldRun === Boolean(loop)) return;
    if (shouldRun) {
      lastFrameAt = undefined;
      lastYawAt = undefined;
      loop = startPacedLoop(api, gpu);
    } else {
      loop?.stop();
      loop = undefined;
    }
  }

  function startPacedLoop(vgpu: VgpuApi, activeGpu: Gpu): { stop(): void } {
    let stopped = false;

    let lastPresentedAt: number | undefined;
    const tick = (timestamp: number): void => {
      if (stopped) return;
      const targetFps = runtime.eco ? 30 : TARGET_FPS;
      const minimumFrameInterval = 1000 / targetFps - FRAME_PACING_EPSILON_MS;
      if (
        lastPresentedAt === undefined ||
        timestamp - lastPresentedAt >= minimumFrameInterval
      ) {
        lastPresentedAt = timestamp;
        try {
          vgpu.frame(activeGpu, renderFrame);
        } catch (error) {
          deliverFailure(error);
        }
      }
      if (!stopped) frameHandle = requestAnimationFrame(tick);
    };
    let frameHandle = requestAnimationFrame(tick);
    return {
      stop(): void {
        stopped = true;
        cancelAnimationFrame(frameHandle);
      },
    };
  }

  const advanceAnimationTime = (now: number): number => {
    const dt =
      lastFrameAt === undefined ? 0 : Math.max(0, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    const motion = clamp(runtime.motion / 100, 0, 1);
    const speed =
      runtime.reducedMotion || motion <= 0
        ? 0
        : 0.45 + 1.55 * Math.pow(motion, 1.18);
    animationTime += dt * speed * (1 + runtime.energy * 0.08);
    return animationTime;
  };

  const renderFrame = (frame: Frame): void => {
    if (disposed || !effects || !targets || !surface) return;
    const now = clockMs();
    const runBake = forceBake;
    forceBake = false;
    if (runBake) setBakeUniforms(effects, targets, settings);
    if (postDirty) {
      setPostUniforms(effects, targets, settings);
      postDirty = false;
    }
    const brightness = clamp(runtime.brightness / 100, 0.1, 1);
    settings.disk.brightness =
      baseDiskBrightness * (0.56 + brightness * 0.64) * (1 + runtime.energy * 0.10);
    settings.stars.brightness = baseStarBrightness * (0.48 + brightness * 0.52);
    setShadeUniforms(
      effects,
      targets,
      settings,
      advanceAnimationTime(now),
      advanceSceneYaw(now)
    );
    renderChain(frame, effects, targets, surface, runBake);
  };

  const advanceSceneYaw = (now: number): number => {
    if (settings.mouseYaw <= 0) {
      currentSceneYaw = 0;
      lastYawAt = now;
      return 0;
    }
    const dt =
      lastYawAt === undefined
        ? 0
        : Math.min(Math.max((now - lastYawAt) / 1000, 0), MAX_FRAME_DT_S);
    lastYawAt = now;
    const target = pointerXNormalized * Math.max(0, settings.mouseYaw);
    currentSceneYaw +=
      (target - currentSceneYaw) * (1 - Math.exp(-dt / SCENE_YAW_TAU_S));
    return currentSceneYaw;
  };

  const applyResize = () => {
    resizeFrame = 0;
    const size = pendingSize;
    pendingSize = undefined;
    if (disposed || !size || !gpu || !api || !effects || !targets || !surface)
      return;
    try {
      const previousTargets = targets;
      const nextTargets = createTargets(api, gpu, [
        Math.max(1, Math.round(size.width)),
        Math.max(1, Math.round(size.height)),
      ]);
      try {
        setBindings(effects, nextTargets);
        setPostUniforms(effects, nextTargets, settings);
        postDirty = false;
      } catch (error) {
        destroyTargets(nextTargets);
        throw error;
      }
      targets = nextTargets;
      destroyTargets(previousTargets);
      forceBake = true;
    } catch (error) {
      handleFailure(error);
    }
  };
  const resize = (size: RenderSize) => {
    if (disposed || size.width <= 0 || size.height <= 0) return;
    pendingSize = size;
    if (!resizeFrame) resizeFrame = requestAnimationFrame(applyResize);
  };

  const measure = () => {
    resize({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });
  };

  const update = ({
    motion,
    brightness,
    energy,
    reducedMotion,
    eco,
    palette,
  }: {
    motion?: number;
    brightness?: number;
    energy?: number;
    reducedMotion?: boolean;
    eco?: boolean;
    palette?: string[];
  } = {}) => {
    if (disposed) return false;
    if (motion !== undefined) runtime.motion = clamp(motion, 0, 100);
    if (brightness !== undefined) runtime.brightness = clamp(brightness, 10, 100);
    if (energy !== undefined) runtime.energy = clamp(energy, 0, 1);
    if (reducedMotion !== undefined) runtime.reducedMotion = Boolean(reducedMotion);
    if (eco !== undefined) runtime.eco = Boolean(eco);
    if (Array.isArray(palette) && palette.length) {
      const signature = palette.join("|");
      if (signature !== runtime.paletteSignature) {
        runtime.paletteSignature = signature;
        const pick = (index: number, fallback: string) =>
          hexToRgba(palette[Math.min(index, palette.length - 1)] || fallback);
        settings.palette.low = pick(1, "#173046");
        settings.palette.mid = pick(2, "#2f82bb");
        settings.palette.high = pick(3, "#ad68ca");
        settings.palette.accent = pick(4, "#efaa76");
        postDirty = true;
      }
    }
    return true;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loop?.stop();
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    observer?.disconnect();
    intersection?.disconnect();
    if (typeof window !== "undefined") {
      mobileQuery.removeEventListener("change", onLayoutChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", recenterPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    gpu?.dispose();
  };

  const initialize = async () => {
    const vgpu = await import("vgpu");
    const { init } = vgpu;
    if (disposed) return;
    const nextGpu = await init();
    if (disposed) {
      nextGpu.dispose();
      return;
    }
    gpu = nextGpu;
    api = vgpu;
    surface = vgpu.surface(gpu, canvas, { dpr: 1 });
    effects = createEffects(vgpu, gpu);
    targets = createTargets(vgpu, gpu, surface.size);
    setBakeUniforms(effects, targets, settings);
    setShadeUniforms(effects, targets, settings, animationTime, currentSceneYaw);
    setBindings(effects, targets);
    setPostUniforms(effects, targets, settings);
    await prewarm(effects, targets, surface);
    if (disposed) return;
    observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", recenterPointer);
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (typeof IntersectionObserver !== "undefined") {
      intersection = new IntersectionObserver(
        (entries) => {
          canvasIntersecting =
            entries[entries.length - 1]?.isIntersecting ?? canvasIntersecting;
          reconcileLoop();
        },
        { threshold: 0 }
      );
      intersection.observe(canvas);
    }
    measure();
    started = true;
    documentVisible = !document.hidden;
    reconcileLoop();
  };

  function deliverFailure(error: unknown): Error {
    const resolved =
      error instanceof Error ? error : new Error(String(error || "Unknown WebGPU error"));
    dispose();
    try {
      onFailure?.(resolved);
    } catch {}
    return resolved;
  }

  const ready = initialize().catch((error: unknown) => {
    if (disposed) return;
    throw deliverFailure(error);
  });

  return { ready, update, dispose };
}

export function createBlackHoleRenderer(
  canvas: HTMLCanvasElement,
  options: { onFailure?: (error: Error) => void } = {}
) {
  return createRenderer({ canvas, onFailure: options.onFailure });
}

function clockMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}