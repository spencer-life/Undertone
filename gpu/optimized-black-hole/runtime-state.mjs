// Undertone-specific frame policy, shared by the adapter and deterministic tests.
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export function blackHoleTime(time, previousMs, nowMs, motion, reducedMotion) {
  const dt = previousMs === null ? 0 : Math.min(0.1, Math.max(0, (nowMs - previousMs) / 1000));
  const amount = Math.min(1, Math.max(0, finite(motion, 60) / 100));
  return time + (reducedMotion || amount === 0 ? 0 : dt * (0.25 + 2.75 * amount ** 1.2));
}
export function blackHoleViewport(width, height, eco = false) {
  const w = Math.max(1, finite(width, 1)), h = Math.max(1, finite(height, 1));
  const scale = Math.min(1, 1280 / w, 1080 / h, Math.sqrt(921600 / (w * h))) * (eco ? 0.7 : 1);
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}
export function blackHoleLayout(width, height) {
  const aspect = Math.max(0.1, width / Math.max(1, height));
  return { centerX: 0, centerY: 0.14, cameraRoll: -0.16, mouseYaw: 0.12,
    centerFade: 0, fov: 2.45 * Math.min(1, aspect * 1.6) };
}
export function paletteColor(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value || '');
  if (!match) return [0.5, 0.5, 0.5, 1];
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
}
