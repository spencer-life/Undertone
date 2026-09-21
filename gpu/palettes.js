/* Scene radiance colors. Values above 1.0 are tone-mapped inside the
   single procedural fragment pass; this prototype has no bloom pass. */
export const ORBIT_PALETTES = Object.freeze({
  noir: {
    background: [0.003, 0.004, 0.007], low: [0.035, 0.045, 0.070],
    primary: [0.55, 0.68, 0.86], secondary: [0.72, 0.78, 1.05], highlight: [1.35, 1.42, 1.55],
  },
  slate: {
    background: [0.004, 0.009, 0.018], low: [0.025, 0.080, 0.165],
    primary: [0.18, 0.48, 1.05], secondary: [0.37, 0.73, 1.30], highlight: [0.82, 1.13, 1.52],
  },
  frost: {
    background: [0.004, 0.012, 0.015], low: [0.020, 0.120, 0.135],
    primary: [0.16, 0.80, 0.84], secondary: [0.50, 1.08, 1.03], highlight: [1.05, 1.50, 1.42],
  },
  rose: {
    background: [0.010, 0.004, 0.010], low: [0.155, 0.025, 0.100],
    primary: [1.15, 0.16, 0.62], secondary: [0.72, 0.20, 1.15], highlight: [1.52, 0.66, 1.12],
  },
  ocean: {
    background: [0.002, 0.009, 0.015], low: [0.010, 0.100, 0.180],
    primary: [0.00, 0.70, 1.28], secondary: [0.00, 1.16, 1.08], highlight: [0.68, 1.55, 1.48],
  },
  moss: {
    background: [0.004, 0.012, 0.008], low: [0.020, 0.135, 0.075],
    primary: [0.05, 0.80, 0.42], secondary: [0.30, 1.18, 0.66], highlight: [0.93, 1.52, 1.05],
  },
  ember: {
    background: [0.014, 0.005, 0.003], low: [0.190, 0.045, 0.018],
    primary: [1.28, 0.21, 0.08], secondary: [1.40, 0.60, 0.10], highlight: [1.65, 1.02, 0.42],
  },
  violet: {
    background: [0.006, 0.003, 0.020], low: [0.070, 0.025, 0.185],
    primary: [0.12, 0.38, 1.40], secondary: [0.88, 0.16, 1.30], highlight: [1.50, 0.48, 1.15],
  },
  mono: {
    background: [0.006, 0.006, 0.007], low: [0.050, 0.050, 0.060],
    primary: [0.47, 0.48, 0.53], secondary: [0.72, 0.70, 0.75], highlight: [1.30, 1.26, 1.18],
  },
});

export function orbitPalette(theme) {
  return ORBIT_PALETTES[theme] || ORBIT_PALETTES.ocean;
}
