/* Continuous texture generator for Undertone.
   Three stereo outputs (noise, rain and ocean) are generated from state that
   lives in the processor, so no finite buffer is ever restarted at a seam. */
'use strict';

class UndertoneTextureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = sampleRate;
    this.seed = 0x4f1bbcdc;
    this.noiseBrown = [0, 0];
    this.noisePink = [{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0},{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0}];
    this.rainBrown = [0, 0];
    this.rainPink = [{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0},{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0}];
    this.oceanBrown = [0, 0];
    this.oceanPink = [{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0},{b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0}];
    this.rain = [{drops:[]},{drops:[]}];
    this.ocean = [0, 0];
    this.oceanFast = [0, 0];
    this.wave = [0, 0];
    this.phase = [0, Math.PI * .7];
    this.noiseTarget = 'brown';
    this.noiseWeights = {brown:1,pink:0,white:0};
    this.port.onmessage = event => {
      const data = event.data || {};
      if (data.type === 'settings' && ['brown','pink','white'].includes(data.noiseType) && data.noiseType !== this.noiseTarget) {
        this.noiseTarget = data.noiseType;
      }
      if (data.type === 'seed' && Number.isFinite(data.seed)) this.seed = (data.seed >>> 0) || 1;
    };
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  white() { return this.random() * 2 - 1; }
  colored(channel, type, brownState, pinkState) {
    const w = this.white();
    if (type === 'white') return w;
    if (type === 'brown') { brownState[channel] = (brownState[channel] + .018 * w) / 1.018; return brownState[channel] * 3.25; }
    const p = pinkState[channel];
    p.b0=.99886*p.b0+w*.0555179;p.b1=.99332*p.b1+w*.0750759;p.b2=.969*p.b2+w*.153852;p.b3=.8665*p.b3+w*.3104856;p.b4=.55*p.b4+w*.532952;p.b5=-.7616*p.b5-w*.016898;
    const value=(p.b0+p.b1+p.b2+p.b3+p.b4+p.b5+p.b6+w*.5362)*.11;p.b6=w*.115926;return value;
  }
  process(inputs, outputs) {
    const noise=outputs[0]||[],rain=outputs[1]||[],ocean=outputs[2]||[],frames=noise[0]?noise[0].length:128;
    for(let i=0;i<frames;i++){
      const target=this.noiseTarget;for(const type of ['brown','pink','white'])this.noiseWeights[type]+=((type===target?1:0)-this.noiseWeights[type])/(this.sampleRate*.45);
      const weightSum=this.noiseWeights.brown+this.noiseWeights.pink+this.noiseWeights.white;for(const type of ['brown','pink','white'])this.noiseWeights[type]/=weightSum;
      for(let ch=0;ch<2;ch++){
        const values={white:this.colored(ch,'white',this.noiseBrown,this.noisePink),pink:this.colored(ch,'pink',this.noiseBrown,this.noisePink),brown:this.colored(ch,'brown',this.noiseBrown,this.noisePink)};
        if(noise[ch])noise[ch][i]=(values.brown*this.noiseWeights.brown+values.pink*this.noiseWeights.pink+values.white*this.noiseWeights.white)*.19;
        const rainColor=this.colored(ch,'pink',this.rainBrown,this.rainPink),r=this.rain[ch];
        if(this.random()<.00072)r.drops.push({phase:0,frequency:1700+this.random()*5800,decay:.992+this.random()*.004,level:.14+this.random()*.12});
        let droplets=0;for(let d=r.drops.length-1;d>=0;d--){const drop=r.drops[d];droplets+=Math.sin(drop.phase)*drop.level;drop.phase+=2*Math.PI*drop.frequency/this.sampleRate;drop.level*=drop.decay;if(drop.level<.001)r.drops.splice(d,1);}
        if(rain[ch])rain[ch][i]=(rainColor*.22+droplets)*.46;
        const low=this.colored(ch,'brown',this.oceanBrown,this.oceanPink);this.oceanFast[ch]+=(low-this.oceanFast[ch])*.008;this.ocean[ch]+=(this.oceanFast[ch]-this.ocean[ch])*.0008;this.wave[ch]+=(this.ocean[ch]-this.wave[ch])*.00065;
        this.phase[ch]=(this.phase[ch]+2*Math.PI*.075/this.sampleRate)%(2*Math.PI);
        const swell=.66+.34*Math.sin(this.phase[ch]);
        if(ocean[ch])ocean[ch][i]=(this.oceanFast[ch]*.2+this.ocean[ch]*.42)*swell;
      }
    }
    return true;
  }
}
registerProcessor('undertone-textures', UndertoneTextureProcessor);
