import { build } from 'esbuild';
import { resolveShader } from '@vgpu/wgsl/runtime';

// Resolve modules once per build, not by launching a CLI/device for every file.
const wgslPlugin = {
  name: 'vgpu-wgsl-modules',
  setup(builder) {
    builder.onLoad({ filter: /\.wgsl$/ }, async ({ path }) => {
      const resolved = await resolveShader({ entry: path });
      return { contents: `export default ${JSON.stringify(resolved.wgsl)};`, loader: 'js' };
    });
  },
};
const common = {
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: true, legalComments: 'eof', plugins: [wgslPlugin],
};
for (const [entry, output, label] of [
  ['gpu/orbit.js', 'vendor/energy-orbit.js', 'Energy Orbit'],
  ['gpu/optimized-black-hole/renderer.ts', 'vendor/black-hole.js', 'Event Horizon'],
]) {
  await build({ ...common, entryPoints: [entry], outfile: output,
    banner: { js: `/* Undertone ${label}. Includes vgpu 0.5.0 (MIT); see vendor/LICENSE.vgpu. */` },
  });
}
