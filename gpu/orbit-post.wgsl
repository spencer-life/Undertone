struct PostParams { center: vec2f, bloomStrength: f32, pad: f32 }
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var bloom: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<uniform> post: PostParams;
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let scene = textureSampleLevel(src, samp, uv, 0.0).rgb;
  let glow = textureSampleLevel(bloom, samp, uv, 0.0).rgb;
  let hdr = scene + glow * post.bloomStrength;
  let mapped = vec3f(1.0) - exp(-hdr);
  var display = pow(max(mapped - vec3f(0.0025), vec3f(0.0)), vec3f(0.69));
  let distance = length((uv - post.center) * vec2f(1.0, 1.12)) * 1.2;
  display *= 1.0 - 0.40 * pow(clamp(distance, 0.0, 1.0), 1.8);
  return vec4f(display, 1.0);
}
