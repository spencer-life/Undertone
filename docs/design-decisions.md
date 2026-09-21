# Design decisions

The [Figma desktop proposal](https://www.figma.com/design/8VLHLz4S8vpiliqmaLvqjl?node-id=2-94)
was inspected in the signed-in browser. It uses a broad centered visual field,
small scene identification, central frequency information, and one inset player
at the bottom of the scene. The scene v2 board was also inspected at
[node 12:214](https://www.figma.com/design/8VLHLz4S8vpiliqmaLvqjl?node-id=12-214).

The implementation restores that hierarchy while keeping mobile output and
volume controls available in the same dock. The legacy stacked CSS overrides
were removed and replaced with one layout layer. Focus indicators, dialog focus
trapping, keyboard and remote control behavior remain available.

| Area | Before | After | Reason |
| --- | --- | --- | --- |
| Rain | Flat buildings, diagonal strokes, window grid | Blurred light, refracting beads, mist, downward trails | Recognizable wet glass with foreground/background depth |
| Contours | Regular nested ellipses | Shared warped organic field and slowly moving ridges | More natural continuous motion |
| Silk | Dunes and moon | Dense flowing ribbons with narrow lighting ridges | Fabric-like layered flow |
| Orbit | Similar elliptical line rings | Spherical core, atmospheric edge, inclined paths with graduated light | A distinct volumetric scene |
| Layout | Accumulated overrides and hidden mobile routing | Single inset dock with routing and volume on phone | Keep the scene central without losing useful controls |
| Themes | Six palettes | Nine palettes, including neutral Noir, Midnight slate, Frost | Useful dark variety |

[React Bits Silk](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Silk/Silk.jsx)
and [Orb](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Orb/Orb.jsx)
were read as references for layered movement, lighting, and atmosphere. The
[MCP setup](https://reactbits.dev/get-started/mcp) uses the shadcn registry; direct
source access supplied the needed material without changing tool configuration.
The code here uses original Canvas techniques and does not copy these components.

Rendering is capped at 30 fps / 1.5 device pixels, or 20 fps in low-power mode.
Hidden pages and blackout stop drawing. Zero movement and system reduced motion
produce a still composition; no visual is synchronized to beat frequencies.
Droplet sprites and the defocused background are cached by size, seed and theme.
