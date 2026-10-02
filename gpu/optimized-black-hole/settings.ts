export interface DiskLook {
  brightness: number;
  speed: number;
  stretch: number;
  detail: number;
  turbulence: number;
  density: number;
  doppler: number;
  cloudScale: number;
  cloudSpeed: number;
  cloudStrength: number;
  spare0: number;
  spare1: number;
  spare2: number;
  spare3: number;
}

export interface StarLook {
  brightness: number;
  density: number;
  contrast: number;
  warmth: number;
  twinkle: number;
}

export interface BloomLook {
  strength: number;
  threshold: number;
  knee: number;
  radius: number;
}

export interface PaletteLook {
  low: [number, number, number, number];
  mid: [number, number, number, number];
  high: [number, number, number, number];
  accent: [number, number, number, number];
  strength: number;
}

export interface HeroSettings {
  cameraY: number;
  distance: number;
  diskRadius: number;
  fov: number;
  centerX: number;
  centerY: number;
  cameraRoll: number;
  mouseYaw: number;
  centerFade: number;
  bloom: BloomLook;
  disk: DiskLook;
  stars: StarLook;
  palette: PaletteLook;
}

/** Shared deterministic production defaults for the browser and headless renderer. */
export function defaultHeroSettings(): HeroSettings {
  return {
    cameraY: 0.16,
    distance: 13.5,
    diskRadius: 9,
    fov: 3,
    centerX: 0.8,
    centerY: 0.3,
    cameraRoll: -0.27,
    mouseYaw: 0.15,
    centerFade: 0,
    bloom: { strength: 1.06, threshold: 0, knee: 0.18, radius: 1.65 },
    disk: {
      brightness: 0.84,
      speed: 1.05,
      stretch: 5.75,
      detail: 3.44,
      turbulence: 4.46,
      density: 1.38,
      doppler: 1.21,
      cloudScale: 20,
      cloudSpeed: 0.52,
      cloudStrength: 0.24,
      spare0: 0.43,
      spare1: -0.25,
      spare2: -0.67,
      spare3: 0.69,
    },
    stars: { brightness: 0.86, density: 0.92, contrast: 13, warmth: 0.5, twinkle: 0.08 },
    palette: {
      low: [0.03, 0.12, 0.18, 1],
      mid: [0.16, 0.55, 0.92, 1],
      high: [0.72, 0.30, 0.88, 1],
      accent: [0.96, 0.58, 0.34, 1],
      strength: 0.94,
    },
  };
}