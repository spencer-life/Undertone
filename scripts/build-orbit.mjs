import { build } from 'esbuild';
await build({entryPoints:['gpu/orbit.js'],outfile:'vendor/energy-orbit.js',bundle:true,loader:{'.wgsl':'text'},format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',banner:{js:'/* Undertone Energy Orbit experiment. Includes vgpu 0.5.0 (MIT); see vendor/LICENSE.vgpu. */'}});
