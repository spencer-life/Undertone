// Combine bloom levels, tone map, vignette, and convert to display output.

struct Composite {
  params: vec4f,
  low: vec4f,
  mid: vec4f,
  high: vec4f,
  accent: vec4f,
}

@group(0) @binding(0) var<uniform> composite: Composite;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var bloomNear: texture_2d<f32>;
@group(0) @binding(3) var bloomMedium: texture_2d<f32>;
@group(0) @binding(4) var bloomFar: texture_2d<f32>;
@group(0) @binding(5) var linearSampler: sampler;

const EXPOSURE: f32 = 1.18;
const TAU: f32 = 6.283185307;

fn aces(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + vec3f(b))) / (x * (c * x + vec3f(d)) + vec3f(e)), vec3f(0.0), vec3f(1.0));
}

fn spectralRamp(uv: vec2f, luminance: f32) -> vec3f {
  let centered = uv - vec2f(0.5);
  let angle = atan2(centered.y, centered.x);
  let phase = fract(angle / TAU + length(centered) * 0.62 + 0.92);
  var spectral: vec3f;
  if (phase < 0.34) {
    spectral = mix(composite.low.rgb, composite.mid.rgb, phase / 0.34);
  } else if (phase < 0.70) {
    spectral = mix(composite.mid.rgb, composite.high.rgb, (phase - 0.34) / 0.36);
  } else {
    spectral = mix(composite.high.rgb, composite.accent.rgb, (phase - 0.70) / 0.30);
  }
  let hot = smoothstep(0.58, 0.98, luminance);
  return mix(spectral, composite.accent.rgb, hot * 0.30);
}

fn tonemap(linearColor: vec3f, uv: vec2f) -> vec3f {
  var mapped = aces(linearColor * EXPOSURE);
  let luma = dot(mapped, vec3f(0.2126, 0.7152, 0.0722));
  let spectral = spectralRamp(uv, luma);
  let colored = spectral * (0.42 + luma * 1.08);
  var color = mix(vec3f(luma), colored, clamp(composite.params.y, 0.0, 1.0));

  let centered = uv - vec2f(0.5);
  let vignette = 1.0 - smoothstep(0.55, 1.15, length(centered) * 1.6);
  color *= mix(0.70, 1.0, vignette);

  return pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.2));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let sceneColor = textureSample(scene, linearSampler, uv).rgb;
  let bloom =
    textureSample(bloomNear, linearSampler, uv).rgb * 0.50 +
    textureSample(bloomMedium, linearSampler, uv).rgb * 0.32 +
    textureSample(bloomFar, linearSampler, uv).rgb * 0.18;
  let hdr = sceneColor + bloom * composite.params.x;
  return vec4f(tonemap(hdr, uv), 1.0);
}