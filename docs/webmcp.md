# Undertone browser tools

The top-level imperative integration uses feature-detected
`document.modelContext.registerTool`. WebMCP is an evolving draft; browsers
without it retain all ordinary controls. No framework or polyfill is required.

| Tool | Effect |
| --- | --- |
| `get_undertone_state` | Read current settings, playback/loading state and available choices |
| `set_scene` | Set scene, palette, movement, brightness, low-power mode or blackout |
| `set_sound` | Set music/beat/texture/master levels, frequency, carrier, route and noise type |
| `apply_preset` | Apply one of the four existing listening presets |
| `select_music` | Select a catalog track/source and configure automatic rotation |

Tools reuse app state transitions and update visible controls. Unknown fields,
invalid IDs, non-finite/out-of-range numbers and contradictory music selections
are rejected. Music selection respects cancellation and a 30-second deadline.
Before the first Play gesture, selection configures music without starting audio.
Playback remains under the normal player control.

The read tool is annotated read-only. Mutations are reversible local settings;
there is no cross-origin exposure, arbitrary URL fetching, code execution, file
access, publication, deletion, or exposure of saved-mix names/session history.
Page lifecycle cleanup removes registrations, with restoration on BFCache return.

Examples: “Show me wet glass in Noir”, “Set ocean to 35 and music to 60”,
“Use relaxed focus”, “Rotate the music library automatically”. Agents can read
the state first to discover exact catalog IDs.

References refreshed 2026-09-21:
- https://webmachinelearning.github.io/webmcp/
- https://developer.chrome.com/docs/ai/webmcp/imperative-api

Deterministic tests cover contracts, validation, state effects, cancellation,
timeouts and registration cleanup. Live browser results are recorded in
`verification.md`; these do not imply support in every browser or client.
