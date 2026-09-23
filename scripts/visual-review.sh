#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT=".visual-review"
PORT="${VISUAL_REVIEW_PORT:-4178}"
BASE="${TARGET_URL:-}"

rm -rf "$OUT"
mkdir -p "$OUT/pages"

preview_pid=""
cleanup() {
  if [[ -n "$preview_pid" ]]; then
    kill "$preview_pid" >/dev/null 2>&1 || true
    wait "$preview_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -z "$BASE" ]]; then
  python3 scripts/preview.py --port "$PORT" >"$OUT/preview.log" 2>&1 &
  preview_pid=$!
  BASE="http://127.0.0.1:$PORT"

  node - "$BASE" <<'NODE'
const base=process.argv[2];
const deadline=Date.now()+15000;
(async()=>{
  while(Date.now()<deadline){
    try{
      const r=await fetch(base,{cache:'no-store'});
      if(r.ok) process.exit(0);
    }catch{}
    await new Promise(r=>setTimeout(r,200));
  }
  console.error('Preview server did not become ready:',base);
  process.exit(1);
})();
NODE
fi

PW="playwright@1.55.0"
pnpm dlx "$PW" install chromium >/dev/null

mix_url() {
  node - "$BASE" "$1" "$2" "$3" <<'NODE'
const [base,scene,motion,theme='violet']=process.argv.slice(2);
const mix={
  musicSource:'library',
  track:'broken-glimmers',
  music:70,
  autoMix:false,
  preset:'focus',
  route:'speakers',
  hz:40,
  carrier:340,
  beats:true,
  beatVolume:14,
  master:35,
  pad:76,
  melody:20,
  rain:0,
  ocean:0,
  noise:8,
  noiseType:'pink',
  score:'horizon',
  theme,
  scene,
  motion:Number(motion),
  brightness:theme==='mono'?94:80,
  eco:false,
  breathing:false,
  keepAwake:false,
  blackout:false,
  timer:0,
  seed:604
};
console.log(base+'/#mix='+encodeURIComponent(JSON.stringify(mix)));
NODE
}

capture() {
  local scene="$1" motion="$2" wait_ms="$3" label="$4" theme="${5:-violet}"
  local dir="$OUT/pages/$scene"
  mkdir -p "$dir"
  local url
  url="$(mix_url "$scene" "$motion" "$theme")"
  pnpm dlx "$PW" screenshot \
    --browser=chromium \
    --viewport-size="1440,1100" \
    --wait-for-timeout="$wait_ms" \
    "$url" "$dir/$label.png" >/dev/null
}

# Two timing samples at everyday pace and two at max pace for the scenes whose
# motion is easiest to evaluate from still-frame displacement.
for scene in tides dunes orbit rain; do
  capture "$scene" 40 600  "motion40-early"
  capture "$scene" 40 5600 "motion40-late"
  capture "$scene" 100 600  "motion100-early"
  capture "$scene" 100 5600 "motion100-late"
done

# Graphite uses scene-specific prismatic lighting across the full scene set.
for scene in tides dunes orbit rain; do
  capture "$scene" 60 600  "graphite-early" "mono"
  capture "$scene" 60 5600 "graphite-late"  "mono"
done

mkdir -p "$OUT/pages/mobile"
pnpm dlx "$PW" screenshot \
  --browser=chromium \
  --viewport-size="390,844" \
  --wait-for-timeout=1200 \
  "$BASE/" "$OUT/pages/mobile/default-graphite-orbit.png" >/dev/null

GIT_SHA="${GITHUB_SHA:-unknown}" RUN_ID="${GITHUB_RUN_ID:-local}" BASE_URL="$BASE" node <<'NODE'
const fs=require('fs');
const scenes=[
  ['tides','Living Contours'],
  ['dunes','Silk Drift'],
  ['orbit','Energy Orbit'],
  ['rain','Wet Glass'],
];
const captures=[];
for(const [route,name] of scenes){
  for(const motion of [40,100]){
    for(const timing of ['early','late']){
      captures.push({
        route,
        name,
        theme:'violet',
        motion,
        timing,
        viewport:{width:1440,height:1100},
        screenshot:`pages/${route}/motion${motion}-${timing}.png`
      });
    }
  }
}
for(const [route,name] of scenes){
  for(const timing of ['early','late']){
    captures.push({
      route,
      name:`${name} · Graphite`,
      theme:'mono',
      motion:60,
      timing,
      viewport:{width:1440,height:1100},
      screenshot:`pages/${route}/graphite-${timing}.png`
    });
  }
}
captures.push({
  route:'mobile-default',
  name:'Fresh mobile default · Graphite Energy Orbit',
  theme:'mono',
  motion:60,
  timing:'settled',
  viewport:{width:390,height:844},
  screenshot:'pages/mobile/default-graphite-orbit.png'
});
fs.writeFileSync('.visual-review/manifest.json',JSON.stringify({
  commit:process.env.GIT_SHA,
  runId:process.env.RUN_ID,
  baseUrl:process.env.BASE_URL,
  purpose:'Undertone immersive layout and audio-reactive motion pre-merge review',
  note:'Static timing samples validate motion displacement. Audio-reactive spectral mapping is covered by deterministic tests; screenshots do not autoplay audio.',
  routes:scenes.map(([route,name])=>({route,name})),
  captures
},null,2));
NODE

echo "Visual review captured $(find "$OUT/pages" -name '*.png' | wc -l | tr -d ' ') screenshots."
