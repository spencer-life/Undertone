// Small deterministic software/hardware render check using the documented Node API.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { init, effect, target } from 'vgpu/node';
import { orbitPalette } from '../gpu/palettes.js';
const width=720,height=480,palette=orbitPalette('ocean');
const rgba=color=>[...color,1];
const gpu=await init();
try{
 const output=target(gpu,{size:[width,height],format:'rgba8unorm'});
 const orbit=effect(gpu,readFileSync(new URL('../gpu/orbit.wgsl',import.meta.url),'utf8'),{set:{params:{viewport:[width,height,width/height,1],dynamics:[0,604,.8,0],...Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,rgba(color)]))}}});
 await orbit.compile(output);
 const render=async time=>{orbit.set({params:{dynamics:[time,604,.8,0]}});orbit.draw(output);return new Uint8Array(await output.color.read({mipLevel:0,region:'all'}));};
 const first=await render(0),repeat=await render(0),later=await render(25);
 assert.deepEqual(first,repeat,'same uniforms must reproduce exactly');
 let difference=0,lit=0;
 for(let i=0;i<first.length;i+=4){if(Math.max(first[i],first[i+1],first[i+2])>60)lit++;for(let c=0;c<3;c++)difference+=Math.abs(first[i+c]-later[i+c]);}
 const meanDifference=difference/(width*height*3);assert(meanDifference>.1,'elapsed time must move the procedural scene');assert(lit>width*height*.01,'frame must contain visible orbital geometry');
 mkdirSync('artifacts',{recursive:true});
 for(const [name,pixels] of [['orbit-t0',first],['orbit-t25',later]]){
  const rgb=Buffer.alloc(width*height*3);for(let i=0,j=0;i<pixels.length;i+=4){rgb[j++]=pixels[i];rgb[j++]=pixels[i+1];rgb[j++]=pixels[i+2];}
  writeFileSync(`artifacts/${name}.ppm`,Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`),rgb]));
 }
 console.log(JSON.stringify({width,height,deterministic:true,meanMotionPixelDifference:meanDifference,visiblePixelFraction:lit/(width*height)},null,2));
}finally{gpu.dispose();}
