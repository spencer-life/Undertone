#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT=".vgpu-ci"
PORT="${VGPU_CI_PORT:-4182}"
BASE="http://127.0.0.1:$PORT"
SESSION="undertone-vgpu-ci"

rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> Verify vgpu can acquire an adapter and render"
if ! pnpm exec vgpu doctor --pretty >"$OUT/doctor.txt" 2>&1; then
  cat "$OUT/doctor.txt"
  echo "vgpu doctor failed; installing the documented software renderer fallback"
  pnpm exec vgpu install-software-renderer | tee "$OUT/install-software-renderer.txt"
  pnpm exec vgpu doctor --pretty | tee "$OUT/doctor-after-fallback.txt"
else
  cat "$OUT/doctor.txt"
fi

echo "==> Validate every WGSL module with device-backed validation"
pnpm check:orbit | tee "$OUT/check-orbit.txt"

echo "==> Deterministic seven-pass Node render + pixel assertions"
pnpm render:orbit | tee "$OUT/render-orbit.txt"
cp -f artifacts/orbit-t0.ppm "$OUT/" 2>/dev/null || true
cp -f artifacts/orbit-t25.ppm "$OUT/" 2>/dev/null || true

echo "==> Rebuild browser bundle"
pnpm build:orbit | tee "$OUT/build-orbit.txt"

echo "==> Install the browser harness documented by vgpu"
npm install --global agent-browser@0.33.0 >/dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq libvulkan1 mesa-vulkan-drivers xvfb xauth imagemagick >/dev/null
agent-browser doctor --webgpu --headed | tee "$OUT/agent-browser-doctor.txt"

echo "==> Start Undertone preview"
python3 scripts/preview.py --port "$PORT" >"$OUT/preview.log" 2>&1 &
PREVIEW_PID=$!
cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  kill "$PREVIEW_PID" >/dev/null 2>&1 || true
  wait "$PREVIEW_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

node - "$BASE" <<'NODE'
const base=process.argv[2],deadline=Date.now()+15000;
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

URL="$(node - "$BASE" <<'NODE'
const base=process.argv[2];
const mix={
  musicSource:'generated',track:'broken-glimmers',music:70,autoMix:false,
  preset:'focus',route:'speakers',hz:40,carrier:340,beats:true,beatVolume:14,
  master:35,pad:76,melody:20,rain:0,ocean:0,noise:8,noiseType:'pink',
  score:'horizon',theme:'violet',scene:'orbit',motion:100,brightness:80,
  eco:false,breathing:false,keepAwake:false,blackout:false,timer:0,seed:604
};
console.log(base+'/?renderer=webgpu#mix='+encodeURIComponent(JSON.stringify(mix)));
NODE
)"

echo "==> Verify the real browser WebGPU path through SwiftShader"
agent-browser --session "$SESSION" --webgpu --headed open "$URL"
agent-browser --session "$SESSION" --webgpu --headed wait 6000
agent-browser --session "$SESSION" --webgpu --headed eval 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))' >/dev/null

META="$(agent-browser --session "$SESSION" --webgpu --headed eval 'new Promise((resolve)=>{const deadline=Date.now()+10000;const tick=()=>{const base=document.querySelector("#visual");const result={hasGpu:Boolean(navigator.gpu),renderer:base?.dataset?.renderer||null,orbitStatus:base?.dataset?.orbitStatus||null,orbitError:base?.dataset?.orbitError||null,gpuLayerVisible:Boolean(base?.nextElementSibling?.tagName==="CANVAS"&&base.nextElementSibling.style.display!=="none")};if(result.renderer==="webgpu"&&result.orbitStatus==="ready")resolve(JSON.stringify(result));else if(Date.now()>deadline)resolve(JSON.stringify(result));else setTimeout(tick,100)};tick()})')"
printf '%s\n' "$META" | tee "$OUT/browser-meta-raw.txt"
CLEAN_META="$(printf '%s' "$META" | sed 's/\\"/"/g')"
printf '%s\n' "$CLEAN_META" | tee "$OUT/browser-meta.txt"
printf '%s' "$CLEAN_META" | grep -q '"hasGpu":true'
printf '%s' "$CLEAN_META" | grep -q '"renderer":"webgpu"'
printf '%s' "$CLEAN_META" | grep -q '"orbitStatus":"ready"'
printf '%s' "$CLEAN_META" | grep -q '"gpuLayerVisible":true'
if printf '%s' "$CLEAN_META" | grep -Eq 'Preview error|WebGPU is not available|No WebGPU adapter was found|"orbitError":"[^"]+'; then
  echo "Browser reported a WebGPU error"
  exit 1
fi

SHOT_OUTPUT="$(agent-browser --session "$SESSION" --webgpu --headed screenshot)"
printf '%s\n' "$SHOT_OUTPUT" | tee "$OUT/screenshot-command.txt"
SHOT_PATH="$(printf '%s\n' "$SHOT_OUTPUT" | sed -n 's/.*Screenshot saved to \(.*\.png\)$/\1/p' | tail -1)"
if [[ -z "$SHOT_PATH" || ! -f "$SHOT_PATH" ]]; then
  echo "agent-browser did not return a usable screenshot path"
  exit 1
fi
cp "$SHOT_PATH" "$OUT/orbit-webgpu.png"
STDDEV="$(identify -format '%[fx:standard_deviation]' "$OUT/orbit-webgpu.png")"
printf '%s\n' "$STDDEV" | tee "$OUT/screenshot-standard-deviation.txt"
# ImageMagick 6 on GitHub-hosted Ubuntu reports standard deviation on a
# normalized 0..1 scale. Reject essentially uniform/black captures.
awk -v v="$STDDEV" 'BEGIN { exit !(v > 0.02) }'

echo "vgpu CI passed: shader validation, doctor, deterministic pixels, and browser WebGPU path."
