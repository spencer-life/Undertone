import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
// Explicit release boundary: never publish tests, handoffs, tooling or .git.
const files = [
  'index.html', 'styles.css', 'layout.css', 'app.js', 'visuals.js',
  'audio.js', 'audio-worklet.js', 'music-library.js', 'tracks.js',
  'orbit-bridge.js', 'webmcp.js', 'sw.js', 'manifest.webmanifest', '_headers',
  'icons', 'assets/music', 'vendor/energy-orbit.js', 'vendor/LICENSE.vgpu',
];
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) {
  const destination = path.join(output, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, file), destination, { recursive: true });
}
// A missing shell asset would make service-worker installation fail atomically.
const worker = await readFile(path.join(output, 'sw.js'), 'utf8');
const assetList = worker.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!assetList) throw new Error('Cannot locate the offline shell manifest');
for (const [, asset] of assetList[1].matchAll(/'([^']+)'/g)) {
  await stat(path.join(output, asset));
}
console.log(`Published runtime files to ${output}`);
