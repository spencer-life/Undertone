UNDERTONE — NO-BUILD PWA

Serve this folder over HTTPS or localhost. No build or dependency installation
is required for the app. index.html, all adjacent JS/CSS files, sw.js, the
manifest, icons, and assets/music must be deployed together.

The starter library contains original stereo FLAC music by Tsorthan Grove.
Read assets/music/ATTRIBUTION.md and keep it with redistributed builds.
Music files are unchanged; playback can apply repeat overlaps, gain, mixing,
and output dynamics. Browser/OS/device processing means playback is not
claimed to be bit-perfect.

Library music has its own level. Binaural tones are generated live using
native Web Audio oscillators with separate left/right channels. Speakers
use a different, explicitly labelled amplitude pulse. Continuous textures
use AudioWorklet, with an older-browser compatibility fallback. The optional
Generated music source retains the procedural compositions.

Load the app once online for its offline shell. A music track is available
offline after it has loaded and the browser has allowed it to be cached.
Close existing tabs after an update to let the new app version activate.
Mobile browsers/operating systems can still suspend audio in the background.

Developer source, tests, source provenance and future-track instructions are
in the accompanying repository README.md and docs/music-library.md.

Auto mix rotates the four-track library with eight-second crossfades.
WebMCP tools enhance supporting browsers; normal controls remain available.
