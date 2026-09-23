#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="test-results"
PORT="${E2E_PORT:-4184}"
BASE="http://127.0.0.1:$PORT"
SESSION="undertone-e2e"

rm -rf "$OUT" playwright-report
mkdir -p "$OUT"

echo "==> Install browser QA harness"
npm install --global agent-browser@0.33.0 >/dev/null

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

echo "==> Open stable Canvas path"
agent-browser --session "$SESSION" open "$BASE/?renderer=canvas"
agent-browser --session "$SESSION" wait 1200

run_a11y() {
  local name="$1"
  echo "==> Axe audit: $name"
  agent-browser --session "$SESSION" a11y --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa --json >"$OUT/a11y-$name.json"
  node - "$OUT/a11y-$name.json" "$name" <<'NODE'
const fs=require('node:fs');
const [file,name]=process.argv.slice(2);
const raw=JSON.parse(fs.readFileSync(file,'utf8'));
const data=raw?.data?.result ?? raw?.data ?? raw;
const violations=Array.isArray(data?.violations)?data.violations:[];
const incomplete=Array.isArray(data?.incomplete)?data.incomplete:[];
console.log(`${name}: ${violations.length} axe violation(s), ${incomplete.length} incomplete check(s)`);
if(violations.length){
  for(const v of violations) console.error(`[${v.impact||'unknown'}] ${v.id}: ${v.help||''} (${v.nodeCount ?? v.nodes?.length ?? 0} nodes)`);
  process.exit(1);
}
NODE
}

run_a11y "main"

for spec in "sound:#soundQuickButton" "music:#musicQuickButton" "scene:#sceneQuickButton" "color:#colorQuickButton" "timer:#timerButton" "route:#routeQuick"; do
  name="${spec%%:*}"
  selector="${spec#*:}"
  agent-browser --session "$SESSION" click "$selector"
  agent-browser --session "$SESSION" wait 300
  run_a11y "$name-picker"
  agent-browser --session "$SESSION" click "$selector"
done

echo "==> Quick-control behavior"
agent-browser --session "$SESSION" click "#soundQuickButton"
agent-browser --session "$SESSION" click '#soundPicker [data-preset="focus"]'
MODE="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.state.preset' | tail -1 | tr -d '"\r')"
if [[ "$MODE" != "focus" ]]; then echo "Sound picker did not change mode"; exit 1; fi
agent-browser --session "$SESSION" click '#soundPicker [data-preset="soft"]'
agent-browser --session "$SESSION" click "#soundQuickButton"

agent-browser --session "$SESSION" click "#timerButton"
agent-browser --session "$SESSION" click '[data-timer="15"]'
TIMER_SETTING="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.state.timer' | tail -1 | tr -d '"\r')"
if [[ "$TIMER_SETTING" != "15" ]]; then echo "Timer picker did not update timer"; exit 1; fi
agent-browser --session "$SESSION" click "#timerButton"

agent-browser --session "$SESSION" click "#routeQuick"
agent-browser --session "$SESSION" click '[data-route="speakers"]'
ROUTE="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.state.route' | tail -1 | tr -d '"\r')"
if [[ "$ROUTE" != "speakers" ]]; then echo "Output picker did not switch route"; exit 1; fi
agent-browser --session "$SESSION" click '[data-route="headphones"]'
agent-browser --session "$SESSION" click "#routeQuick"

agent-browser --session "$SESSION" click "#dockControls"
agent-browser --session "$SESSION" wait 500
run_a11y "tune"
agent-browser --session "$SESSION" click "#closePanel"
agent-browser --session "$SESSION" wait 400

echo "==> Timer + breathing interaction regression"
agent-browser --session "$SESSION" eval 'window.undertoneDebug.change({musicSource:"generated",route:"headphones",preset:"soft",breathing:true,timer:0}); true' >/dev/null
agent-browser --session "$SESSION" click "#playButton"
agent-browser --session "$SESSION" wait 900

