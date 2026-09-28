# Orbit volume pass — in review

Scope: respond to the request for actual depth and more perceptible motion while
keeping the existing immersive UI, palettes, equal theme scale and GPU lifecycle.

The previous shader composited projected curves additively. The replacement
samples three folded, finite sheets through a spherical 3D volume and accumulates
front-to-back transmittance. Foreground folds attenuate rear light; sheet normals
control local shading and edge highlights. Negative space remains visible instead
of filling the orb with an opaque sphere. Movement uses the existing shared clock,
with independently evolving folds and traveling light. No new animation library.

The seven-pass HDR/selective-bloom chain and uniform layout are unchanged.
A bounded pixel budget is supplied for the renderer so high-DPR monitors do not
multiply the more substantial fragment work without limit. Hardware performance
must be measured separately from the software-rendered CI validation.

This is an implementation candidate, not user visual approval. Required evidence:
device-backed WGSL validation, deterministic Node frames, browser frames several
seconds apart, Graphite and alternate palettes, mobile/tablet framing, and existing
responsive/accessibility regression gates.
