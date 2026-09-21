# Energy Orbit pass seven — final hierarchy refinement

Status: approved under the user's conditional stop criterion: materially improved fabric readability with color, depth and violet bloom intact. Stop further art-direction passes. This is visual acceptance of Energy Orbit; it is not a hardware performance claim or authorization to migrate other scenes.

## Focused changes

Only gpu/orbit.wgsl and its rebuilt bundle affect runtime. Existing geometry, projected spherical depth, violet ownership, broad violet emission, renderer, bridge, fallback, app clock, palettes and seven-pass pipeline remain intact. Bloom threshold0.62/knee0.22 unchanged.

- Fine/ridge/selvage/intersection radiance reduced18–30%, strongest near the center. Masks and derivative antialiasing unchanged, so detail remains crisp. The fine-detail component of violet emission receives the same reduction; broad violet emission and ownership remain unchanged.
- One broad soft crest with a quieter offset trough replaces flatter surface lighting. Lower base fill reduces undifferentiated haze, stronger broad crest defines the turning sheet. No repeated stripe pattern introduced.
- Existing front weight modulates surface clarity0.88–1.12, keeping rear layers visible and quieter while front surfaces gain definition. No depth formula or ordering architecture change.

## Verification

Four WGSL device-backed validations passed. Build and actual-pixel render passed.51 tests passed. Deterministic Node720×480 Ocean/seed604/brightness80/energy0: time0→25 mean RGB difference5.580845/255; visible fraction15.8666%; highlight fraction5.4427%.

Same violet diagnostic as passes4–6 (b>1.1r,r>1.15g,peak>0.01; scene qualification hybrid>0.40; final blurred bloom uses hue/peak classification without a second knee):

| Time | Max violet hybrid brightness | Scene above0.40 | Violet bloom pixels |
|---|---:|---:|---:|
|0|1.900879|8708|4690|
|5|1.888125|4048|2211|
|10|1.856621|2515|1605|
|25|0.603794|394|70|

Fine highlight energy is lower as intended; violet remains above the knee and present in final bloom at every sampled time. This establishes preserved behavior, not identical pixel counts.

## Visual acceptance

Compared with pass six, broad illuminated areas and their adjacent darkening are easier to read as turning surfaces. Center crossings compete less with the membrane mass. Front folds are clearer while rear detail remains atmospheric. Cyan/blue/violet separation is intact, and the outline remains restrained. Fine strands remain visible but have less visual weight. This satisfies the requested incremental stop condition without claiming an exact match to the concept images.

Same-settings headed recording: artifacts/energy-orbit-pass7-ocean.mp4,12.17seconds,1440×1100,Ocean/seed604/movement40/brightness80,audio paused.365 encoded frames,45 distinct Chrome captures (~3.7/sec), software SwiftShader. Recording is not a hardware-smoothness benchmark. Screenshot: artifacts/energy-orbit-pass7-ocean.png. Current app preview remains opt-in at ?renderer=webgpu. No other scene changed.
