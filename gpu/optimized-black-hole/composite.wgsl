// Preserve black space and the hole silhouette while tinting luminous material.
struct Composite { params: vec4f, low: vec4f, mid: vec4f, high: vec4f, accent: vec4f }
@group(0) @binding(0) var<uniform> composite: Composite;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var bloomNear: texture_2d<f32>;
@group(0) @binding(3) var bloomMedium: texture_2d<f32>;
@group(0) @binding(4) var bloomFar: texture_2d<f32>;
@group(0) @binding(5) var linearSampler: sampler;
fn aces(x: vec3f) -> vec3f {
 return clamp((x * (2.51 * x + vec3f(0.03))) / (x * (2.43 * x + vec3f(0.59)) + vec3f(0.14)), vec3f(0.0), vec3f(1.0));
}
fn spectralRamp(uv: vec2f) -> vec3f {
 let p = uv - vec2f(0.5, 0.43);
 let phase = fract(atan2(p.y, p.x) / 6.2831853 + length(p) * 0.45 + 0.8) * 4.0;
 let t = smoothstep(0.0, 1.0, fract(phase));
 if (phase < 1.0) { return mix(composite.low.rgb, composite.mid.rgb, t); }
 if (phase < 2.0) { return mix(composite.mid.rgb, composite.high.rgb, t); }
 if (phase < 3.0) { return mix(composite.high.rgb, composite.accent.rgb, t); }
 return mix(composite.accent.rgb, composite.low.rgb, t);
}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
 let source = textureSample(scene, linearSampler, uv).rgb;
 let bloom = textureSample(bloomNear, linearSampler, uv).rgb * 0.50
   + textureSample(bloomMedium, linearSampler, uv).rgb * 0.32
   + textureSample(bloomFar, linearSampler, uv).rgb * 0.18;
 let mapped = aces((source + bloom * composite.params.x) * 1.18);
 let luma = dot(mapped, vec3f(0.2126, 0.7152, 0.0722));
 let spectral = spectralRamp(uv);
 let hue = spectral / max(max(spectral.r, max(spectral.g, spectral.b)), 0.001);
 let luminous = mix(hue, vec3f(1.0), smoothstep(0.55, 1.0, luma) * 0.32) * luma * 1.16;
 var color = mix(vec3f(luma), luminous, clamp(composite.params.y, 0.0, 1.0));
 let vignette = 1.0 - smoothstep(0.55, 1.15, length(uv - vec2f(0.5)) * 1.6);
 color *= mix(0.72, 1.0, vignette);
 return vec4f(pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.2)), 1.0);
}
