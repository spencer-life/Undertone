# Energy Orbit production audit — 2026-09-21

Pass 7 (`df010ae`) remains the approved visual baseline. This audit changes no WGSL, palettes, geometry, depth, violet ownership, bloom threshold/knee, pass order, bridge, or scheduling. Energy Orbit work stops here; hardware qualification remains unverified.

## Authority and correctness

Used documentation bundled with installed vgpu **0.5.0**, via `pnpm exec vgpu docs`: getting-started, shader-workflow, shipping-to-production, performance-model, performance-patterns, performance-playbook, measuring, authoring-for-perf, browser-testing, agent-browser-webgpu, adaptive-quality; Frames/Passes and timer references as needed.

- All four `vgpu check gpu/<shader>.wgsl --require-validation` commands passed device-backed validation with empty diagnostics: orbit, orbit-bright, orbit-blur, orbit-post.
- `pnpm exec vgpu doctor --pretty`: healthy; actual 16×16 render/readback passed on llvmpipe/Mesa 25.2.8. Doctor also emits a Mesa-version warning reporting “Mesa 1.4,” inconsistent with the actual adapter version. No machine packages were changed for this warning.
- `pnpm build:orbit`, `pnpm render:orbit`, `pnpm check`: passed.
- `pnpm test`: all 51 tests passed, including bridge failure/lifetime and shared visual-clock tests.

Raw evidence is retained locally in `artifacts/production/`, including validation.txt, doctor.json (human-readable output), render.txt, tests-final.txt and syntax-final.txt.

## Render path and lifetime

The existing implementation already uses **one `frame(gpu, ...)` submission containing seven passes**: HDR scene → bright extraction → horizontal/vertical narrow blur → horizontal/vertical wider blur → surface composite. No consolidation was necessary.

Surface, three intermediate targets, sampler and seven effects are created once per renderer. Resize updates target dimensions only when necessary. Bindings retain resource identities. Four separate blur effects are intentional: they preserve each pass's distinct direction/radius uniforms. Reusing one mutable effect across the queued passes would be unsafe.

All seven actual pipeline signatures already prewarm before rendering: rgba16float scene/bloom targets and the surface's actual color format/sample count. The surface signature is passed explicitly to `post.compile`; this matches the installed version's supported frame-surface workflow. `gpu.settled()` completes initialization.

Teardown is idempotent; surface and GPU context disposal release owned resources. The bridge rejects stale asynchronous acquisition and disposes late devices. Device loss/draw failure restores Canvas. Pagehide releases GPU resources; pageshow recreates the bridge.

## Changes applied

`gpu/orbit.js` now sends partial uniform updates only when the corresponding viewport, palette, or dynamics change. Normal moving frames update one vec4 instead of repeatedly setting seven. Identical draws skip the scene `.set()` entirely. This removes redundant JavaScript value processing; it does **not** establish reduced GPU work or smaller buffer uploads. No measurable speedup is claimed from noisy single-run timings.

Rebuilt `vendor/energy-orbit.js`. Bumped the atomic service-worker cache from v13 to v14 so existing installations can receive the new bundle using the existing wait-until-tabs-close update policy. Updated the PWA activation fixture to verify that v13 is removed and v14 is retained.

## Pixel parity

Before editing, saved the exact Pass 7 browser bundle and deterministic 720×480 Ocean/seed604/brightness80/energy0 pixels at scene times **0, 5, 10, 25**.

- Node/Dawn: **zero different RGBA bytes** at all four times; 1,382,400 bytes per frame. This independently preserves the seven-pass shader diagnostics.
- Actual production browser renderer, before/after bundles: **identical SHA-256 of all RGBA pixels** at all four times. This is the check that exercises the changed uniform-update implementation.
- Additional browser sequence: Ocean → Violet with seed42/brightness60/energy0.5, 500×320 logical size and requested DPR2 (capped to1.5, producing750×480) → Ocean720×480/DPR1. **All three before/after hashes identical.** Palette, resize, seed, energy and brightness changes remain effective.

The Node and browser hashes are compared within their respective adapters/target formats, not across implementations. Exact parity was achieved; no tolerance or visual concession was needed.

| Ocean time | Maximum violet hybrid brightness | Scene violet pixels above0.40 | Violet final-bloom pixels |
|---|---:|---:|---:|
|0|1.900879|8708|4690|
|5|1.888125|4048|2211|
|10|1.856621|2515|1605|
|25|0.603794|394|70|

