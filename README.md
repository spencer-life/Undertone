# Undertone

A no-build ambient audio PWA with stereo FLAC music, live binaural beats, and four generative scenes. Serve this directory over
HTTPS or localhost; no compilation, external fonts, runtime packages, third-party streaming
services, accounts, or API keys are required. The four bundled FLAC files total about 105 MB.

## Run and verify

```sh
python3 -m http.server 4178 --bind 127.0.0.1
# Open http://localhost:4178
pnpm run check
pnpm test
```

Open `/tests/audio-browser.html` from a fresh origin (for example
`http://127.0.0.1:4178/tests/audio-browser.html`) and press **Run audio checks**.
This renders the actual Web Audio graph using OfflineAudioContext, measuring the
full mix and validating left/right carrier separation and speaker modulation.
It does not emit sound. Tests are developer files and are excluded from the
release ZIP. A service-worker-controlled origin deliberately routes navigation
to the cached app shell, so use the fresh origin for this harness.

## Source and baseline

The starting source was `/home/mlpc/Downloads/undertone-netlify-final.zip`,
whose `index.html` SHA-256 was
`334a3bc5db9366e455fe7a80ed15f75a8db39f09deff5e33bb1556049c274258`.
It matched the public production app on inspection, except for Netlify-injected
hosting metadata and its HUD script. The older `undertone-netlify-deploy.zip`
was also found; `undertone-netlify-v4.zip` was not found. No existing Undertone
Git checkout was found in the local development or Downloads directories.

Verified production baseline: Netlify site `024413a7-613e-4a9c-9240-02ef9be77984`,
manual production deploy `6ab1192844f2652114e323b5`, published
2026-09-21T11:46:53Z. This local project has no configured remote.
The original ZIP remains available for rollback.

## Structure

- `index.html`, `styles.css`, `layout.css`: accessible controls and integrated stage.
- `app.js`: settings, saved mixes, playback, timer, TV navigation, PWA lifecycle.
- `visuals.js`: seeded Canvas scenes and nine dark palettes, including Noir.
- `audio.js`, `audio-worklet.js`: live tones, generated music, effects and continuous textures.
- `tracks.js`, `music-library.js`, `assets/music/`: lossless-source track playback and credits.
- `sw.js`: atomic versioned offline app shell.
- `manifest.webmanifest`, `icons/`, `_headers`: installation and Netlify metadata.

The old saved-mix IDs (`tides`, `dunes`, `orbit`, `rain`), theme IDs, storage key
and score IDs are preserved. `dunes` now selects Silk drift; saved settings do not
break. Old saved mixes without a music-source field retain Generated music. Existing mix levels remain intact; selecting a preset applies the
new music-forward balance.

## Deployment and updates

The release ZIP contains runtime files, icons, FLAC assets and credits, the README, and the music integration guide. Upload its
contents to the existing Netlify site when publication is authorized. There is
no build command. Keep the directory structure intact so the AudioWorklet and
service worker can load.

When changing runtime files, increment `CACHE` in `sw.js`. New service workers
wait for existing tabs to close so a playing session is not replaced midway.
Offline assets use one coherent cached version; activation deletes only old
`undertone-v` app-shell caches and preserves the separate music cache. The first online load must finish before offline use.

## Design and sound evidence

See [design decisions](docs/design-decisions.md), [audio research](docs/audio-research.md), [lossless music integration](docs/music-library.md),
and [verification](docs/verification.md). React Bits was read as a motion and
lighting reference. The default renderer is original Canvas code; the optional
Energy Orbit experiment bundles vgpu under its MIT license.

Physical phone/TV, Bluetooth, device DAC, and headphones affect the listening
experience. Browser/OS background suspension remains outside the app's control;
this app does not promise dependable locked-screen playback. The supplied
SoundCloud reference was identified from metadata, not audibly evaluated.

## Agent controls

`webmcp.js` progressively enhances supporting browsers with same-origin tools
for reading current settings and changing scenes, sound levels, presets, and
music. They use the same application state transitions as the visible controls.
Unsupported browsers keep the normal UI. No arbitrary URLs, code execution,
file access, saved history, or external publication tools are exposed.

## Energy Orbit experiment

Open `/?renderer=webgpu` and choose Energy orbit to try the opt-in procedural
shader with deformed fabric layers, depth shading, traveling highlights, and
selective HDR bloom. The normal URL retains Canvas. A usable WebGPU adapter is
required; otherwise the existing Canvas scene remains visible.

The checked-in vendor bundle needs no build to run. To edit the shader, use the
[official project skill](.agents/skills/vgpu/SKILL.md), install the pinned tools
with `mise install` and `pnpm install --frozen-lockfile`, then run
`pnpm check:orbit`, `pnpm build:orbit`, and `pnpm render:orbit`. The render check
writes deterministic PPM frames under the ignored `artifacts/` directory.
See the [experiment record](docs/energy-orbit-webgpu.md) for tooling provenance,
headed-browser access, measured software performance, and current limitations.
