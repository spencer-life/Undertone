# Energy Orbit GPU renderer

`createOrbitRenderer(canvas, { onFailure })` is an optional vgpu/WebGPU path for
Energy Orbit. The app owns its animation loop and calls `draw(settings)`; this
module owns only the device, surface, shader, and their cleanup.

The scene is entirely procedural. Four coherent warped ribbons carry parallel
filaments, luminous ridges, independently timed highlights, and sparse motes.
The fragment shader tone maps directly into the canvas in one fullscreen pass.
`eco` remains part of the draw contract so the app can throttle frame cadence;
this first GPU slice intentionally does not add a second render target.

If creation, submission, or the device fails, the caller should keep using the
existing Canvas 2D orbit. `dispose()` is idempotent and the module has no event
listeners or animation callbacks of its own.
