import { createOrbitRenderer } from '/vendor/energy-orbit.js';

const canvas=document.getElementById('orbit');
const status=document.getElementById('status');
const params=new URLSearchParams(location.search);

const theme=params.get('theme')||'violet';
const speed=Math.max(0,Math.min(6,Number(params.get('speed'))||1));
const brightness=Math.max(10,Math.min(100,Number(params.get('brightness'))||80));
const seed=Math.round(Number(params.get('seed'))||604);

let renderer=null;
let raf=0;
let start=performance.now();

function size(){
  const rect=canvas.getBoundingClientRect();
  return {
    width:Math.max(1,rect.width),
    height:Math.max(1,rect.height),
    dpr:Math.min(window.devicePixelRatio||1,1.5)
  };
}

async function boot(){
  try{
    if(!navigator.gpu)throw new Error('WebGPU is not available in this browser.');
    renderer=await createOrbitRenderer(canvas,{
      onFailure(error){
        status.dataset.state='error';
        status.textContent=error?.message||'WebGPU renderer failed.';
      }
    });
    status.dataset.state='ready';
    status.textContent=`Energy Orbit Lab · WebGPU · ${theme}`;
    const frame=now=>{
      const viewport=size();
      renderer.draw({
        ...viewport,
        time:(now-start)/1000*speed,
        seed,
        theme,
        brightness,
        energy:0
      });
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
  }catch(error){
    status.dataset.state='error';
    status.textContent=error?.message||String(error);
  }
}

window.addEventListener('pagehide',()=>{
  cancelAnimationFrame(raf);
  renderer?.dispose?.();
});
boot();
