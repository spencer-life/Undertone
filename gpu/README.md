# Energy Orbit GPU renderer

`createOrbitRenderer(canvas, { onFailure })` is the opt-in vgpu/WebGPU path for Energy Orbit. The existing app owns the animation clock; this module owns GPU resources and cleanup.

The procedural scene renders into HDR, followed by bright extraction, four separable blur passes, and a final composite. Geometry and material source are in `orbit.wgsl`; bloom and display mapping are in the three `orbit-*.wgsl` post-processing files. Palette values are in `palettes.js`.

The second visual refinement is frozen for external review, not visually approved. See `../docs/energy-orbit-review-handoff.md` for the exact file map, current shortcomings, validation evidence and intended target. Rebuild `../vendor/energy-orbit.js` after source changes.
