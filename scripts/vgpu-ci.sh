#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT=.vgpu-ci
PORT="${VGPU_CI_PORT:-4182}"
BASE="http://127.0.0.1:$PORT"
SESSION=undertone-vgpu-ci
rm -rf "$OUT"
mkdir -p "$OUT"

echo '==> Verify device-backed rendering'
if ! pnpm exec vgpu doctor --pretty >"$OUT/doctor.txt" 2>&1; then
  pnpm exec vgpu install-software-renderer | tee "$OUT/install-software-renderer.txt"
  pnpm exec vgpu doctor --pretty >"$OUT/doctor-after-fallback.txt" 2>&1
fi
pnpm check:orbit >"$OUT/check-orbit.txt" 2>&1
pnpm render:orbit >"$OUT/render-orbit.txt" 2>&1
pnpm build:orbit >"$OUT/build-orbit.txt" 2>&1
cp artifacts/orbit-t0.ppm artifacts/orbit-t25.ppm "$OUT/"
# A small, public-source review snapshot enables exact offline inspection. No
# credentials, .git, package caches, or 105 MB music library enter this artifact.
tar -czf "$OUT/review-runtime.tgz" index.html styles.css layout.css app.js visuals.js \
  orbit-bridge.js black-hole-bridge.js audio.js audio-worklet.js music-library.js \
  tracks.js webmcp.js sw.js manifest.webmanifest icons vendor gpu scripts tests package.json
pnpm exec vgpu docs cat /guides/no-bundler.docs.md >"$OUT/package-docs.txt"

npm install --global agent-browser@0.33.0 >/dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq libvulkan1 mesa-vulkan-drivers xvfb xauth imagemagick >/dev/null
agent-browser doctor --webgpu --headed >"$OUT/agent-browser-doctor.txt" 2>&1
python3 scripts/preview.py --port "$PORT" >"$OUT/preview.log" 2>&1 &
PREVIEW_PID=$!
cleanup(){
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  kill "$PREVIEW_PID" >/dev/null 2>&1 || true
  wait "$PREVIEW_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT
node - "$BASE" <<'NODE'
const base=process.argv[2],deadline=Date.now()+15000;
while(Date.now()<deadline){try{if((await fetch(base)).ok)process.exit(0);}catch{}await new Promise(r=>setTimeout(r,200));}
throw Error('Preview did not start');
NODE
URL="$(node - "$BASE" <<'NODE'
const mix={scene:'orbit',theme:'mono',motion:60,brightness:100,musicSource:'generated',keepAwake:false,seed:604};
console.log(process.argv[2]+'/?renderer=webgpu#mix='+encodeURIComponent(JSON.stringify(mix)));
NODE
)"
ab(){ agent-browser --session "$SESSION" --webgpu --headed "$@"; }
ab open "$URL"
ab set viewport 1440 900 >/dev/null

wait_scene(){
  local status=''
  for attempt in $(seq 1 60); do
    status="$(ab eval '(()=>{const b=document.querySelector("#visual"),s=window.undertoneDebug.state.scene;const status=s==="horizon"?b.dataset.blackHoleStatus:b.dataset.orbitStatus;if(status==="unavailable")throw Error(b.dataset.blackHoleError||b.dataset.orbitError);return status==="ready"&&b.dataset.renderer==="webgpu"?"ready":status;})()' | tail -1 | tr -d '"\r')"
    if [[ "$status" == ready ]]; then return; fi
    ab wait 1000 >/dev/null
  done
  ab eval 'document.querySelector("#visual").dataset' | tee "$OUT/readiness-failure.txt"
  echo "GPU scene did not become ready (last state: $status)" >&2
  return 1
}
capture(){
  local name="$1" output path
  output="$(ab screenshot)"
  path="$(printf '%s\n' "$output" | sed -n 's/.*Screenshot saved to \(.*\.png\)$/\1/p' | tail -1)"
  [[ -n "$path" && -f "$path" ]] || { echo "Missing capture: $name" >&2; return 1; }
  cp "$path" "$OUT/$name.png"
}
state_capture(){ ab eval "$2" >/dev/null; ab wait 500 >/dev/null; capture "$1"; }
wait_scene
capture orbit-webgpu
ab wait 3000 >/dev/null
capture orbit-webgpu-later
state_capture sound-picker 'document.querySelector("#soundQuickButton").click()'
state_capture music-picker 'document.querySelector("#musicQuickButton").click()'
state_capture scene-picker 'document.querySelector("#sceneQuickButton").click()'
state_capture color-picker 'document.querySelector("#colorQuickButton").click()'
state_capture timer-picker 'document.querySelector("#timerButton").click()'
state_capture route-picker 'document.querySelector("#routeQuick").click()'
ab eval 'document.querySelector("#routeQuick").click(); window.undertoneDebug.change({scene:"horizon",theme:"mono",motion:60,brightness:100}); true' >/dev/null
wait_scene
capture event-horizon
ab wait 3000 >/dev/null
capture event-horizon-later
# Freeze must stop GPU submissions, not merely stop a uniform while a second RAF runs.
ab eval 'window.undertoneDebug.change({motion:0}); true' >/dev/null
ab wait 700 >/dev/null
ab eval 'window.__horizonFrame=document.querySelector("[data-scene-renderer=horizon]").dataset.frameCount; true' >/dev/null
ab wait 700 >/dev/null
ab eval 'if(document.querySelector("[data-scene-renderer=horizon]").dataset.frameCount!==window.__horizonFrame)throw Error("Still mode kept submitting GPU work"); true' >/dev/null
state_capture event-horizon-violet 'window.undertoneDebug.change({theme:"violet"}); true'
for spec in 'mobile:390:844' 'ipad:834:1194'; do
  IFS=: read -r name width height <<<"$spec"
  ab set viewport "$width" "$height" >/dev/null
  ab wait 700 >/dev/null
  capture "event-horizon-$name"
done
ab set viewport 1440 900 >/dev/null
ab eval 'window.undertoneDebug.change({scene:"orbit",theme:"mono",motion:60}); true' >/dev/null
wait_scene
ab eval 'if(document.querySelector("[data-scene-renderer=horizon]"))throw Error("Event horizon canvas leaked after leaving"); true' >/dev/null
state_capture tune 'document.querySelector("#dockControls").click()'
state_capture tune-about 'document.querySelector("#tab-about").click()'
echo 'GPU checks passed: compiled shaders, real pixels, scene startup, still mode, resize and teardown.'
