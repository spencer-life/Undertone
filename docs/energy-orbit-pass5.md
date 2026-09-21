# Energy Orbit pass five — supplied refinement

Applied orbit-pass5.patch against preserved pass four (99ef872) without redesign. Both shader files byte-match the ZIP's proposed files; orbit-bright.wgsl remains byte-identical to pass four. Runtime changes are only orbit.wgsl and its rebuilt generated bundle. Renderer, bridge, pipeline, palettes, fallback, app clock, integration and all other scenes remain unchanged. Threshold0.62/knee0.22 remain unchanged.

## Validation

All four device-backed shader checks passed (`pnpm check:orbit` expands to the four requested commands). Build, actual-pixel render and51 tests passed. Node720×480 Ocean/seed604/brightness80/energy0: deterministic identical-input frames; time0→25 mean RGB difference6.39516/255; visible fraction10.5764%; highlight fraction3.6577%. Static rendered pixels inspected before browser recording.

## Violet measurements

Same probe and classifications as pass four: violet b>1.1r,r>1.15g,peak>0.01; scene qualifying brightness>0.40. Hybrid=max(Rec.709 luminance,peak*(0.58+0.12*saturation)). Bloom counts apply hue/peak classification to the final blurred bloom target, without imposing a second0.40 threshold. Scene720×480,bloom480×320. Counts at different times are separate frames, not unique cumulative pixels.

| Time | Maximum violet hybrid brightness | Violet scene pixels above0.40 | Violet bloom pixels |
|---|---:|---:|---:|
|0|2.183066|7245|4534|
|5|2.147227|4080|2219|
|10|2.089150|2458|1664|
|25|0.554963|190|0|

Pass-four maximum over these samples was0.203328, with zero qualifying scene or bloom pixels. Pass five crosses the knee in all four scene samples and produces measurable violet bloom in the first three. At25, sparse qualifying scene radiance does not produce final blurred violet pixels above the probe's0.01 peak floor. This is not evidence that all violet light is identically zero at that time.

Actual HDR diagnostics retained in artifacts/pass5-pixel-probe.mjs and artifacts/pass5-pixel-evidence.txt. No palette or extraction changes were needed for this improvement.

## Depth and appearance

- The cancellation is removed: projected_z=sheet_z/body_radius retains sphere_z/body_radius. With a fixed procedural depth waveform, front/back separation now changes with projected spherical depth and tends toward a common weight at the limb. This is still an implicit projected field, not true mesh occlusion.
- The volume-depth and rear-visibility weights give brighter interior folds and quieter back layers. Rear lines remain visible in the captures, preserving layering.
- Bright violet regions visibly remain violet; separate localized ownership suppresses cyan at those emission sites. Cyan is still prominent but no longer washes out all the violet highlights.
- The result is materially closer in color and localized luminosity. The form still reads more as luminous bands crossing an outlined sphere than the references' broad wrapping translucent fabric. Large dark areas and a conspicuous perimeter remain. Do not call reference fidelity finished.
- Gentle local highlight/deformation changes are visible across recording frames without a rigid spinner. Desktop interference remains restrained; no new mobile/DPR acceptance was performed.

## Comparable recording

artifacts/energy-orbit-pass5-ocean.mp4:12.1667 seconds,1440×1100,Ocean,Energy Orbit,seed604,movement40,brightness80,audio paused. Same settings as prior passes.365 encoded frames at30fps,50 distinct Chrome captures (~4.1/sec). Software SwiftShader; hardware smoothness is unmeasured, and app delta-time clamping slows scene progression at this cadence. No injected time acceleration.

Screenshot: artifacts/energy-orbit-pass5-ocean.png. Recording contact sheet: artifacts/energy-orbit-pass5-contact.png. The test browser cache was refreshed with the verified new bundle. Service-worker/application source unchanged.

Pass four remains in Git and its prior artifacts for comparison. This supplied pass is preserved unchanged as the tested result; no extra tuning is mixed in.
