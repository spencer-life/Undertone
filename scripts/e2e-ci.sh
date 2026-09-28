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

audit_overflow() {
  local name="$1" width="$2" height="$3"
  echo "==> Responsive overflow audit: $name ($width x $height)"
  agent-browser --session "$SESSION" set viewport "$width" "$height" >/dev/null
  agent-browser --session "$SESSION" wait 250
  agent-browser --session "$SESSION" eval '(()=>{
    const tol=2;
    const visible=(el)=>{
      const style=getComputedStyle(el);
      return style.display!=="none"&&style.visibility!=="hidden"&&el.getClientRects().length>0;
    };
    const name=(el)=>el.id?"#"+el.id:"."+String(el.className||"").trim().split(/\s+/).filter(Boolean).join(".");
    const dock=document.querySelector("#transportDock");
    const dr=dock.getBoundingClientRect();
    const issues=[];
    const documentWidth=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
    if(documentWidth>innerWidth+tol) issues.push({type:"document-width",documentWidth,innerWidth});
    if(dr.left<-tol||dr.right>innerWidth+tol) issues.push({type:"dock-viewport",left:dr.left,right:dr.right,innerWidth});
    if(dock.scrollWidth>dock.clientWidth+tol) issues.push({type:"dock-scroll-width",scrollWidth:dock.scrollWidth,clientWidth:dock.clientWidth});
    const candidates=[...dock.querySelectorAll("button,input[type=range],.dock-visual-picks,.playback,.transport-end,.volume-control")].filter(visible);
    for(const el of candidates){
      const r=el.getBoundingClientRect();
      if(r.left<dr.left-tol||r.right>dr.right+tol) issues.push({type:"dock-child",element:name(el),left:r.left,right:r.right,dockLeft:dr.left,dockRight:dr.right});
      if(r.left<-tol||r.right>innerWidth+tol) issues.push({type:"viewport-child",element:name(el),left:r.left,right:r.right,innerWidth});
    }
    const pickerBounds=[];
    for(const picker of document.querySelectorAll(".dock-picker")){
      const wasHidden=picker.hidden;
      const oldAnimation=picker.style.animation;
      picker.style.animation="none";
      picker.hidden=false;
      const r=picker.getBoundingClientRect();
      pickerBounds.push({id:picker.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom});
      if(r.left<-tol||r.right>innerWidth+tol||r.top<-tol||r.bottom>innerHeight+tol) issues.push({type:"picker-viewport",id:picker.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,innerWidth,innerHeight});
      const overlap=Math.min(r.bottom,dr.bottom)-Math.max(r.top,dr.top);
      if(overlap>tol) issues.push({type:"picker-dock-overlap",id:picker.id,overlap,dockTop:dr.top,pickerBottom:r.bottom});
      picker.hidden=wasHidden;
      picker.style.animation=oldAnimation;
    }
    const result={viewport:{width:innerWidth,height:innerHeight},dock:{left:dr.left,right:dr.right,top:dr.top,bottom:dr.bottom,clientWidth:dock.clientWidth,scrollWidth:dock.scrollWidth},pickerBounds,issues};
    if(issues.length) throw new Error("Responsive overflow: "+JSON.stringify(result));
    return JSON.stringify(result);
  })()' | tee "$OUT/overflow-$name.json"
}

for spec in \
  "iphone:390:844" \
  "iphone-wide:430:932" \
  "ipad-portrait:834:1194" \
  "ipad-pro-portrait:1024:1366" \
  "ipad-landscape:1194:834" \
  "desktop-compact:1366:768" \
  "desktop:1440:900" \
  "desktop-wide:1728:900"; do
  IFS=: read -r name width height <<<"$spec"
  audit_overflow "$name" "$width" "$height"
done
agent-browser --session "$SESSION" set viewport 1280 720 >/dev/null
agent-browser --session "$SESSION" wait 250

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

echo "==> Palette changes do not tint application chrome"
agent-browser --session "$SESSION" eval 'window.undertoneDebug.change({theme:"moss"}); true' >/dev/null
CHROME_BG="$(agent-browser --session "$SESSION" eval 'getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()' | tail -1 | tr -d '"\r')"
CHROME_SURFACE="$(agent-browser --session "$SESSION" eval 'getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()' | tail -1 | tr -d '"\r')"
THEME_COLOR="$(agent-browser --session "$SESSION" eval 'document.querySelector("meta[name=theme-color]").content' | tail -1 | tr -d '"\r')"
THEME_STATE="$(agent-browser --session "$SESSION" eval 'window.undertoneDebug.state.theme' | tail -1 | tr -d '"\r')"
if [[ "$THEME_STATE" != "moss" || "$CHROME_BG" != "#151516" || "$CHROME_SURFACE" != "#222224" || "$THEME_COLOR" != "#151516" ]]; then
  echo "Palette leaked into UI chrome: theme=$THEME_STATE bg=$CHROME_BG surface=$CHROME_SURFACE meta=$THEME_COLOR"
  exit 1
fi
agent-browser --session "$SESSION" eval 'window.undertoneDebug.change({theme:"mono"}); true' >/dev/null

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
