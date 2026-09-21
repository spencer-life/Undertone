# Energy Orbit pass six — supplied surface-volume refinement

Applied orbit-pass6.patch unchanged against pass five (8e164ae). Both WGSL files byte-match the supplied proposed files; bloom extraction remains byte-identical to pass five. Only orbit.wgsl and the rebuilt vendor bundle change runtime behavior. Existing renderer, bridge, seven-pass pipeline, palettes, clock, integration, fallback and other scenes remain unchanged.

## Validation

All four device-backed WGSL checks passed through pnpm check:orbit. pnpm build:orbit, pnpm render:orbit and pnpm test passed (51 tests). The actual Node frame was inspected before browser capture. At720×480,Ocean,seed604,brightness80,energy0: deterministic identical-input pixels; time0→25 mean RGB difference5.734128/255; visible fraction16.7323%; highlight fraction5.5399%. Pass-five visible fraction was10.5764%; this confirms increased lit area, not visual quality by itself.

## Same violet probe

Scene720×480,bloom480×320; b>1.1r,r>1.15g,peak>0.01 classifies violet. Scene qualification requires hybrid brightness>0.40. Hybrid=max(Rec.709 luminance,peak*(0.58+0.12*saturation)). Bloom counts use the hue/peak classifier on final blurred bloom, not a second0.40 threshold.

| Scene time | Maximum violet hybrid brightness | Violet scene pixels above0.40 | Violet bloom pixels |
|---|---:|---:|---:|
|0|2.184785|9228|5563|
|5|2.121172|4390|2496|
|10|2.136064|2759|1803|
|25|0.709702|217|181|

Violet qualifies in all four scene samples and survives the final blurred bloom in all four. Threshold0.62/knee0.22 unchanged. Actual diagnostic output and code: artifacts/pass6-pixel-evidence.txt and artifacts/pass6-pixel-probe.mjs.

## Headed comparison

artifacts/energy-orbit-pass6-ocean.mp4 is12.1667 seconds at1440×1100 with Ocean,Energy Orbit,seed604,movement40,brightness80,audio paused.365 encoded frames at30fps;48 distinct Chrome captures (~3.9/sec) on software SwiftShader. This is a composition/motion-direction check, not hardware smoothness evidence. App delta clamping can slow scene-time progression at low cadence. No accelerated time injected.

Screenshot: artifacts/energy-orbit-pass6-ocean.png. Four sampled recording frames: artifacts/energy-orbit-pass6-contact.png. Source bundle refreshed in the isolated browser cache; service-worker source unchanged.

## Visual judgment against pass five

- The object has substantially broader luminous surface area and less empty space. It is closer to translucent fabric volume, but the bright crossing contour families still define much of the composition. The primary surface-before-lines objective is improved, not fully achieved.
- Continuous perimeter/circle read is materially reduced. The remaining silhouette mostly comes from the soft body and sheet coverage, with faint edge fragments.
- Hero sheets now occupy enough area to provide a useful broad-surface baseline. Narrowing them would lose this improvement.
- Added lighting remains translucent rather than a solid opaque disc. The upper area is still dark; some filled regions read as soft haze rather than clearly turning folds. Stronger geometric fold readability is still needed to match the reference.
- Fine lines remain readable and cleaner than the early dotted passes. They are reduced relative to the broader surface, but still catch the eye first in some bright crossings. Crispness is partly softened by the stronger local violet bloom.
- Cyan, blue and violet remain spatially distinct and balanced more convincingly than pre-pass-five. Violet is not washed back to cyan; the pixel probe confirms preservation into bloom.
- Local highlights and gentle deformation remain visible without a rigid spinner in this short sample. No mobile/high-DPI or hardware performance acceptance was added.

Retained the supplied patch unchanged after evaluation. No extra coefficient tuning is mixed into this comparison. Pass five remains available in Git and its existing artifacts.
