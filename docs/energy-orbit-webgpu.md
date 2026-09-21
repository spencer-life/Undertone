# Energy Orbit WebGPU experiment

Status: Energy Orbit art-direction pass with selective HDR bloom; still opt-in for visual review. This is scoped to Energy Orbit; Living Contours, Silk Drift, and Wet Glass continue to use Canvas 2D.

## Baseline and architecture

`visuals.js` owns all four scenes, their shared animation clock, deterministic variation seed, palette, 30 fps / 20 fps cap, 1.5 DPR cap, reduced-motion behavior, and hidden/blackout suspension. The baseline orbit is 68 warped Canvas paths plus four orbital paths, radial gradients, and traveling highlights.

The experimental renderer is isolated in `gpu/`. `orbit-bridge.js` lazily loads its checked-in browser bundle only when the opt-in `?renderer=webgpu` URL is used, Energy Orbit is selected, and WebGPU is exposed. It uses a separate canvas because an existing Canvas 2D context cannot be converted into a WebGPU context. The existing scene clock drives both paths. Application state, controls, WebMCP, audio, and other scenes do not acquire a second animation loop or depend on vgpu.

The normal URL and `/?renderer=canvas` use the original renderer for comparison without changing saved settings. Unsupported adapters, initialization failures, rendering errors, and device loss retain or restore Canvas. Changing away from Energy Orbit disposes GPU resources; stale asynchronous initialization is disposed before it can become visible. Page exit releases the device; a BFCache restore lazily recreates it.

The palette table written during initial setup retains existing theme IDs with semantic scene colors: background, low accent, primary accent, secondary accent, and highlight. Deep ocean now spans blue, indigo, violet, teal, and cyan across the structure. Night violet retains an Aurora emphasis.

## Official agent tooling

Installed the official `vgpu` skill from `vercel-labs/vgpu` using the existing mise-managed Skills CLI. The project copy is `.agents/skills/vgpu/SKILL.md`; `skills-lock.json` records its source and hash. It has been read and applied in this task.

The npm registry returns 404 for `@vgpu/cli`. The public `vgpu@0.5.0` package provides the official `vgpu` executable. It is installed through mise and pinned in `mise.toml` / `mise.lock`. The project-local dependency resolves the same version, so these commands read the correct bundled documentation without downloading another version:

```sh
mise exec -- vgpu --version
pnpm exec vgpu docs cat getting-started.md
pnpm exec vgpu docs cat shader-workflow.md
pnpm exec vgpu docs cat concepts-effects.md
pnpm exec vgpu examples search orbit
pnpm exec vgpu examples search bloom
pnpm exec vgpu examples search procedural
pnpm exec vgpu examples search noise
pnpm exec vgpu examples pull particle-orbit --out /tmp/undertone-official-particle-orbit
pnpm exec vgpu examples pull earth --out /tmp/undertone-official-earth
pnpm exec vgpu doctor --pretty
pnpm exec vgpu check gpu/orbit.wgsl --require-validation
```

Examples were pulled through the official CLI catalog at revision `b2ead042bd585babc1555dfdba2f31d5b23d5dd7a0c11360f0075b4aebd5ab03`, not by fetching individual GitHub files. Particle Orbit supplies relevant procedural backdrop and lifecycle patterns; its HDR-target and reduced-resolution bloom patterns inform this refinement. Its compute simulation, radiance cascades, and CRT remain out of scope. Earth supplies a reference for selective edge lighting. The bundled simplex-noise guide was also reviewed; independent trigonometric deformation is sufficient for this bounded first pass.

`vgpu doctor` returned **healthy**, rendering and reading back a 16×16 target on llvmpipe. `vgpu check` already supplies WGSL validation, so a separate direct `@vgpu/wgsl` dependency is unnecessary.

## Dependencies and reproducible build

The site still runs as static files without a server-side build. Changes to the GPU source require:

```sh
pnpm install --frozen-lockfile
pnpm build:orbit
pnpm check
pnpm test
```

Development dependencies are pinned to vgpu 0.5.0 and esbuild 0.25.12. Only the tree-shaken browser bundle is served. Native Node adapter installation scripts are disabled; the production browser does not load the CLI, MCP server, Node adapter, React, or Anime.js. The vgpu MIT license is retained beside the bundle.

## Test environment

On 2026-09-21 the Codex in-app browser exposed `navigator.gpu` but returned no adapter for default, low-power, high-performance, or forced-fallback requests. That browser can validate the normal Canvas fallback, but cannot validate WebGPU visual output.

