# Undertone GPU scenes

Energy Orbit and Event horizon use WebGPU when available, with Canvas fallbacks.
The app owns the frame loop, timing, settings, reduced motion and visibility.
The scene bridges own lazy initialization and teardown; scene modules own GPU
resources. Neither GPU renderer installs another animation loop.

Energy Orbit lives in `orbit.js` and `orbit*.wgsl`: folded three-dimensional
translucent sheets, front-to-back transmission, normal lighting and the seven-pass
HDR/selective-bloom chain. Palettes retain equal geometry scale. Full-screen pixel
cost is capped by `render-budget.mjs` independently of CSS layout.

Event horizon lives in `optimized-black-hole/`; its README records the verified
example source, project adaptations and lifetime contract.

Use `mise run build:gpu` to regenerate `vendor/energy-orbit.js` and
`vendor/black-hole.js`, `mise run ci` for normal validation, and `mise run vgpu:ci`
for device-backed checks and real browser captures. Do not hand-edit bundles.
Historical pass-three through pass-seven records are provenance, not a replacement
for the current source or user approvals. See `docs/orbit-volume-pass.md`.
