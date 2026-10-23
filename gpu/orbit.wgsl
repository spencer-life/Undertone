// Three interwoven orbital ribbons. Finite twisted bands leave real negative
// space. Bracketed surface intersections keep the geometry in focus; normals,
// front-to-back transmission and selective HDR light give crossings real depth.
struct OrbitParams {
 viewport: vec4f, dynamics: vec4f,
 background: vec4f, low: vec4f, primary: vec4f, secondary: vec4f,
 highlight: vec4f, style: vec4f,
}
@group(0) @binding(0) var<uniform> params: OrbitParams;
const ORBIT_RADIUS: f32 = 0.46;
fn rotate(p: vec2f, angle: f32) -> vec2f {
 let c=cos(angle); let s=sin(angle);
 return vec2f(c*p.x-s*p.y,s*p.x+c*p.y);
}
fn fieldHash(cell: vec2f) -> vec3f {
 var p=fract(vec3f(cell.xyx)*vec3f(0.1031,0.1030,0.0973));
 p+=dot(p,p.yxz+33.33);
 return fract((p.xxy+p.yzz)*p.zyx);
}
fn surroundings(world: vec2f, time: f32, seed: f32) -> vec3f {
 let grid=world*118.0;
 let cell=floor(grid);
 let random=fieldHash(cell+vec2f(seed*0.017,seed*0.031));
 let pixelsPerCell=min(params.viewport.x,params.viewport.y)/118.0;
 let kernel=min(1.05,pixelsPerCell*0.42);
 let margin=kernel/pixelsPerCell+0.02;
 let point=cell+margin+random.xy*(1.0-2.0*margin);
 let pixels=length(grid-point)*pixelsPerCell;
 // A sparse, stationary field. Nothing flashes or twinkles behind the controls.
 let star=(1.0-smoothstep(kernel*0.10,kernel,pixels))*select(0.0,1.0,random.z>0.965);
 let centerClear=smoothstep(0.10,0.25,length(world));
 var sky=mix(params.primary.rgb,vec3f(0.72,0.82,0.96),0.78)
  *star*(0.06+0.24*pow(random.z,35.0))*centerClear;
 let field=rotate(world,-0.18+0.025*sin(time*0.025));
 let polar=vec2f(field.x/0.79,field.y/0.245);
 let angle=atan2(polar.y,polar.x);
 let radial=length(polar);
 for(var j=0;j<3;j++){
  let index=f32(j);
  let fieldRadius=0.84+index*0.095+0.028*sin(angle*3.0+seed*0.003+time*0.035);
  let distance=abs(radial-fieldRadius);
  let filament=exp(-distance*distance/0.000065);
  let falloff=pow(0.5+0.5*cos(angle*2.0+index*1.8-time*0.045),3.0);
  sky+=mix(params.primary.rgb,params.secondary.rgb,index*0.5)*filament*falloff*0.035;
 }
 let atmosphere=exp(-dot(world/vec2f(0.70,0.37),world/vec2f(0.70,0.37))*3.0);
 return sky+params.low.rgb*atmosphere*0.045+params.background.rgb*0.12;
}
struct RibbonBasis { azimuth: f32, inclination: f32, phase: f32 }
fn intoRibbon(p: vec3f, basis: RibbonBasis) -> vec3f {
 let xy=rotate(p.xy,basis.azimuth);
 let yz=rotate(vec2f(xy.y,p.z),basis.inclination);
 return vec3f(xy.x,yz);
}
fn worldNormal(n: vec3f, basis: RibbonBasis) -> vec3f {
 let yz=rotate(n.yz,-basis.inclination);
 let xy=rotate(vec2f(n.x,yz.x),-basis.azimuth);
 return normalize(vec3f(xy,yz.y));
}
// x: orbital angle, y: across the band, z: signed surface distance, w: half-width.
fn ribbonCoordinates(p: vec3f, basis: RibbonBasis, index: f32) -> vec4f {
 let q=intoRibbon(p,basis);
 let theta=atan2(q.y,q.x);
 let radius=0.70+index*0.035+0.045*sin(theta*3.0+basis.phase);
 let height=0.085*sin(theta*2.0+basis.phase);
 let twist=theta*2.0+basis.phase*0.38;
 let c=cos(twist); let s=sin(twist);
 let delta=vec2f(length(q.xy)-radius,q.z-height);
 return vec4f(theta,dot(delta,vec2f(c,s)),dot(delta,vec2f(-s,c)),
  0.105+0.025*sin(theta*2.0-basis.phase));
}
struct Material { color: vec3f, opacity: f32 }
fn ribbon(p: vec3f, basis: RibbonBasis, index: f32, time: f32) -> Material {
 let coordinates=ribbonCoordinates(p,basis,index);
 let theta=coordinates.x; let across=coordinates.y; let width=coordinates.w;
 let direction=vec2f(cos(theta),sin(theta));
 let twist=theta*2.0+basis.phase*0.38;
 let c=cos(twist); let s=sin(twist);
 let radial=max(0.001,length(intoRibbon(p,basis).xy));
 let angular=-2.0*across+s*0.135*cos(theta*3.0+basis.phase)-c*0.17*cos(theta*2.0+basis.phase);
 let localNormal=normalize(vec3f(-s*direction+(angular/radial)*vec2f(-direction.y,direction.x),c));
 let normal=worldNormal(localNormal,basis);
 // Only the subpixel edge is antialiased. The surface has no density/focus blur.
 // Grazing bands project the same world-space edge into fewer screen pixels.
 let edgeAA=0.70/(min(params.viewport.x,params.viewport.y)*ORBIT_RADIUS*params.style.y*max(0.12,abs(normal.z)));
 let opacity=(1.0-smoothstep(width-edgeAA,width+edgeAA,abs(across)))*0.90;
 if(opacity<0.001){return Material(vec3f(0.0),0.0);}
 let light=normalize(vec3f(-0.48,-0.68,0.72));
 let diffuse=abs(dot(normal,light));
 let facing=abs(normal.z);
 let rim=pow(1.0-facing,3.0);
 let reflection=reflect(-light,normal*select(-1.0,1.0,normal.z>=0.0));
 let specular=pow(max(0.0,reflection.z),28.0);
 // A narrow reflected light strip makes curvature legible, as in a studio
 // material study, while Fresnel keeps the strongest reflection at the rim.
 let reflectedView=reflect(vec3f(0.0,0.0,-1.0),normal);
 let stripAxis=abs(dot(reflectedView.xz,vec2f(0.82,0.5724)));
 let strip=smoothstep(0.94,0.99,stripAxis)*(1.0-smoothstep(0.10,0.38,abs(reflectedView.y-0.10)));
 let fresnel=0.04+0.96*pow(1.0-facing,5.0);
 let edge=pow(clamp(abs(across)/width,0.0,1.0),8.0);
 let travel=pow(0.5+0.5*cos(theta-time*0.22-index*2.1),14.0);
 let chroma=0.5+0.5*sin(theta+index*2.0+basis.phase*0.2);
 let tint=mix(params.primary.rgb,params.secondary.rgb,chroma);
 let depth=mix(0.30,1.0,smoothstep(-0.8,0.65,p.z));
 let resolved=1.0-smoothstep(1.5,3.0,edgeAA*430.0);
 let filaments=pow(0.5+0.5*cos(across*430.0+sin(theta*7.0+basis.phase)*1.2),10.0)*resolved;
 let lit=tint*(0.10+diffuse*0.46+rim*0.58+edge*0.30+filaments*0.15);
 let highlight=mix(params.highlight.rgb,vec3f(1.75,1.85,2.0),0.55);
 let radiance=(lit+highlight*(specular*1.15+strip*(0.20+fresnel*0.75)+travel*0.08+edge*rim*0.48))*depth*1.85;
 return Material(radiance,opacity);
}
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
 let aspect=max(0.01,params.viewport.z);
 let time=params.dynamics.x;
 let seed=params.dynamics.y;
 let energy=clamp(params.dynamics.w,0.0,1.0);
 let radius=ORBIT_RADIUS*max(0.1,params.style.y);
 let world=(uv-vec2f(0.5,0.43))*vec2f(aspect,1.0)/min(aspect,1.0);
 let screen=world/radius;
 let radial2=dot(screen,screen);
 let background=surroundings(world,time,seed)*clamp(params.dynamics.z,0.0,1.0);
 if(radial2>=1.075){return vec4f(background,1.0);}
 let halfDepth=sqrt(max(0.0,1.075-radial2));
 let samples=72;
 let step=2.0*halfDepth/f32(samples);
 var bases: array<RibbonBasis,3>;
 var previous: array<f32,3>;
 let frontPoint=vec3f(screen*(1.0-0.10*halfDepth),halfDepth);
 for(var j=0;j<3;j++){
  let index=f32(j);
  bases[j]=RibbonBasis(-0.42+index*1.07+time*0.035,
   0.92+index*0.77+0.13*sin(time*0.09+index*1.7),
   time*0.13+index*2.0944+seed*0.003);
  previous[j]=ribbonCoordinates(frontPoint,bases[j],index).z;
 }
 var radiance=vec3f(0.0);
 var transmission=1.0;
 for(var k=1;k<=samples;k++){
  let depth=halfDepth-f32(k)*step;
  let point=vec3f(screen*(1.0-0.10*depth),depth);
  var hits: array<f32,6>;
  for(var i=0;i<6;i++){hits[i]=-2.0;}
  for(var j=0;j<3;j++){
   let distance=ribbonCoordinates(point,bases[j],f32(j)).z;
   // A grazing surface can enter and leave between same-sign coarse samples.
   // Probe quarters only near a possible tangency, preserving both crossings.
   let ambiguous=(distance<0.0)==(previous[j]<0.0)&&min(abs(distance),abs(previous[j]))<step*0.75;
   let divisions=select(1,4,ambiguous);
   var nearDepth=depth+step;
   var nearDistance=previous[j];
   var hitCount=0;
   for(var part=0;part<divisions;part++){
    var farDepth=depth+step*(1.0-f32(part+1)/f32(divisions));
    var farDistance=distance;
    if(part+1<divisions){
     let subPoint=vec3f(screen*(1.0-0.10*farDepth),farDepth);
     farDistance=ribbonCoordinates(subPoint,bases[j],f32(j)).z;
    }
    if((farDistance<0.0)!=(nearDistance<0.0)&&hitCount<2){
     var bracketNear=nearDepth;
     var bracketFar=farDepth;
     var bracketDistance=nearDistance;
     // Resolve the true surface to a fraction of a pixel, without a fog kernel.
     for(var refine=0;refine<6;refine++){
      let middle=(bracketNear+bracketFar)*0.5;
      let middlePoint=vec3f(screen*(1.0-0.10*middle),middle);
      let middleDistance=ribbonCoordinates(middlePoint,bases[j],f32(j)).z;
      if((middleDistance<0.0)==(bracketDistance<0.0)){
       bracketNear=middle;bracketDistance=middleDistance;
      }else{bracketFar=middle;}
     }
     hits[j*2+hitCount]=(bracketNear+bracketFar)*0.5;
     hitCount++;
    }
    nearDepth=farDepth;nearDistance=farDistance;
   }
   previous[j]=distance;
  }
  // More than one ribbon may cross this interval: preserve their depth order.
  for(var crossing=0;crossing<6;crossing++){
   var nearest=-2.0;var selected=-1;
   for(var j=0;j<6;j++){if(hits[j]>nearest){nearest=hits[j];selected=j;}}
   if(selected<0){break;}
   hits[selected]=-2.0;
   let hitPoint=vec3f(screen*(1.0-0.10*nearest),nearest);
   let band=selected/2;
   let material=ribbon(hitPoint,bases[band],f32(band),time);
   radiance+=transmission*material.opacity*material.color;
   transmission*=1.0-material.opacity;
  }
  if(transmission<0.005){break;}
 }
 let exposure=clamp(params.dynamics.z,0.0,1.0)*(1.05+energy*0.10);
 return vec4f(max(radiance*exposure+background*transmission,vec3f(0.0)),1.0);
}
