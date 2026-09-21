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

const PI: f32 = 3.141592653589793;

fn rot2(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn pulse(angle: f32, center: f32, sharpness: f32) -> f32 {
  return pow(max(0.0, 0.5 + 0.5 * cos(angle - center)), sharpness);
}

// Screen-space antialiasing for implicit lines. fwidth() is valid here because
// every call occurs in uniform fragment control flow.
fn aa_line(distance: f32, half_width: f32) -> f32 {
  let aa = max(fwidth(distance) * 1.35, 0.00025);
  return 1.0 - smoothstep(half_width, half_width + aa, abs(distance));
}

fn periodic_line(coord: f32, frequency: f32, thickness: f32) -> f32 {
  let phase = coord * frequency * PI;
  let wave = abs(sin(phase));
  let aa = max(fwidth(phase) * 1.15, 0.0005);
  return 1.0 - smoothstep(thickness, thickness + aa, wave);
}

fn gaussian(x: f32, sigma: f32) -> f32 {
  let n = x / max(sigma, 0.0001);
  return exp(-n * n);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.viewport.z;
  let time = params.dynamics.x;
  let seed = params.dynamics.y;
  let audio_energy = params.dynamics.w;
  let p = (uv - vec2f(0.5, 0.43)) * vec2f(aspect, 1.0) / min(aspect, 1.0);
  let radial = length(p);
  let polar = atan2(p.y, p.x);

  // Softly irregular atmospheric volume. Unlike the old ring basis, this body
  // occupies the center so the composition reads as an orb rather than a donut.
  let body_radius = 0.356
    + 0.015 * sin(polar * 3.0 + time * 0.055 + seed * 0.013)
    + 0.009 * sin(polar * 5.0 - time * 0.041 + seed * 0.031)
    + 0.004 * sin(polar * 9.0 + time * 0.027);
  let body = 1.0 - smoothstep(body_radius - 0.010, body_radius + 0.020, radial);
  let interior_depth = sqrt(max(0.0, 1.0 - pow(radial / max(body_radius, 0.001), 2.0)));
  let rim = pow(1.0 - interior_depth, 2.6) * body;
  let backdrop = exp(-radial * radial * 10.0);

  var color = params.background.rgb * 0.12 + params.low.rgb * backdrop * 0.018;
  let body_color = mix(params.low.rgb, mix(params.primary.rgb, params.secondary.rgb, 0.42), 0.30);
  color += body_color * body * (0.018 + interior_depth * 0.022 + rim * 0.040);

  var fabric = vec3f(0.0);
  var filaments = vec3f(0.0);

  // Five broad folded membranes cross the volume. Each is an implicit ribbon
  // y = f(x), clipped by the irregular body. This intentionally avoids an
  // annulus / length(eq)-radius construction.
  for (var j: i32 = 0; j < 5; j = j + 1) {
    let fj = f32(j);
    let slow = time * (0.036 + fj * 0.0045) + seed * (0.0043 + fj * 0.00021);
    let travel_clock = time * (0.16 + fj * 0.019) + seed * 0.0061;
    let angle = -1.08 + fj * 0.535 + 0.105 * sin(slow + fj * 1.73);
    let drift = vec2f(
      sin(slow * 0.71 + fj * 2.4),
      cos(slow * 0.57 + fj * 1.8)
    ) * (0.005 + fj * 0.0007);
    let q = rot2(p - drift, angle);
    let nx = q.x / max(body_radius, 0.001);

    // Low-frequency folds plus a gentle bow create fabric-like membranes that
    // pass through the center instead of orbiting an empty hole.
    let center =
      0.040 * sin(nx * (2.15 + fj * 0.11) + slow * 1.15 + fj * 1.31) +
      0.021 * sin(nx * (5.10 + fj * 0.17) - slow * 0.83 + fj * 2.07) +
      0.010 * sin(nx * 8.6 + slow * 0.47 + seed * 0.017) +
      (nx * nx - 0.34) * 0.022 * sin(slow * 0.61 + fj * 1.43);
    let across = q.y - center;
    let taper = 1.0 - smoothstep(0.72, 1.03, abs(nx));
    let half_width = 0.058
      + 0.017 * (0.5 + 0.5 * sin(nx * 3.2 - slow * 0.72 + fj * 1.11));
    let band = (1.0 - smoothstep(half_width * 0.72, half_width, abs(across))) * taper * body;
    let v = across / max(half_width, 0.001);

    // Pseudo-depth is deliberately independent from the sheet mask. It dims
    // rear-facing folds and makes crossings read front/back without requiring
    // a full 3D mesh/depth buffer rewrite.
    let pseudo_z =
      0.66 * sin(nx * 2.55 + slow * 1.32 + fj * 1.37) +
      0.18 * cos(v * 1.55 - fj * 0.91 + slow * 0.38);
    let front = smoothstep(-0.58, 0.62, pseudo_z);
    let depth = mix(0.16, 1.0, front);
    let edge_depth = smoothstep(0.015, 0.085, body_radius - radial);
    let depth_fade = mix(0.52, 1.0, edge_depth);

    // Fine strands follow the membrane, using derivative-aware masks instead
    // of high-power cosine spikes. This removes the dotted/moire browser look.
    let filament_coord = v + 0.055 * sin(nx * 4.7 + slow * 0.51 + fj);
    let fine = periodic_line(filament_coord, 7.2 + fj * 0.85, 0.14) * band;
    let medium = periodic_line(v + 0.03 * sin(nx * 2.4 - slow), 2.15 + fj * 0.13, 0.11) * band;

    // One displaced fold ridge per sheet provides a few strong structural
    // curves; the rest of the strands stay subordinate.
    let ridge_offset = 0.26 * sin(nx * 2.7 - slow * 0.88 + fj * 1.52);
    let ridge = aa_line(v - ridge_offset, 0.032) * band;
    let selvage = aa_line(abs(v) - 0.80, 0.026) * band;

    // Spatial palette separation: low/primary produces electric blue/cyan,
    // secondary carries indigo/violet, highlight is reserved for hot folds.
    let electric = mix(params.low.rgb, params.primary.rgb, 0.78);
    let chroma = 0.5 + 0.5 * sin(nx * 2.05 + fj * 1.81 - time * (0.071 + fj * 0.006));
    let cyan_bias = 0.5 + 0.5 * sin(nx * 3.55 - fj * 1.47 + time * 0.043);
    var sheet_color = mix(electric, params.secondary.rgb, smoothstep(0.16, 0.84, chroma));
    sheet_color = mix(sheet_color, params.primary.rgb, 0.08 + 0.18 * cyan_bias);

    // Localized highlights traverse each membrane on 5–40 s visible timescales
    // depending on the app's motion setting. The body remains deliberately slow.
    let hot_x_a = 0.62 * sin(travel_clock + fj * 1.63);
    let hot_x_b = 0.58 * cos(travel_clock * 0.71 + fj * 2.19);
    let travel_a = gaussian(nx - hot_x_a, 0.18);
    let travel_b = gaussian(nx - hot_x_b, 0.14) * 0.72;
    let traveling = max(travel_a, travel_b) * front;
    let intersection = medium * smoothstep(0.55, 0.96, front);

    let breath = 0.80 + 0.20 * sin(nx * 2.8 - slow * 0.44 + fj * 0.83);
    fabric += sheet_color * band * depth * depth_fade * breath * (0.050 + front * 0.070);
    filaments += sheet_color * fine * depth * (0.021 + front * 0.050);
    filaments += mix(sheet_color, params.highlight.rgb, 0.46) * selvage * depth * (0.050 + front * 0.090);
    filaments += mix(sheet_color, params.highlight.rgb, 0.68) * ridge * depth * (0.075 + traveling * 0.62);
    filaments += mix(sheet_color, params.highlight.rgb, 0.76) * fine * traveling * (0.24 + audio_energy * 0.10);
    filaments += params.highlight.rgb * intersection * traveling * 0.22;
  }

  color += fabric + filaments;

  // One softly irregular silhouette seam replaces the previous pair of
  // elliptical structural rings. It helps close the spherical read without
  // reintroducing the atom/donut silhouette.
  let seam_radius = body_radius - 0.007
    + 0.006 * sin(polar * 4.0 - time * 0.061)
    + 0.003 * sin(polar * 7.0 + time * 0.037 + seed * 0.011);
  let seam = aa_line(radial - seam_radius, 0.0015) * body;
  let seam_front = smoothstep(-0.72, 0.72, sin(polar + time * 0.043));
  let seam_hot = pulse(polar, time * 0.23 + seed * 0.007, 46.0) * seam_front;
  let seam_color = mix(params.primary.rgb, params.secondary.rgb, 0.42 + 0.25 * sin(polar * 1.7));
  color += seam_color * seam * mix(0.018, 0.060, seam_front);
  color += params.highlight.rgb * seam * seam_hot * 0.58;

  // Sparse motes stay outside the core so they add atmosphere, not noise.
  let moving_point = p + vec2f(seed * 0.0007, time * 0.0015);
  let cell = floor(moving_point * 118.0);
  let rnd = hash21(cell + seed);
  let point = fract(moving_point * 118.0) - 0.5;
  let mote = (1.0 - smoothstep(0.022, 0.105, length(point))) * step(0.982, rnd);
  let halo_mask = smoothstep(0.17, 0.27, radial) * (1.0 - smoothstep(0.37, 0.43, radial));
  color += mix(params.secondary.rgb, params.highlight.rgb, rnd) * mote * halo_mask * (0.07 + 0.04 * sin(time * 0.071 + rnd * 20.0));

  // Preserve HDR radiance for the existing selective bloom chain.
  let exposure = mix(0.12, 1.0, params.dynamics.z) * 1.24;
  return vec4f(max(color * exposure, vec3f(0.0)), 1.0);
}
