import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { effect, frame, init, target } from 'vgpu/node';
import { orbitPalette } from '../gpu/palettes.js';

// This ray crosses ribbon 2 twice inside one 72-step interval at time 0,
// seed 604. Both interval endpoints have the same sign; the rear crossing
// lies inside the finite band. Render the actual production material and
// compositing rather than reproducing its geometry in JavaScript.
const grazingRay = [-0.12782608695652176, -0.7811594202898551];

function replaceOnce(source, expression, replacement, description) {
  assert.equal([...source.matchAll(expression)].length, 1, `${description}: shader probe rewrite must match once`);
  return source.replace(expression, replacement);
}

/** Compare the production traversal with a finely sampled GPU reference. */
export async function runOrbitSurfaceProbe() {
  const source = await readFile(new URL('../gpu/orbit.wgsl', import.meta.url), 'utf8');
  const probe = replaceOnce(source, /let screen\s*=\s*world\s*\/\s*radius\s*;/g,
    `let screen=vec2f(${grazingRay[0]},${grazingRay[1]});`, 'fixed grazing ray');
  const reference = replaceOnce(probe, /let samples\s*=\s*72\s*;/g,
    'let samples=1536;', 'fine traversal');
  const withoutSubdivision = replaceOnce(probe, /let divisions\s*=\s*[^;]+;/g,
    'let divisions=1;', 'negative control');
  const gpu = await init();
  try {
    const output = target(gpu, { size: [1, 1], format: 'rgba32float' });
    const palette = orbitPalette('ocean');
    const params = {
      // Preserve the production pixel footprint even though only one ray is rendered.
      viewport: [1176, 784, 1.5, 1], dynamics: [0, 604, 1, 0], style: [1, 1, 0, 1],
      ...Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, [...color, 1]])),
    };
    const render = async (shader) => {
      const pass = effect(gpu, shader, { set: { params } });
      await pass.compile(output);
      frame(gpu, current => current.pass(output, pass));
      const bytes = await output.color.read({ mipLevel: 0, region: 'all' });
      const pixel = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      assert.equal(pixel.length, 4, 'probe must read one RGBA pixel');
      assert.ok([...pixel].every(Number.isFinite), 'surface probe must produce finite radiance');
      return [...pixel];
    };
    const actual = await render(probe);
    const expected = await render(reference);
    const negative = await render(withoutSubdivision);
    const error = pixel => Math.max(...pixel.slice(0, 3).map((channel, i) => Math.abs(channel - expected[i])));
    const coarseError = error(actual), missedCrossingError = error(negative);
    const tolerance = 0.005;
    assert.ok(coarseError <= tolerance,
      `72-step grazing ray differs from 1536-step reference: ${JSON.stringify({ actual, expected, coarseError })}`);
    assert.ok(missedCrossingError > tolerance * 4,
      `negative control did not expose the missed double crossing: ${JSON.stringify({ negative, expected, missedCrossingError })}`);
    return { orbitSurfaceProbe: true, coarseError, missedCrossingError };
  } finally {
    gpu.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runOrbitSurfaceProbe()));
}
