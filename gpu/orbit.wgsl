// Energy Orbit: translucent folded sheets in a sampled 3D volume.
// Front-to-back transmittance gives crossings real occlusion rather than an
// additive stack of flat curves. The existing HDR/bloom pipeline is unchanged.
struct OrbitParams {
 viewport: vec4f, dynamics: vec4f,
 background: vec4f, low: vec4f, primary: vec4f, secondary: vec4f,
 highlight: vec4f, style: vec4f,
}
@group(0) @binding(0) var<uniform> params: OrbitParams;
fn rotate(p: vec2f, angle: f32) -> vec2f {
 let c=cos(angle); let s=sin(angle);
 return vec2f(c*p.x-s*p.y,s*p.x+c*p.y);
}
fn gaussian(value: f32, width: f32) -> f32 {
 let x=value/max(width,0.0001); return exp(-x*x);
}
struct SheetBasis { azimuth: f32, inclination: f32, phase: f32 }
fn intoSheet(p: vec3f, basis: SheetBasis) -> vec3f {
 let xy=rotate(p.xy,basis.azimuth);
 let yz=rotate(vec2f(xy.y,p.z),basis.inclination);
 return vec3f(xy.x,yz);
}
fn worldNormal(n: vec3f, basis: SheetBasis) -> vec3f {
 let yz=rotate(n.yz,-basis.inclination);
 let xy=rotate(vec2f(n.x,yz.x),-basis.azimuth);
 return normalize(vec3f(xy,yz.y));
}
struct Material { color: vec3f, density: f32 }
fn sheet(p: vec3f, basis: SheetBasis, index: f32, thickness: f32, time: f32) -> Material {
 let q=intoSheet(p,basis);
 let a=q.x*2.8+basis.phase;
 let b=q.z*1.65-basis.phase*0.61;
 let c=q.z*4.1+q.x*0.7-basis.phase*0.8;
 let sa=sin(a); let ca=cos(a); let sb=sin(b); let cb=cos(b); let cc=cos(c);
 let height=0.42*sa*cb+0.13*sin(c);
 let dx=1.176*ca*cb+0.091*cc;
 let dz=-0.693*sa*sb+0.533*cc;
 let distance=(q.y-(index-1.0)*0.32-height)/sqrt(1.0+dx*dx+dz*dz);
 let edge=abs(q.z+0.22*sin(q.x*1.7+basis.phase*0.6));
 let finiteSheet=1.0-smoothstep(0.38,0.82,edge);
 let sphereEnvelope=1.0-smoothstep(0.84,1.035,length(p));
 let density=gaussian(distance,thickness)*finiteSheet*sphereEnvelope;
 let n=worldNormal(normalize(vec3f(-dx,1.0,-dz)),basis);
 let light=abs(dot(n,normalize(vec3f(-0.46,-0.64,0.62))));
 let facing=abs(n.z);
 let rim=pow(1.0-facing,3.0);
 let frontal=smoothstep(-0.4,0.65,p.z);
 let chroma=0.5+0.5*sin(q.x*1.4-q.z*1.7+index*1.5+time*0.08);
 var color=mix(params.primary.rgb,params.secondary.rgb,chroma);
 let traveling=gaussian(q.x-0.5*sin(time*0.50+index*2.1),0.26)*gaussian(q.z-0.32,0.65);
 color=mix(color,params.highlight.rgb,traveling*0.24);
 // A modest internal weave, not a stack of equally bright contour lines.
 let weave=pow(0.5+0.5*cos(q.x*34.0+q.z*12.0+index*3.4),12.0);
 let resolved=1.0-smoothstep(0.10,0.20,thickness*3.0);
 let lightLevel=(0.18+light*0.76+rim*0.64+traveling*0.82+weave*resolved*0.13)
   *mix(0.36,1.0,frontal);
 return Material(color*lightLevel*1.75,density);
}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
 let aspect=max(0.01,params.viewport.z);
 let time=params.dynamics.x;
 let seed=params.dynamics.y;
 let energy=clamp(params.dynamics.w,0.0,1.0);
 let radius=0.355*max(0.1,params.style.y);
 let screen=(uv-vec2f(0.5,0.43))*vec2f(aspect,1.0)/min(aspect,1.0)/radius;
 let radial2=dot(screen,screen);
 let background=params.background.rgb*0.12;
 if(radial2>=1.075){return vec4f(background,1.0);}
 let halfDepth=sqrt(max(0.0,1.075-radial2));
 // Fixed bounds keep the cost predictable. The density kernel widens just
 // enough at coarse steps to avoid depth-slice banding without temporal noise.
 let samples=36;
 let step=2.0*halfDepth/f32(samples);
 let thickness=sqrt(0.022*0.022+step*step*0.08);
 var bases: array<SheetBasis,3>;
 for(var j=0;j<3;j++){
  let index=f32(j);
  bases[j]=SheetBasis(-0.60+index*0.93+0.20*sin(time*0.10+index*1.7),
    0.52+index*1.01+time*0.043,
    time*0.16+index*1.8+seed*0.003);
 }
 var radiance=vec3f(0.0);
 var transmission=1.0;
 for(var k=0;k<samples;k++){
  let depth=halfDepth-(f32(k)+0.5)*step;
  // Foreground folds are slightly larger than the rear: restrained perspective.
  let point=vec3f(screen*(1.0-0.10*depth),depth);
  var density=0.0;
  var emission=vec3f(0.0);
  for(var j=0;j<3;j++){
   let material=sheet(point,bases[j],f32(j),thickness,time);
   density+=material.density;
   emission+=material.color*material.density;
  }
  let alpha=1.0-exp(-density*step*5.0*mix(0.85,1.0,clamp(params.style.w,0.0,1.0)));
  radiance+=transmission*alpha*emission/max(density,0.00001);
  transmission*=1.0-alpha;
 }
 // The orb is implied by folded material and negative space, never a solid
 // sphere fill or a continuous diagrammatic outline. Music only lifts radiance.
 let exposure=clamp(params.dynamics.z,0.0,1.0)*(1.05+energy*0.10);
 return vec4f(max(radiance*exposure+background*transmission,vec3f(0.0)),1.0);
}
