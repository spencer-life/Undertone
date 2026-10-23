// Bound full-screen fragment cost without changing CSS framing or scene scale.
export function orbitRenderSize(width,height,dpr=1,eco=false){
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 const ratio=Math.max(0.5,Math.min(Number(dpr)||1,1.5));
 const scale=Math.min(ratio,Math.sqrt((eco?460800:921600)/(w*h)),2048/Math.max(w,h));
 return [Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)),scale];
}