PLAYING="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.playing' | tail -1 | tr -d '"\r')"
BREATHING="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.breathingActive' | tail -1 | tr -d '"\r')"
if [[ "$PLAYING" != "true" || "$BREATHING" != "true" ]]; then
  echo "Playback or breathing guide did not start: playing=$PLAYING breathing=$BREATHING"
  exit 1
fi

agent-browser --session "$SESSION" eval 'window.undertoneDebug.setTimer(0.1); true' >/dev/null
TIMER_START="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.timerRemaining' | tail -1 | tr -d '"\r')"
BREATH_START="$(agent-browser --session "$SESSION" eval 'parseFloat(document.querySelector("#breathRing").style.getPropertyValue("--breath"))' | tail -1 | tr -d '"\r')"
agent-browser --session "$SESSION" screenshot "$OUT/breathing-start.png" >/dev/null
agent-browser --session "$SESSION" wait 1200
TIMER_MID="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.timerRemaining' | tail -1 | tr -d '"\r')"
BREATH_MID="$(agent-browser --session "$SESSION" eval 'parseFloat(document.querySelector("#breathRing").style.getPropertyValue("--breath"))' | tail -1 | tr -d '"\r')"
agent-browser --session "$SESSION" screenshot "$OUT/breathing-mid.png" >/dev/null

awk -v a="$TIMER_START" -v b="$TIMER_MID" 'BEGIN { exit !(b < a - 0.7) }' || {
  echo "Timer did not count down while playing: start=$TIMER_START mid=$TIMER_MID"
  exit 1
}
awk -v a="$BREATH_START" -v b="$BREATH_MID" 'BEGIN { d=a-b; if(d<0)d=-d; exit !(d > 0.015) }' || {
  echo "Breathing ring did not visibly animate: start=$BREATH_START mid=$BREATH_MID"
  exit 1
}

agent-browser --session "$SESSION" click "#playButton"
agent-browser --session "$SESSION" wait 650
PAUSED_PLAYING="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.playing' | tail -1 | tr -d '"\r')"
PAUSED_1="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.timerRemaining' | tail -1 | tr -d '"\r')"
agent-browser --session "$SESSION" wait 1000
PAUSED_2="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.timerRemaining' | tail -1 | tr -d '"\r')"
if [[ "$PAUSED_PLAYING" != "false" ]]; then
  echo "Playback did not pause"
  exit 1
fi
awk -v a="$PAUSED_1" -v b="$PAUSED_2" 'BEGIN { d=a-b; if(d<0)d=-d; exit !(d < 0.25) }' || {
  echo "Timer changed while paused: first=$PAUSED_1 second=$PAUSED_2"
  exit 1
}

agent-browser --session "$SESSION" click "#playButton"
agent-browser --session "$SESSION" wait 650
RESUME_1="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.timerRemaining' | tail -1 | tr -d '"\r')"
agent-browser --session "$SESSION" wait 700
RESUME_2="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.timerRemaining' | tail -1 | tr -d '"\r')"
awk -v a="$RESUME_1" -v b="$RESUME_2" 'BEGIN { exit !(b < a - 0.4) }' || {
  echo "Timer did not resume: first=$RESUME_1 second=$RESUME_2"
  exit 1
}

agent-browser --session "$SESSION" click "#playButton"
agent-browser --session "$SESSION" wait 450

node - "$OUT/interaction-state.json" "$TIMER_START" "$TIMER_MID" "$PAUSED_1" "$PAUSED_2" "$RESUME_1" "$RESUME_2" "$BREATH_START" "$BREATH_MID" <<'NODE'
const fs=require('node:fs');
const [file,...values]=process.argv.slice(2);
const [timerStart,timerMid,paused1,paused2,resume1,resume2,breathStart,breathMid]=values.map(Number);
fs.writeFileSync(file,JSON.stringify({timerStart,timerMid,paused1,paused2,resume1,resume2,breathStart,breathMid},null,2));
NODE

echo "Web E2E passed: WCAG 2.2 AA axe audits, timer lifecycle, and breathing motion."
