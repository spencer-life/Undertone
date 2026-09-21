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

fn pulse(angle: f32, center: f32, sharpness: f32) -> f32 {
  return pow(max(0.0, 0.5 + 0.5 * cos(angle - center)), sharpness);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.viewport.z;
  let time = params.dynamics.x;
  let seed = params.dynamics.y;
  let audioEnergy = params.dynamics.w;
  let p = (uv - vec2f(0.5, 0.43)) * vec2f(aspect, 1.0) / min(aspect, 1.0);
  let radial = length(p);
  let polar = atan2(p.y, p.x);

  // A quiet atmospheric body gives the strands a volume to wrap without
  // filling the central area with a flat disc.
  let bodyRadius = 0.354
    + 0.016 * sin(polar * 3.0 + time * 0.029 + seed * 0.013)
    + 0.010 * sin(polar * 5.0 - time * 0.021 + seed * 0.031)
    + 0.005 * sin(polar * 9.0 + time * 0.017);
  let body = 1.0 - smoothstep(bodyRadius - 0.006, bodyRadius + 0.018, radial);
  let interiorDepth = sqrt(max(0.0, 1.0 - pow(radial / max(bodyRadius, 0.001), 2.0)));
  let rim = pow(1.0 - interiorDepth, 3.0) * body;
  let backdrop = exp(-radial * radial * 11.0);
  var color = params.background.rgb * 0.12 + params.low.rgb * backdrop * 0.015;
  let bodyColor = mix(params.low.rgb, mix(params.primary.rgb, params.secondary.rgb, 0.34), 0.23);
  color += bodyColor * body * (0.013 + interiorDepth * 0.006 + rim * 0.068);

  var fabric = vec3f(0.0);
  var filaments = vec3f(0.0);

  // Six independently drifting sheets overlap into one cohesive sphere.
  for (var j: i32 = 0; j < 6; j = j + 1) {
    let fj = f32(j);
    let clock = time * (0.009 + fj * 0.0027) + seed * (0.0041 + fj * 0.00017);
    let inclination = -0.88 + fj * 0.354 + 0.105 * sin(clock * (0.63 + fj * 0.071) + fj * 2.13);
    let drift = vec2f(sin(clock * 0.71 + fj * 2.7), cos(clock * 0.53 + fj * 1.9)) * (0.005 + fj * 0.0008);
    let q = rot2(p - drift, inclination);
    let flatten = 0.53 + 0.050 * fj + 0.055 * sin(clock * 0.47 + fj * 1.31);
    let eq = vec2f(q.x, q.y / flatten);
    let theta = atan2(eq.y, eq.x);

    let deformation =
      0.016 * sin(theta * (2.0 + f32(j % 3)) + clock * 0.81 + fj) +
      0.010 * sin(theta * (5.0 + f32(j % 2)) - clock * 0.57 + fj * 2.2) +
      0.004 * sin(theta * 11.0 + clock * 0.29 + seed * 0.019);
    let sheetRadius = 0.292 + fj * 0.0045 + deformation;
    let across = length(eq) - sheetRadius;
    let halfWidth = 0.069 + 0.010 * sin(theta * 2.0 - clock * 0.33 + fj);
    let band = 1.0 - smoothstep(halfWidth * 0.74, halfWidth, abs(across));

    // Projected z distinguishes front and rear arcs. Rear contours sink into
    // the atmospheric body while remaining faintly visible.
    let z = sin(theta + fj * 1.17 + clock * 0.13);
    let front = smoothstep(-0.72, 0.78, z);
    let depth = mix(0.10, 1.0, front);
    let edgeFade = smoothstep(0.02, 0.075, bodyRadius - radial);
    let depthFade = mix(0.58, 1.0, edgeFade);

    let contourWarp = sin(theta * 4.0 + clock * 0.74 + fj) * 2.3 + sin(theta * 9.0 - clock * 0.41) * 0.75;
    let fine = pow(0.5 + 0.5 * cos(across * (1140.0 + fj * 54.0) + contourWarp), 35.0) * band;
    let medium = pow(0.5 + 0.5 * cos(across * 218.0 - contourWarp * 0.29), 42.0) * band;
    let selvage = (1.0 - smoothstep(0.0012, 0.0055, abs(abs(across) - halfWidth * 0.80))) * band;

    let chroma = 0.5 + 0.5 * sin(theta * 1.37 + fj * 1.91 - clock * 0.24);
    let sheetColor = mix(mix(params.primary.rgb, params.secondary.rgb, 0.12 + 0.82 * chroma), params.highlight.rgb, 0.05 + 0.13 * (1.0 - chroma));

    // Two narrow highlights travel at different speeds. Only these and rare
    // intersections rise far enough above the bloom threshold.
    let hotA = pulse(theta, clock * (0.91 + fj * 0.031) + fj * 1.77, 42.0);
    let hotB = pulse(theta, -clock * (0.61 + fj * 0.019) + fj * 2.43, 68.0);
    let traveling = max(hotA, hotB * 0.76) * front;
    let crossing = medium * smoothstep(0.48, 0.96, front);

    let sheetBreath = 0.82 + 0.18 * sin(theta * 2.0 - clock * 0.19 + fj * 0.8);
    fabric += sheetColor * band * depth * depthFade * sheetBreath * (0.042 + front * 0.066);
    filaments += sheetColor * fine * depth * (0.018 + front * 0.039);
    filaments += mix(sheetColor, params.highlight.rgb, 0.42) * selvage * depth * 0.125;
    filaments += mix(sheetColor, params.highlight.rgb, 0.72) * (fine * 0.48 + selvage) * traveling * (0.78 + audioEnergy * 0.16);
    filaments += params.highlight.rgb * crossing * traveling * 0.26;
  }

  color += (fabric + filaments) * body;

  // Two restrained structural seams stay close to the silhouette. They carry
  // moving highlights without reading as detached atom-like orbital rings.
  for (var k: i32 = 0; k < 2; k = k + 1) {
    let fk = f32(k);
    let clock = time * (0.0107 + fk * 0.0031) + seed * 0.0063;
    let q = rot2(p - vec2f(sin(clock + fk) * 0.005, cos(clock * 0.7 + fk) * 0.004), -0.58 + fk * 0.92 + 0.09 * sin(clock + fk));
    let axes = vec2f(0.368 + fk * 0.011, 0.235 + fk * 0.042);
    let a = atan2(q.y / axes.y, q.x / axes.x);
    let warped = length(q / axes) - 1.0 + 0.019 * sin(a * (3.0 + fk) + clock) + 0.009 * sin(a * 7.0 - clock * 0.47);
    let core = 1.0 - smoothstep(0.0012, 0.0046, abs(warped));
    let soft = 1.0 - smoothstep(0.003, 0.016, abs(warped));
    let front = smoothstep(-0.88, 0.72, sin(a + fk * 1.8));
    let traveling = pulse(a, clock * 1.31 + fk * 2.1, 54.0);
    let curveColor = mix(params.primary.rgb, params.secondary.rgb, 0.28 + fk * 0.23);
    color += curveColor * soft * mix(0.006, 0.026, front);
    color += mix(curveColor, params.highlight.rgb, traveling * 0.82) * core * mix(0.010, 0.067, front);
    color += params.highlight.rgb * core * traveling * front * 0.56;
  }

  let movingPoint = p + vec2f(seed * 0.0007, time * 0.0007);
  let cell = floor(movingPoint * 124.0);
  let rnd = hash21(cell + seed);
  let point = fract(movingPoint * 124.0) - 0.5;
  let mote = (1.0 - smoothstep(0.022, 0.105, length(point))) * step(0.978, rnd);
  let haloMask = smoothstep(0.16, 0.27, radial) * (1.0 - smoothstep(0.37, 0.43, radial));
  color += mix(params.secondary.rgb, params.highlight.rgb, rnd) * mote * haloMask * (0.08 + 0.05 * sin(time * 0.053 + rnd * 20.0));

  // Preserve HDR radiance for thresholded bloom. Tone mapping is deferred.
  let exposure = mix(0.12, 1.0, params.dynamics.z) * 1.28;
  return vec4f(max(color * exposure, vec3f(0.0)), 1.0);
}
