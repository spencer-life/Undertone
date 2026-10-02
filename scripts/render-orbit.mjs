// Deterministic full render-chain check using the documented vgpu Node API.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { init, effect, frame, sampler, target } from 'vgpu/node';
import { orbitPalette } from '../gpu/palettes.js';

const shader = (name) => readFileSync(new URL(`../gpu/${name}`, import.meta.url), 'utf8');
const width = 720, height = 480, bloomWidth = 480, bloomHeight = 320;
const palette = orbitPalette('ocean');
const rgba = (color) => [...color, 1];
const gpu = await init();

try {
  const output = target(gpu, { size: [width, height], format: 'rgba8unorm' });
  const scene = target(gpu, { size: [width, height], format: 'rgba16float' });
  const blooms = [
    target(gpu, { size: [bloomWidth, bloomHeight], format: 'rgba16float' }),
    target(gpu, { size: [bloomWidth, bloomHeight], format: 'rgba16float' }),
  ];
  const samp = sampler(gpu, { minFilter: 'linear', magFilter: 'linear' });
  const orbit = effect(gpu, shader('orbit.wgsl'), { set: { params: {
    viewport: [width, height, width / height, 1], dynamics: [0, 604, 0.8, 0], style: [1, 1, 0, 1],
    ...Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, rgba(color)])),
  } } });
  const bright = effect(gpu, shader('orbit-bright.wgsl'), { set: { src: scene, samp } });
  const blurOptions = [
    { direction: [1, 0], radius: 1 }, { direction: [0, 1], radius: 1 },
    { direction: [1, 0], radius: 2.25 }, { direction: [0, 1], radius: 2.25 },
  ];
  const blurs = blurOptions.map((options, index) => effect(gpu, shader('orbit-blur.wgsl'), {
    set: { src: blooms[index % 2], samp, blur: { texelSize: blooms[index % 2].texelSize, ...options } },
  }));
  const post = effect(gpu, shader('orbit-post.wgsl'), { set: {
    src: scene, bloom: blooms[0], samp,
    post: { center: [0.5, 0.43], bloomStrength: 0.64, pad: 0 },
  } });

  await Promise.all([
    orbit.compile(scene), bright.compile(blooms[0]),
    ...blurs.map((blur, index) => blur.compile(blooms[(index + 1) % 2])),
    post.compile(output),
  ]);

  const render = async (time) => {
    orbit.set({ params: { dynamics: [time, 604, 0.8, 0] } });
    frame(gpu, (currentFrame) => {
      currentFrame.pass(scene, orbit);
      currentFrame.pass(blooms[0], bright);
      blurs.forEach((blur, index) => currentFrame.pass(blooms[(index + 1) % 2], blur));
      currentFrame.pass(output, post);
    });
    return new Uint8Array(await output.color.read({ mipLevel: 0, region: 'all' }));
  };

  const first = await render(0), repeat = await render(0), later = await render(25);
  assert.deepEqual(first, repeat, 'same uniforms must reproduce exactly');
  let difference = 0, lit = 0, brightPixels = 0;
  for (let i = 0; i < first.length; i += 4) {
    const maximum = Math.max(first[i], first[i + 1], first[i + 2]);
    if (maximum > 50) lit++;
    if (maximum > 150) brightPixels++;
    for (let channel = 0; channel < 3; channel++) difference += Math.abs(first[i + channel] - later[i + channel]);
  }
  const meanDifference = difference / (width * height * 3);
  assert(meanDifference > 0.1, 'elapsed time must move the procedural scene');
  assert(lit > width * height * 0.015, 'frame must contain visible orbital geometry');
  assert(brightPixels > width * height * 0.0001, 'localized highlights must survive tone mapping');
  mkdirSync('artifacts', { recursive: true });
  for (const [name, pixels] of [['orbit-t0', first], ['orbit-t25', later]]) {
    const rgb = Buffer.alloc(width * height * 3);
    for (let i = 0, j = 0; i < pixels.length; i += 4) { rgb[j++] = pixels[i]; rgb[j++] = pixels[i + 1]; rgb[j++] = pixels[i + 2]; }
    writeFileSync(`artifacts/${name}.ppm`, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), rgb]));
  }
  console.log(JSON.stringify({
    width, height, passes: 7, deterministic: true,
    meanMotionPixelDifference: meanDifference,
    visiblePixelFraction: lit / (width * height),
    highlightPixelFraction: brightPixels / (width * height),
  }, null, 2));
} finally {
  gpu.dispose();
}
