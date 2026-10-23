#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT="${VGPU_CI_OUTPUT_DIR:-.vgpu-ci}"
PORT="${VGPU_CI_PORT:-4182}"
BASE="http://127.0.0.1:$PORT"
SESSION="${VGPU_CI_SESSION:-undertone-vgpu-ci}"
AB_CALL_TIMEOUT_SECONDS="${VGPU_CI_BROWSER_TIMEOUT_SECONDS:-20}"
WAIT_SCENE_TIMEOUT_SECONDS="${VGPU_CI_SCENE_TIMEOUT_SECONDS:-90}"
PREFLIGHT_TIMEOUT_SECONDS="${VGPU_CI_PREFLIGHT_TIMEOUT_SECONDS:-120}"
if [[ -d "$OUT" ]]; then
  existing_evidence="$(find "$OUT" -mindepth 1 -maxdepth 1 -print -quit)"
  if [[ -n "$existing_evidence" ]]; then
    echo "Refusing to overwrite existing GPU evidence: $OUT. Choose a fresh VGPU_CI_OUTPUT_DIR." >&2
    exit 1
  fi
fi
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

echo '==> Verify device-backed rendering'
if ! pnpm exec vgpu doctor --pretty >"$OUT/doctor.txt" 2>&1; then
  pnpm exec vgpu install-software-renderer | tee "$OUT/install-software-renderer.txt"
  pnpm exec vgpu doctor --pretty >"$OUT/doctor-after-fallback.txt" 2>&1
fi
pnpm check:orbit >"$OUT/check-orbit.txt" 2>&1
pnpm render:orbit >"$OUT/render-orbit.txt" 2>&1
pnpm build:orbit >"$OUT/build-orbit.txt" 2>&1
cp artifacts/orbit-t0.ppm artifacts/orbit-t25.ppm "$OUT/"
tar -czf "$OUT/review-runtime.tgz" index.html styles.css layout.css app.js visuals.js \
  orbit-bridge.js black-hole-bridge.js audio.js audio-worklet.js music-library.js \
  tracks.js webmcp.js sw.js manifest.webmanifest icons vendor gpu scripts tests package.json

if [[ -n "${AGENT_BROWSER_BIN:-}" ]]; then
  : "${AGENT_BROWSER_BIN}"
else
  # Keep the pinned QA tool task-local; do not alter global applications.
  npm install --prefix "$OUT/harness" --prefer-offline --no-save agent-browser@0.33.0 >/dev/null
  AGENT_BROWSER_BIN="$OUT/harness/node_modules/.bin/agent-browser"
fi

echo '==> Check headed-browser system dependencies'
# Node vgpu can use its portable Mesa fallback, but Chrome’s WebGPU preset
# also needs a system Vulkan loader + Mesa ICD, plus the virtual display.
required_packages=(libvulkan1 mesa-vulkan-drivers xvfb xauth)
missing_packages=()
for package in "${required_packages[@]}"; do
  package_status="$(dpkg-query -W -f='${db:Status-Status}' "$package" 2>/dev/null || true)"
  if [[ "$package_status" != installed ]]; then
    missing_packages+=("$package")
  fi
