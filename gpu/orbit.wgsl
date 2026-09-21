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
  let footprint = fwidth(phase);
  let aa = max(footprint * 1.20, 0.0005);
  let line = 1.0 - smoothstep(thickness, thickness + aa, wave);

  // Fade periodic detail when its projected footprint becomes too dense to
  // resolve cleanly. This reduces interference at membrane crossings.
  let density_fade = 1.0 - smoothstep(0.50, 1.20, footprint);
  return line * density_fade;
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

  // Two very faint interior lobes give the volume atmospheric presence without
  // turning it into a solid filled sphere.
  let inner_a = exp(
    -length(
      rot2(
        p - vec2f(0.055, -0.025),
        time * 0.012
      ) / vec2f(0.25, 0.17)
    ) * 4.2
  );
  let inner_b = exp(
    -length(
      rot2(
        p + vec2f(0.045, 0.035),
        -time * 0.009
      ) / vec2f(0.19, 0.27)
    ) * 4.8
  );
  color += params.low.rgb * body * inner_a * 0.018;
  color += params.secondary.rgb * body * inner_b * 0.010;

  var fabric = vec3f(0.0);
  var filaments = vec3f(0.0);

  // Four folded membranes cross the volume. Two are broad hero folds and two
  // are subordinate. Their staggered centers and radial twist avoid the
  // star/rosette convergence seen in the previous pass.
  for (var j: i32 = 0; j < 4; j = j + 1) {
    let fj = f32(j);
    let slow = time * (0.036 + fj * 0.0045) + seed * (0.0043 + fj * 0.00021);
    let travel_clock = time * (0.16 + fj * 0.019) + seed * 0.0061;

    let base_angle =
      -0.92 +
      fj * 0.48 +
      0.08 * sin(slow + fj * 1.73);

    let drift = vec2f(
      sin(slow * 0.71 + fj * 2.4),
      cos(slow * 0.57 + fj * 1.8)
    ) * (0.005 + fj * 0.0007);

    // Curving the local coordinate frame as a function of radius/polar angle
    // makes sheets wrap through the orb instead of reading as straight chords.
    let radial_twist =
      0.28 *
      radial *
      sin(
        polar * 1.35 +
        slow * 0.42 +
        fj * 1.91
      );

    let q = rot2(
      p - drift,
      base_angle + radial_twist
    );

    let nx = q.x / max(body_radius, 0.001);

    // Staggered sheet centers keep the membranes from all meeting at the
    // origin. Broad low-frequency folds provide the fabric volume.
    let sheet_offset =
      0.082 * sin(fj * 2.17 + 0.75) +
      0.018 * sin(seed * 0.013 + fj * 1.3);

    let center =
      sheet_offset +
      0.050 *
      sin(
        nx * (1.65 + fj * 0.08) +
        slow * 0.88 +
        fj * 1.24
      ) +
      0.024 *
      sin(
        nx * (3.65 + fj * 0.14) -
        slow * 0.57 +
        fj * 2.03
      ) +
      0.009 *
      sin(
        nx * 7.4 +
        slow * 0.31 +
        seed * 0.017
      ) +
      (nx * nx - 0.28) *
      0.036 *
      sin(
        slow * 0.49 +
        fj * 1.61
      );

    let across = q.y - center;

    // Hero sheets now occupy much more of the spherical volume. The previous
    // pass proved the geometry/depth/color direction, but these widths still
    // made every surface read as a luminous ribbon.
    let taper = 1.0 - smoothstep(0.82, 1.12, abs(nx));

    let major = 1.0 - step(2.0, fj);
    let half_width =
      mix(0.078, 0.148, major) +
      0.024 *
      (
        0.5 +
        0.5 *
        sin(nx * 2.15 - slow * 0.49 + fj * 1.11)
      );

    let v = across / max(half_width, 0.001);

    // `veil` is the broad translucent fabric surface. `band` is a narrower
    // structural region used for crisp strands/ridges. Separating them prevents
    // line work from defining the whole object.
    let veil =
      (1.0 - smoothstep(0.72, 1.24, abs(v))) *
      taper *
      body;

    let band =
      (1.0 - smoothstep(0.58, 0.94, abs(v))) *
      taper *
      body;

    // Preserve projected spherical depth instead of dividing it back out.
    // projected_z naturally collapses toward the silhouette, so front/back
    // separation becomes strongest through the orb interior and converges at
    // the limb like an actual spherical volume.
    let sphere_z =
      sqrt(
        max(
          0.0,
          body_radius * body_radius -
          radial * radial
        )
      );

    let sphere_depth =
      clamp(
        sphere_z / max(body_radius, 0.001),
        0.0,
        1.0
      );

    let z_wave =
      0.67 *
      sin(
        nx * 2.05 +
        slow * 0.81 +
        fj * 1.57
      ) +
      0.23 *
      sin(
        nx * 4.35 -
        slow * 0.47 +
        fj * 0.91
      );

    let sheet_z =
      sphere_z *
      clamp(
        z_wave,
        -0.92,
        0.92
      );

    // Crucially normalize by body_radius, not sphere_z. This retains the
    // spatial depth term instead of algebraically cancelling it.
    let projected_z =
      sheet_z /
      max(body_radius, 0.001);

    let front =
      smoothstep(
        -0.30,
        0.30,
        projected_z
      );

    // Rear sheets remain visible, but lose radiance and opacity. Interior
    // regions receive more volume than the limb so the folds read as passing
    // through a sphere rather than lying on a flat disc.
    let front_back =
      mix(
        0.30,
        1.0,
        front
      );

    let volume_depth =
      mix(
        0.58,
        1.0,
        pow(sphere_depth, 0.72)
      );

    let depth =
      front_back *
      volume_depth;

    let depth_fade =
      mix(
        0.54,
        1.0,
        smoothstep(0.05, 0.32, sphere_depth)
      );

    // Derivative-aware filament masks fade when too dense to resolve cleanly.
    let filament_coord = v + 0.055 * sin(nx * 4.7 + slow * 0.51 + fj);
    let fine =
      periodic_line(
        filament_coord,
        5.4 + fj * 0.55,
        0.12
      ) *
      band;

    let medium =
      periodic_line(
        v + 0.03 * sin(nx * 2.4 - slow),
        2.15 + fj * 0.13,
        0.11
      ) *
      band;

    let ridge_offset = 0.26 * sin(nx * 2.7 - slow * 0.88 + fj * 1.52);
    let ridge = aa_line(v - ridge_offset, 0.032) * band;
    let selvage = aa_line(abs(v) - 0.80, 0.026) * band;

    // Spatial palette separation: cyan/electric-blue on frontal folds,
    // indigo/violet preserved on selected rear/localized regions.
    let electric = mix(params.low.rgb, params.primary.rgb, 0.78);
    let chroma =
      0.5 +
      0.5 *
      sin(nx * 2.05 + fj * 1.81 - time * (0.071 + fj * 0.006));

    let cyan_bias =
      0.5 +
      0.5 *
      sin(nx * 3.55 - fj * 1.47 + time * 0.043);

    var sheet_color =
      mix(
        electric,
        params.secondary.rgb,
        smoothstep(0.16, 0.84, chroma)
      );

    sheet_color =
      mix(
        sheet_color,
        params.primary.rgb,
        0.08 + 0.18 * cyan_bias
      );

    sheet_color =
      mix(
        mix(params.low.rgb, params.secondary.rgb, 0.36),
        sheet_color,
        front
      );

    // Localized highlights travel independently of body rotation.
    let hot_x_a = 0.62 * sin(travel_clock + fj * 1.63);
    let hot_x_b = 0.58 * cos(travel_clock * 0.71 + fj * 2.19);
    let travel_a = gaussian(nx - hot_x_a, 0.18);
    let travel_b = gaussian(nx - hot_x_b, 0.14) * 0.72;
    let traveling = max(travel_a, travel_b) * front;
    let intersection = medium * smoothstep(0.55, 0.96, front);

    // Give violet its own spatial ownership instead of adding it underneath
    // stronger cyan highlights. A separate moving lobe selects regions where
    // secondary color becomes the dominant emissive hue.
    let violet_zone =
      smoothstep(
        0.36,
        0.82,
        0.5 +
        0.5 *
        sin(
          nx * 1.92 +
          fj * 2.33 -
          time * 0.052
        )
      );

    let violet_center =
      0.52 *
      sin(
        time * (0.118 + fj * 0.008) +
        fj * 1.77 +
        seed * 0.004
      );

    let violet_travel =
      gaussian(
        nx - violet_center,
        0.23
      );

    let violet_ownership =
      clamp(
        violet_zone *
        violet_travel *
        mix(0.48, 1.0, front),
        0.0,
        1.0
      );

    // Suppress cyan/highlight contributions specifically where violet owns the
    // fold. This prevents additive cyan from washing the HDR violet back toward
    // blue/cyan before the bloom extractor sees it.
    let cyan_keep =
      1.0 -
      0.90 *
      violet_ownership;

    let violet_detail =
      max(
        ridge,
        max(
          fine * 0.34,
          selvage * 0.24
        )
      );

    let violet_emit =
      band *
      violet_ownership *
      (
        0.30 +
        1.20 * violet_detail
      );

    let violet_color =
      params.secondary.rgb *
      vec3f(1.08, 0.78, 1.14);

    // Shift the base membrane toward secondary color in owned regions too, so
    // the luminous violet fold has visible area instead of existing only as a
    // razor-thin highlight.
    sheet_color =
      mix(
        sheet_color,
        params.secondary.rgb,
        0.70 * violet_ownership
      );

    let breath = 0.80 + 0.20 * sin(nx * 2.8 - slow * 0.44 + fj * 0.83);

    // Broad surface lighting: a soft moving fold crest plus a center-weighted
    // translucent body. This is deliberately much wider than the filament
    // highlights so the eye sees fabric first and line work second.
    let fold_center =
      0.30 *
      sin(
        nx * 1.34 -
        slow * 0.73 +
        fj * 1.29
      );

    let fold_light =
      gaussian(
        v - fold_center,
        mix(0.46, 0.62, major)
      );

    let cross_light =
      0.5 +
      0.5 *
      sin(
        nx * 1.58 +
        time * (0.038 + fj * 0.004) +
        fj * 1.71
      );

    let surface_luminance =
      0.44 +
      0.44 * fold_light +
      0.12 * cross_light;

    let surface_glint =
      fold_light *
      traveling *
      (0.20 + 0.80 * front);

    let surface_color =
      mix(
        sheet_color,
        params.highlight.rgb,
        0.10 * surface_glint * cyan_keep
      );

    // Broad translucent fabric carries most of the visual mass now.
    fabric +=
      surface_color *
      veil *
      depth *
      depth_fade *
      breath *
      surface_luminance *
      (0.105 + front * 0.105 + sphere_depth * 0.055);

    // A faint secondary-colored underlayer suggests light passing through the
    // membrane instead of an opaque painted strip.
    fabric +=
      mix(params.low.rgb, params.secondary.rgb, 0.62) *
      veil *
      (1.0 - front) *
      sphere_depth *
      0.028;

    // Crisp detail is intentionally quieter than Pass 5 so it sits *inside*
    // the broad surfaces instead of turning those surfaces back into ribbons.
    filaments +=
      sheet_color *
      fine *
      depth *
      (0.014 + front * 0.035);

    filaments +=
      mix(sheet_color, params.highlight.rgb, 0.42) *
      selvage *
      depth *
      (0.034 + front * 0.060) *
      cyan_keep;

    filaments +=
      mix(sheet_color, params.highlight.rgb, 0.62) *
      ridge *
      depth *
      (0.052 + traveling * 0.40) *
      cyan_keep;

    filaments +=
      mix(sheet_color, params.highlight.rgb, 0.70) *
      fine *
      traveling *
      (0.16 + audio_energy * 0.08) *
      cyan_keep;

    filaments +=
      params.highlight.rgb *
      intersection *
      traveling *
      0.13 *
      cyan_keep;

    // Keep the successful Pass-5 violet ownership/emission mechanism.
    filaments +=
      violet_color *
      violet_emit *
      depth *
      (1.00 + audio_energy * 0.10);
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

  // Break the perimeter into quiet fragments. The references imply their
  // silhouette through luminous folds; a continuous circular outline makes the
  // procedural result feel flatter and more diagrammatic.
  let seam_presence =
    smoothstep(
      0.22,
      0.80,
      0.5 +
      0.5 *
      sin(
        polar * 2.17 -
        time * 0.024 +
        seed * 0.009
      )
    );

  let seam_color = mix(params.primary.rgb, params.secondary.rgb, 0.42 + 0.25 * sin(polar * 1.7));
  color += seam_color * seam * seam_presence * mix(0.006, 0.024, seam_front);
  color += params.highlight.rgb * seam * seam_hot * seam_presence * 0.24;

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
