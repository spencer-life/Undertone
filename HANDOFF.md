# Undertone — Codex Handoff

## Goal

I want to finish **Undertone** in Codex. Please inspect the current project/source and continue from the actual live state rather than assuming the last ChatGPT artifact is authoritative.

The two biggest areas I want finished are:

1. **Visual quality** — the scenes/animations still do not feel good enough, especially Rain.
2. **Audio quality** — I want you to research how to get the absolute best sound quality we can reasonably achieve in this product, then improve the implementation accordingly.

## Product direction

Undertone is a dark, quiet ambient-focus app/PWA for browser, phone, and TV. The core experience is a generative visual scene with ambient music, optional binaural beats, noise/textures, session controls, and speaker/headphone routing.

Keep the interface restrained. The scene should be the visual center of the product, with playback controls contained inside the stage rather than the page feeling like a stack of unrelated horizontal control bands.

Do not switch stacks or add framework weight merely because a visual library uses React. The prior direction was to keep the app lightweight/no-build unless there is a real product or implementation reason to change that.

## Figma design evidence

Use Figma for the visual design direction and browser/runtime inspection afterward for actual animation, responsiveness, audio behavior, and performance.

- Full Figma file: https://www.figma.com/design/8VLHLz4S8vpiliqmaLvqjl
- Main desktop proposal: https://www.figma.com/design/8VLHLz4S8vpiliqmaLvqjl?node-id=2-94
- Scene v2 concept board: https://www.figma.com/design/8VLHLz4S8vpiliqmaLvqjl?node-id=12-214
- Undertone Figma project folder: https://www.figma.com/files/team/1606880636315808559/folder/658031455?fuid=1606880634669954197

The original Figma direction I liked was the larger centered visual field with the playback dock integrated into the scene. The live implementation drifted away from that, so use the Figma file as design evidence rather than preserving the current visuals just because they exist.

### Scene direction

The current scenes still need substantial refinement. I specifically called out that the existing Rain scene did **not** look like rain.

The newer Scene v2 concepts explored:

- **Wet glass** — convincing rain on glass: falling rain, droplets/beads, streaks/trails, depth, soft blurred light. Avoid “diagonal line decoration over blocky buildings.”
- **Living contours** — a central organic topographic/contour field that continuously morphs.
- **Silk drift** — smooth layered fabric/wave motion, atmospheric rather than a basic sine-wave demo.
- **Energy orbit** — a deeper luminous/orbital field with slow internal motion and restrained bloom.

These are directions, not a demand to preserve every exact mockup detail. I want Codex to inspect the current result and make the visuals genuinely good.

### Themes

I want more dark themes. In particular I asked for a **dark Vercel-like / Noir theme**: black and near-black surfaces, white/neutral text, low chroma, restrained accent use.

A previous pass also explored/added names such as Rose Dark, Deep Ocean, Moss, Ember, Night Violet, Noir, Midnight Slate, and Frost. Inspect what is actually present before changing anything; the important requirement is more useful dark variety, especially Noir.

## React Bits references

I explicitly asked whether React Bits could help. These were inspected as useful visual/motion references:

- Shape Waves: https://reactbits.dev/backgrounds/shape-waves
- Topography: https://reactbits.dev/backgrounds/topography
- Waves: https://reactbits.dev/backgrounds/waves
- Orb: https://reactbits.dev/backgrounds/orb
- Silk: https://reactbits.dev/backgrounds/silk
- React Bits repository: https://github.com/DavidHDev/react-bits.git
- AI-readable index: https://reactbits.dev/llms.txt

The prior decision was **not** to convert Undertone to React/WebGPU just to install these components. Borrow useful motion/rendering ideas or adapt source where appropriate, but keep Undertone’s own identity and architecture unless inspection gives a real reason to change it.

## Audio direction — high priority

I want you to **research how to get the absolute best audio quality possible for Undertone**, not just tweak a couple of gain values.

Please inspect the current audio engine first, then research current high-quality approaches that are relevant to this kind of browser/PWA ambient audio product. I want you to determine what is limiting quality now and what should change.

The desired listening experience is **good ambient/music production with a subtle binaural-beat layer underneath it**, not “a tone plus obvious noise.”

This SoundCloud link is the sonic reference I gave ChatGPT:

https://on.soundcloud.com/Cp1Y0ZwE8v4tB1vHrR

Please open/listen to or otherwise inspect that reference if your environment allows it. I want **binaural beats behind music in that kind of overall listening experience**. Treat it as a reference for feel/quality, not as audio to copy.

I am open to changing how the music/audio is produced if research shows there is a materially better way. Do not assume the current oscillator/noise implementation must be preserved.

## Known audio defect to investigate

There is a repeatable problem on the **40 Hz / Focus** experience: the noise/audio bed cuts out or dips for roughly half a second every ~15 seconds.

In the latest source ChatGPT inspected, the noise implementation used finite looping generated buffers:

- the brown/pink/white noise bed used `noiseBuffer(type, 10)` on `AudioBufferSourceNode`s with `loop = true`;
- rain/ocean texture generation used a `noiseBuffer('pink', 13)` source with `loop = true`;
- `noiseBuffer()` faded the first and last ~20 ms of every generated buffer to zero.

That is a strong candidate for the periodic audible dip/seam, but verify the current source before assuming this is still the exact cause.

I do **not** want a periodic seam, dropout, or obvious repeating noise loop. Fix the underlying cause rather than hiding it with a different loop length.

The current design also distinguishes:

- **Headphones:** true left/right binaural tones.
- **TV / speakers:** an audible speaker pulse, explicitly not presented as binaural.

Preserve that factual distinction unless the audio design is intentionally changed.

## Current implementation / deployment

Production site:

https://subtle-begonia-b38551.netlify.app/

Do not assume production is the newest implementation. There were multiple ChatGPT-generated iterations and deployment attempts. Verify the current local source, repository state, and live deployment before deciding what is current.

The latest ChatGPT-side package was named `undertone-netlify-v4.zip`. Use it only if it actually exists in the environment you receive; otherwise do not reconstruct state from this handoff.

The project has been a small no-build PWA with `index.html`, `manifest.webmanifest`, `sw.js`, `_headers`, and icons. Preserve the PWA/offline/TV/mobile behavior while improving it unless the current source proves that structure has already changed.

## What I want from this Codex session

Finish the product from the current real state.

The main intent to preserve is:

- make the scene visuals genuinely polished rather than simple canvas demos;
- use the Figma file for visual direction;
- make Rain convincingly read as rain/wet glass;
- keep or improve the integrated scene/player composition;
- add useful dark theme variety, especially Noir;
- research and implement a substantially higher-quality audio experience;
- make the ambient music and binaural layer feel closer in quality/relationship to the SoundCloud reference;
- eliminate the periodic 40 Hz/noise dropout;
- preserve truthful speaker-vs-headphone behavior and the useful PWA/TV/mobile functionality.

Please inspect and reason from the actual code, available Figma evidence, current deployment, and current external documentation before choosing the implementation.