Same Pass 7 classifier: b>1.1r, r>1.15g, peak>0.01; scene qualification adds hybrid>0.40. Final blurred bloom is classified by hue/peak without applying a second extraction knee. These diagnostics are unchanged.

Evidence: baseline/ and after/ RGBA files and pixel-evidence.txt; node-parity.json; browser-baseline.json; browser-optimized.json. The browser probe reads pixels synchronously after draw, before canvas presentation, then hashes them.

## First frame and performance limits

Headed Chrome149, software SwiftShader, 720×480/DPR1. Single-run observations, with browser/driver caches already warm:

| Measurement | Pass7 baseline | Optimized |
|---|---:|---:|
|Module import + adapter/device + resource creation + prewarm|97.1ms|60.0ms|
|First draw JavaScript encoding/submission|1.0ms|2.5ms|
|First draw + synchronous pixel copy/readback + SHA-256|247.5ms|183.6ms|
|Subsequent sampled draw encoding/submission|0.3–0.4ms|0.3–0.8ms|

These are **not GPU timestamps**, cold-start benchmarks, performance percentiles, or evidence of an optimization speedup. The last row samples only times5/10/25. Prewarm was already present in both builds and was left intact; no first-visible pipeline compile was introduced.

No actual hardware WebGPU adapter was accessible. Node selected llvmpipe (CPU). Both the usual browser and a separate native-Vulkan launch without the `--webgpu` software preset returned Google/SwiftShader, `isFallbackAdapter:true`, including a high-performance adapter request. `/dev/dxg` exists in this WSL environment, but no `/dev/dri` node or tested hardware WebGPU adapter was available. This does not establish that the host lacks a physical GPU.

SwiftShader advertises timestamp-query, but it is a fallback software implementation. No software timestamp or capture FPS is presented as hardware GPU cost. Consequently **hardware scene/bright/blur/composite milliseconds, total GPU time, average/p50/p95 hardware frame times, and sustained60FPS are unmeasured**. The documented `timer(gpu)`/per-pass spans are the appropriate next measurement on an actual adapter, requesting timestamp-query only when supported. No production feature requirement was added that could break less-capable adapters.

The application intentionally caps its ambient visual clock at **30FPS**, or **20FPS in Eco**. Even fast hardware would not present60FPS under that existing policy. This audit preserves the policy rather than silently changing product behavior.

## Actual browser coverage

Headed Chrome149/SwiftShader:

- Supported app path: `#visual` reports renderer=webgpu, orbitStatus=ready; scene visible at1440×1100/DPR1. Screenshot: `artifacts/production/headed-ocean.png`.
- Normal non-opt-in route uses the Canvas path. Browser fault injection making `navigator.gpu.requestAdapter()` return null produces state=unavailable, renderer=canvas2d, draw=false and no retained GPU layer. Unit tests also cover absent WebGPU, load rejection, device loss and late initialization races.
- App resize900×700/deviceDPR2: logical scene821.8125×498; actual GPU target1233×747, effectiveDPR1.5. Separate deterministic probe also verified returning to original size/palette.
- OS reduced-motion emulation: scene time7.857 and GPU frame count137 both unchanged over1second.
- Actual tab background/foreground: time11.321856 and frame count65 unchanged between visibility events.
- Synthetic persisted pagehide/pageshow events in the real app: disposed old bridge, cleared renderer/layer, created distinct bridge and successfully rendered again. This tests handlers; it is not proof of every browser's real BFCache eviction/restore behavior.
- Renderer dispose called twice safely; subsequent draw returned false.
- Fresh browser page error log empty; no VGPU-* runtime errors observed.

## Intentionally unchanged and remaining coverage

No adaptive Low tier is justified by the available evidence: software renderers cannot characterize weaker physical GPUs. Keep existing DPR cap1.5, bloom height cap320 and30/20FPS policies. If physical-device measurements later show difficulty, first evaluate a smaller internal resolution/DPR; do not alter the approved shader art silently.

Fullscreen `effect(gpu)` remains appropriate for this procedural fragment workload. Render bundles, mesh migration, bloom rewrites and further shader tuning were not warranted.

Outstanding coverage: physical integrated/discrete GPUs and GPU timestamp measurements; sustained desktop hardware load/power; Safari/Firefox WebGPU; mobile devices; real BFCache navigation across browser engines; hardware device-loss behavior. Software correctness is verified, but broad hardware performance certification is not claimed.