done
if ((${#missing_packages[@]})); then
  echo "==> Install missing headed-browser dependencies: ${missing_packages[*]}"
  apt_timeout_seconds="${VGPU_CI_APT_TIMEOUT_SECONDS:-180}"
  apt_network_options=(-o Acquire::Retries=1 -o Acquire::http::Timeout=15 -o Acquire::https::Timeout=15)
  # Hosted images already include Ubuntu package indexes. Avoid a slow global
  # refresh (including unrelated third-party repos) unless installation needs it.
  # Pass only absent packages so already-installed Mesa/Vulkan packages are not upgraded.
  if timeout --kill-after=10s "${apt_timeout_seconds}s" sudo apt-get "${apt_network_options[@]}" install -y -qq --no-install-recommends "${missing_packages[@]}"; then
    echo '==> Missing browser dependencies installed from existing indexes'
  else
    echo '==> Initial dependency install failed; refresh package indexes once, then retry' >&2
    timeout --kill-after=10s "${apt_timeout_seconds}s" sudo apt-get "${apt_network_options[@]}" update -qq
    timeout --kill-after=10s "${apt_timeout_seconds}s" sudo apt-get "${apt_network_options[@]}" install -y -qq --no-install-recommends "${missing_packages[@]}"
  fi
else
  echo '==> Required headed-browser dependencies are already installed'
fi

# Cold preflight may provision Chrome and probe its GPU before the daemon is warm.
# Give setup its own budget; normal browser operations retain their short cap.
timeout --kill-after=3s "${PREFLIGHT_TIMEOUT_SECONDS}s" "$AGENT_BROWSER_BIN" doctor --webgpu --headed >"$OUT/agent-browser-doctor.txt" 2>&1 || {
  status=$?
  cat "$OUT/agent-browser-doctor.txt" >&2
  echo "Browser stage 'doctor --webgpu --headed' failed or timed out (exit $status); see $OUT/agent-browser-doctor.txt" >&2
  exit "$status"
}
python3 scripts/preview.py --port "$PORT" >"$OUT/preview.log" 2>&1 &
PREVIEW_PID=$!
cleanup(){
  timeout --kill-after=2s 5s "$AGENT_BROWSER_BIN" --session "$SESSION" close >/dev/null 2>&1 || true
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
const mix={scene:'orbit',theme:'mono',motion:60,brightness:100,musicSource:'generated',keepAwake:false,eco:true,seed:604};
console.log(process.argv[2]+'/?renderer=webgpu#mix='+encodeURIComponent(JSON.stringify(mix)));
NODE
)"
ab(){
  local stage="$1" status timeout_seconds
  shift
  timeout_seconds="$AB_CALL_TIMEOUT_SECONDS"
  if [[ -n "${AB_TIMEOUT_OVERRIDE:-}" ]] && ((AB_TIMEOUT_OVERRIDE < timeout_seconds)); then
    timeout_seconds="$AB_TIMEOUT_OVERRIDE"
  fi
  if ((timeout_seconds < 1)); then
    echo "Browser stage '$stage' skipped: readiness deadline expired" >&2
    return 124
  fi
  echo "==> Browser stage: $stage (timeout ${timeout_seconds}s)" >&2
  if timeout --kill-after=3s "${timeout_seconds}s" "$AGENT_BROWSER_BIN" --session "$SESSION" --webgpu --headed "$@"; then
    return 0
  else
    status=$?
    echo "Browser stage '$stage' failed or timed out (exit $status): agent-browser $*" >&2
    return "$status"
  fi
}
ab 'open Orbit preview' open "$URL"
ab 'set initial desktop viewport' set viewport 1440 900 >/dev/null
wait_scene(){
  local deadline=$((SECONDS + WAIT_SCENE_TIMEOUT_SECONDS)) status='' rc remaining
  while ((SECONDS < deadline)); do
    remaining=$((deadline - SECONDS))
    AB_TIMEOUT_OVERRIDE="$remaining"
    # Capture failures so the readiness report can record the last stage.
    # shellcheck disable=SC2310
    if status="$(ab 'poll WebGPU scene readiness' eval '(()=>{const b=document.querySelector("#visual"),s=window.undertoneDebug.state.scene;const status=s==="horizon"?b.dataset.blackHoleStatus:b.dataset.orbitStatus;if(status==="unavailable")throw Error(b.dataset.blackHoleError||b.dataset.orbitError);return status==="ready"&&b.dataset.renderer==="webgpu"?"ready":status;})()' | tail -1 | tr -d '"\r')"; then
      rc=0
    else
      rc=$?
    fi
    unset AB_TIMEOUT_OVERRIDE
    if ((rc != 0)); then
      status="browser-command-failed:$rc"
      break
    fi
    if [[ "$status" == ready ]]; then
      remaining=$((deadline - SECONDS))
      AB_TIMEOUT_OVERRIDE="$remaining"
      ab 'settle newly ready WebGPU scene' wait 1200 >/dev/null
      unset AB_TIMEOUT_OVERRIDE
      return
    fi
    remaining=$((deadline - SECONDS))
    AB_TIMEOUT_OVERRIDE="$remaining"
    # Capture failures so the readiness report can distinguish a stalled browser call.
    # shellcheck disable=SC2310
    if ab 'wait for WebGPU scene readiness' wait 1000 >/dev/null; then
      rc=0
    else
      rc=$?
      unset AB_TIMEOUT_OVERRIDE
      status="browser-command-failed:$rc"
      break
    fi
    unset AB_TIMEOUT_OVERRIDE
  done
  printf 'deadlineSeconds=%s\nlastStatus=%s\n' "$WAIT_SCENE_TIMEOUT_SECONDS" "$status" >"$OUT/readiness-failure.txt"
  AB_TIMEOUT_OVERRIDE="$AB_CALL_TIMEOUT_SECONDS"
  # The readiness deadline has already expired; best-effort diagnostics get a separate bounded call.
  # shellcheck disable=SC2310
  ab 'capture readiness diagnostics' eval '({...document.querySelector("#visual").dataset})' >>"$OUT/readiness-failure.txt" 2>&1 || true
  unset AB_TIMEOUT_OVERRIDE
  echo "GPU scene did not become ready within ${WAIT_SCENE_TIMEOUT_SECONDS}s (last status: $status); see $OUT/readiness-failure.txt" >&2
  return 1
}
capture(){
  local name="$1" output path previous_motion
  # CI uses a CPU Vulkan adapter. Stop adding animated GPU work while the
  # compositor snapshots a frame; resume the actual clock between captures.
  previous_motion="$(ab "pause scene clock for $name" eval '(()=>{const motion=window.undertoneDebug.state.motion;window.undertoneDebug.change({motion:0});return motion;})()' | tail -1 | tr -d '\"\r')"
  [[ "$previous_motion" =~ ^[0-9]+$ ]] || { echo "Missing motion state for $name" >&2; return 1; }
  ab "settle still frame for $name" wait 1000 >/dev/null
  output="$(ab "capture $name" screenshot)"
  path="$(printf '%s\n' "$output" | sed -n 's/.*Screenshot saved to \(.*\.png\)$/\1/p' | tail -1)"
  [[ -n "$path" && -f "$path" ]] || { echo "Missing capture: $name" >&2; return 1; }
  cp "$path" "$OUT/$name.png"
  ab "restore scene clock after $name" eval "window.undertoneDebug.change({motion:$previous_motion});true" >/dev/null
}
state_capture(){ ab "apply state for $1" eval "$2" >/dev/null; ab "settle state for $1" wait 600 >/dev/null; capture "$1"; }
wait_scene
capture orbit-webgpu
ab 'observe Orbit motion' wait 3000 >/dev/null
capture orbit-webgpu-later
state_capture sound-picker 'document.querySelector("#soundQuickButton").click()'
state_capture music-picker 'document.querySelector("#musicQuickButton").click()'
state_capture scene-picker 'document.querySelector("#sceneQuickButton").click()'
state_capture color-picker 'document.querySelector("#colorQuickButton").click()'
state_capture timer-picker 'document.querySelector("#timerButton").click()'
state_capture route-picker 'document.querySelector("#routeQuick").click()'
ab 'switch to Event Horizon' eval 'document.querySelector("#routeQuick").click(); window.undertoneDebug.change({scene:"horizon",theme:"mono",motion:60,brightness:100}); true' >/dev/null
wait_scene
capture event-horizon
ab 'observe Event Horizon motion' wait 3000 >/dev/null
capture event-horizon-later
# Keep one continuous JS context for the observation, with local state rather
# than a global shared between separate automation evaluations.
ab 'verify Event Horizon still mode' eval '(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));window.undertoneDebug.change({motion:0});await wait(1500);if(window.undertoneDebug.state.motion!==0)throw Error("Motion state did not stop");const layer=document.querySelector("[data-scene-renderer=horizon]");const first={frames:layer.dataset.frameCount,time:layer.dataset.animationTime};await wait(1500);const last={frames:layer.dataset.frameCount,time:layer.dataset.animationTime};if(first.frames!==last.frames||first.time!==last.time)throw Error("Still-mode changed: "+JSON.stringify({first,last,state:window.undertoneDebug.state}));return {first,last,pass:true};})()' | tee "$OUT/still-state.json"
state_capture event-horizon-violet 'window.undertoneDebug.change({theme:"violet"}); true'
for spec in 'mobile:390:844' 'ipad:834:1194'; do
  IFS=: read -r name width height <<<"$spec"
  ab "set Event Horizon $name viewport" set viewport "$width" "$height" >/dev/null
  ab "settle Event Horizon $name viewport" wait 1200 >/dev/null
  capture "event-horizon-$name"
done
ab 'restore desktop viewport' set viewport 1440 900 >/dev/null
ab 'switch back to Energy Orbit' eval 'window.undertoneDebug.change({scene:"orbit",theme:"mono",motion:60}); true' >/dev/null
wait_scene
ab 'verify Event Horizon teardown' eval 'if(document.querySelector("[data-scene-renderer=horizon]"))throw Error("Event horizon canvas leaked after leaving"); true' >/dev/null
state_capture orbit-violet 'window.undertoneDebug.change({theme:"violet",motion:0}); true'
for spec in 'mobile:390:844' 'ipad:834:1194'; do
  IFS=: read -r name width height <<<"$spec"
  ab "set Orbit $name viewport" set viewport "$width" "$height" >/dev/null
  ab "settle Orbit $name viewport" wait 1200 >/dev/null
  capture "orbit-$name"
done
ab 'restore desktop viewport' set viewport 1440 900 >/dev/null
state_capture tune 'window.undertoneDebug.change({theme:"mono",motion:60});document.querySelector("#dockControls").click()'
state_capture tune-about 'document.querySelector("#tab-about").click()'
echo 'GPU checks passed: compiled shaders, real pixels, scene startup, still mode, resize and teardown.'
