@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let color = textureSampleLevel(src, samp, uv, 0.0).rgb;
  let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let peak = max(color.r, max(color.g, color.b));

  // Pure Rec.709 luminance under-values saturated blue/violet. Keep perceptual
  // luminance, but let a strong peak channel qualify for selective bloom too.
  let brightness = max(luminance, peak * 0.54);
  let threshold = 0.62;
  let knee = 0.22;
  let soft = clamp((brightness - threshold + knee) / (2.0 * knee), 0.0, 1.0);
  let contribution = max(soft * soft * knee, brightness - threshold);

  return vec4f(color * contribution / max(brightness, 0.0001), 1.0);
}
