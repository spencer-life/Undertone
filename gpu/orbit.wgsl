struct OrbitParams {
  viewport: vec4f,
  dynamics: vec4f,
  background: vec4f,
  low: vec4f,
  primary: vec4f,
  secondary: vec4f,
  highlight: vec4f,
}
@group(0) @binding(0) var<uniform> params: OrbitParams;

fn rot2(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.viewport.z;
  let time = params.dynamics.x;
  let seed = params.dynamics.y;
  let brightness = params.dynamics.z;
  let audioEnergy = params.dynamics.w;
  let p = (uv - vec2f(0.5, 0.43)) * vec2f(aspect, 1.0) / min(aspect, 1.0);
  let radial = length(p);

  // Keep the stage near-black. Color is concentrated around the orbit instead
  // of tinting the whole canvas.
  let backdrop = exp(-radial * radial * 13.0);
  var color = params.background.rgb * 0.16 + params.low.rgb * backdrop * 0.012;

  let polar = atan2(p.y, p.x);
  let radius = 0.326
    + 0.013 * sin(polar * 3.0 + time * 0.071 + seed * 0.013)
    + 0.008 * sin(polar * 5.0 - time * 0.047 + seed * 0.031);
  let inside = 1.0 - smoothstep(-0.006, 0.018, radial - radius);
  let edgeDistance = abs(radial - radius);
  let limbShape = 1.0 - smoothstep(0.0015, 0.015, edgeDistance);
  let limb = limbShape * (0.24 + 0.76 * pow(0.5 + 0.5 * sin(polar * 4.0 - time * 0.041), 3.0));

  if (inside > 0.001) {
    var light = vec3f(0.0);
    var veil = vec3f(0.0);

    // Four coherent translucent ribbons wrap the volume. Fine contours share
    // each ribbon's deformation, so they read as fabric rather than atom paths.
    for (var j: i32 = 0; j < 4; j = j + 1) {
      let fj = f32(j);
      let ribbonClock = time * (0.017 + fj * 0.0043) + seed * 0.009;
      let angleOffset = -0.48 + fj * 0.73 + 0.075 * sin(ribbonClock + fj * 1.9);
      let q = rot2(p, angleOffset);
      let flatten = 0.54 + 0.105 * fj + 0.035 * sin(ribbonClock * 0.73 + fj);
      let eq = vec2f(q.x, q.y / flatten);
      let theta = atan2(eq.y, eq.x);
      let ribbonRadius = 0.292
        + 0.018 * sin(theta * 3.0 + ribbonClock + fj * 1.4)
        + 0.007 * sin(theta * 7.0 - ribbonClock * 0.61 + seed * 0.02);
      let across = length(eq) - ribbonRadius;
      let halfWidth = 0.043 + 0.004 * sin(theta * 2.0 - ribbonClock + fj);
      let band = 1.0 - smoothstep(halfWidth * 0.62, halfWidth, abs(across));
      let edge = 1.0 - smoothstep(0.0012, 0.0060, abs(abs(across) - halfWidth * 0.72));
      let parallel = pow(0.5 + 0.5 * cos(across * 1120.0 + sin(theta * 4.0 + ribbonClock) * 1.7), 18.0) * band;
      let facing = 0.30 + 0.70 * smoothstep(-0.92, 0.86, sin(theta + fj * 1.37 + ribbonClock * 0.18));
      let ribbonColor = mix(params.primary.rgb, params.secondary.rgb, 0.12 + fj * 0.24);
      veil += ribbonColor * band * facing * 0.030;
      light += ribbonColor * parallel * facing * 0.077;
      light += mix(ribbonColor, params.highlight.rgb, 0.52) * edge * facing * 0.120;
    }

    let volume = mix(params.low.rgb * 0.038, params.primary.rgb * 0.012, smoothstep(0.0, radius, radial));
    let centralQuiet = mix(0.055, 1.0, smoothstep(0.075, 0.265, radial));
    color += (volume + veil + light) * inside * centralQuiet;
  }

  // A few restrained exterior paths carry independently timed highlights.
  for (var k: i32 = 0; k < 3; k = k + 1) {
    let fk = f32(k);
    let q = rot2(p, -0.62 + fk * 0.58 + 0.09 * sin(time * 0.027 + fk));
    let axes = vec2f(0.405 + fk * 0.014, 0.150 + fk * 0.045);
    let ellipse = length(q / axes);
    let path = 1.0 - smoothstep(0.0015, 0.0050, abs(ellipse - 1.0));
    let angle = atan2(q.y / axes.y, q.x / axes.x);
    let moving = pow(max(0.0, 0.5 + 0.5 * cos(angle - time * (0.071 + fk * 0.009) - fk * 1.7)), 13.0);
    color += mix(params.secondary.rgb, params.highlight.rgb, moving) * path * (0.004 + moving * 0.070);
  }

  // Sparse procedural motes remain inside the immediate halo.
  let movingPoint = p + vec2f(seed * 0.0007, time * 0.0013);
  let cell = floor(movingPoint * 116.0);
  let rnd = hash21(cell + seed);
  let point = fract(movingPoint * 116.0) - 0.5;
  let mote = (1.0 - smoothstep(0.025, 0.11, length(point))) * step(0.972, rnd);
  let haloMask = smoothstep(0.12, 0.29, radial) * (1.0 - smoothstep(0.39, 0.46, radial));
  color += params.highlight.rgb * mote * haloMask * (0.070 + 0.025 * sin(time * 0.083 + rnd * 20.0));

  color += mix(params.primary.rgb, params.highlight.rgb, 0.46) * limb * (0.030 + audioEnergy * 0.014);

  // Single-pass exposure and display mapping. Brightness follows the scene
  // control's full 10–100% range; no separate post-processing target is used.
  let exposed = color * mix(0.12, 1.0, brightness) * 1.34;
  let mapped = vec3f(1.0) - exp(-exposed);
  let display = pow(max(mapped - vec3f(0.003), vec3f(0.0)), vec3f(0.68));
  let vignette = 1.0 - 0.42 * pow(clamp(length((uv - vec2f(0.5, 0.43)) * vec2f(1.0, 1.12)) * 1.2, 0.0, 1.0), 1.8);
  return vec4f(display * vignette, 1.0);
}
