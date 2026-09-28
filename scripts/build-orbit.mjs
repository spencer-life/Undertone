import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const resolveWgsl=(entry)=>{
 const stdout=execFileSync('pnpm',['exec','vgpu','check',entry],{
  encoding:'utf8',
  stdio:['ignore','pipe','inherit'],
 });
 const payload=JSON.parse(stdout);
 if(!payload?.wgsl)throw new Error(`vgpu check did not return resolved WGSL for ${entry}`);
 return payload.wgsl;
};

const wgslPlugin={
 name:'vgpu-wgsl-modules',
 setup(builder){
  builder.onLoad({filter:/\.wgsl$/},args=>({
   contents:`export default ${JSON.stringify(resolveWgsl(args.path))};`,
   loader:'js',
  }));
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
