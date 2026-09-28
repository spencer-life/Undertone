import { build } from 'esbuild';
import { resolveShader } from '@vgpu/wgsl/runtime';

const wgslPlugin={
 name:'vgpu-wgsl-modules',
 setup(builder){
  builder.onLoad({filter:/\.wgsl$/},async args=>{
   const resolved=await resolveShader({entry:args.path});
   return {contents:`export default ${JSON.stringify(resolved.wgsl)};`,loader:'js'};
  });
 }
};

const common={
 bundle:true,
 format:'esm',
 platform:'browser',
 target:'es2022',
 minify:true,
 legalComments:'eof',
 plugins:[wgslPlugin],
};

await build({
 ...common,
 entryPoints:['gpu/orbit.js'],
 outfile:'vendor/energy-orbit.js',
 banner:{js:'/* Undertone Energy Orbit. Includes vgpu 0.5.0 (MIT); see vendor/LICENSE.vgpu. */'},
});

await build({
 ...common,
 entryPoints:['gpu/optimized-black-hole/renderer.ts'],
 outfile:'vendor/black-hole.js',
 banner:{js:'/* Undertone Event Horizon, adapted from the verified VGPU Optimized Black Hole example. Includes vgpu 0.5.0 (MIT); see vendor/LICENSE.vgpu. */'},
});