Following the official Agent Browser WebGPU guide, a dedicated **headed** Chromium 149 session using Agent Browser 0.38.1 and SwiftShader returned working adapters for all four requests. The local dashboard at `http://localhost:4848` streams this browser into the desktop app. It does not add WebGPU support to the in-app browser itself.

The normal automatic virtual-display launch did not work in this environment. A task-local Xvfb process using an abstract local socket (`-nolisten tcp -nolisten unix`) allowed headed capture without changing machine configuration. No physical GPU is exposed here. Browser timings therefore describe software rendering and cannot establish hardware GPU performance or utilization.

The standalone `tests/gpu-probe.html` performs adapter/device acquisition, reports results visibly, and destroys each temporary device. A separate temporary vgpu/node check also rendered WGSL via Mesa llvmpipe; it is not a production dependency or browser performance result.

## Official references

- [Browser setup and fullscreen effect API](https://vgpu.sh/docs/get-started/web)
- [Particle Orbit](https://vgpu.sh/examples/particle-orbit): HDR intermediate targets, reduced-resolution bloom, resize and resource handling. Compute-based particle simulation is not required for this experiment.
- [Earth](https://vgpu.sh/examples/earth): atmosphere and edge-lighting direction.
- [FFT Ocean](https://vgpu.sh/examples/fft-ocean): evaluated as an example of continuous shader-driven movement; a fluid simulation would add unnecessary scope here.
- [Agent Browser WebGPU screenshots](https://vgpu.sh/docs/guides/agent-browser-webgpu): headed SwiftShader capture, pixel checks, and software-rendering caveats.

## Evaluation record

The active GPU path renders procedural fabric layers into an rgba16float HDR target. A soft-threshold bright pass and four separable blur passes run on reduced-resolution targets; the final pass combines that light with the crisp scene and tone maps into the surface. There are seven passes in one frame submission, no compute simulation, and no third-party raster assets. Motion comes from the existing application clock and independent shader periods. The browser path uses the documented `frame(gpu, callback)` / `frame.pass(surface, effect)` form. In vgpu 0.5.0, the one-shot surface draw/prewarm examples did not work in this test; compiling a format signature and submitting through an explicit frame did.

Evidence from the initial single-pass prototype (historical, before the refinement below):

- Official `vgpu check gpu/orbit.wgsl --require-validation`: device-backed validation attempted and passed, zero diagnostics.
- Node render at 720×480 on llvmpipe: identical time/seed gives byte-identical frames. Advancing scene time by 25 seconds changes RGB values by a mean 2.51/255; 3.43% of pixels exceed 60/255 in at least one channel. This proves visible geometry and movement, not cross-device pixel identity.
- Headed Chromium: `data-renderer=webgpu`, actual procedural pixels inspected in the app at desktop and 320px mobile widths. Portrait geometry now scales to the shorter viewport dimension to avoid clipping.
- 1440×1100 browser / 1340×808 canvas, software rendering: Canvas baseline ~4.3 fps, median JavaScript draw ~1.2 ms; single-pass WebGPU ~12.1 fps, median submission ~0.2 ms (95th percentile ~0.4 ms). These short samples are not controlled hardware benchmarks. The dashboard stream, compositor, and CPU renderer affect frame cadence; submission time is not GPU execution time.
- Reduced-motion browser emulation: frame count remained exactly 1193→1193 over the sample. DPR 2 at 1000×800 produced a capped 1.5 DPR / 1373×747 canvas without errors, then the desktop viewport was restored.
- Actual navigation/back lifecycle: `pagehide.persisted=true`, bridge disposed; `pageshow.persisted=true`, WebGPU restored. Automated tests cover hidden/blackout suspension, late initialization disposal, render failure, and repeated disposal.
- The in-app browser at the same opt-in URL reports `navigator.gpu.requestAdapter() returned null` and retains `data-renderer=canvas2d`. Existing WebMCP `set_scene` successfully selects Energy Orbit there.

The local headed browser is left available through [the dashboard](http://localhost:4848). The direct prototype URL is [Undertone with WebGPU opted in](http://127.0.0.1:4180/?renderer=webgpu); browsers without an adapter show Canvas instead.

The current refinement is described below. Hardware GPU FPS, GPU utilization, and real phone/TV behavior are unmeasured. There is no basis yet to recommend migrating Living Contours, Silk Drift, or Wet Glass; those remain unchanged.

## Current refinement snapshot

The second refinement is frozen for external review. See [the review handoff](energy-orbit-review-handoff.md) for current rendering details, shortcomings, exact file ownership and validation. Earlier single-pass measurements above are historical and do not describe the seven-pass pipeline.
