# Event horizon

Undertone-specific integration of the verified VGPU **Optimized Black Hole**
example, retained as a new selectable scene rather than replacing Energy Orbit.

## Provenance

The complete 14-file example was retrieved with the official VGPU examples tool.
Upstream immutable revision:
`6fa27bb458ffc3f498727090f09dce3fe5faabb43689fd669d633a2a23dc36bb`.
Source aggregate SHA-256:
`71fbc607c2970a377c41d454a02fd632e8b81754c89f44948451cf4e2e653ed3`.
The supplied ZIP is the user's reference. Dependency license is retained in
`vendor/LICENSE.vgpu`; no third-party imagery or audio was added.

## Adaptation

The geodesic bake, refinement, noise volume, disk shading, stars and multi-level
bloom retain the example architecture. Camera geometry is rebaked only on size
changes; color and time changes reuse it. The original final pass desaturated its
output. Our composite maps luminous material to the selected Undertone palette
while preserving zero-light black pixels. Graphite is multicolored; other palettes
retain their established character. Disk speed is 1.05 (stock 0.75), and cloud speed
is 0.52 (stock 0.30), additionally driven by Undertone's shared motion clock.

`renderer.ts` adapts ownership to the existing app: no second RAF, timer or audio
loop. `visuals.js` supplies viewport, time, seed, motion, brightness and palette.
Reduced motion and blackout use the same app boundary. The adapter bounds its
render targets, preserves aspect and centers the scene on phone/tablet/desktop.
The bridge cancels pending initialization and restores Canvas after errors/device
loss. GPU targets, noise volume, device/surface and pointer listeners are disposed.
A small backing keeps the headphone guidance legible over the luminous disk; the
bridge restores the previous inline style on scene exit.

## Build and proof

`mise run build:gpu`, `mise run ci`, `mise run vgpu:ci`, and `mise run e2e:ci`.
GPU bundles are generated before offline-shell tests. A plain unbuilt source
checkout is not the release artifact; Vercel builds the runtime-only `dist` tree.
The example's React host is retained for provenance, not loaded into Undertone.
Use the main app's scene picker to exercise the adapter.

Tests cover shader compilation, actual browser GPU output, motion pause, resize,
scene switching, late initialization cleanup, fallback, and shared clock inputs.
CI software rendering is functional proof, not measured hardware/mobile FPS.
Visual styling remains subject to the user's review.
