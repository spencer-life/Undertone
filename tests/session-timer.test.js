const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function timer(){
 const context={audio:{ctx:{currentTime:10},armTimer:s=>context.armed=s,clearTimer:()=>context.cleared=true},state:{timer:1},Date:{now:()=>context.wall},wall:1000};
 vm.createContext(context);
 vm.runInContext('let sessionTimerRemaining=60,sessionTimerDeadline=null;'+source.slice(source.indexOf(' function currentSessionTimer'),source.indexOf(' function stopBreathingGuide'))+';this.timer={currentSessionTimer,pauseSessionTimer,resumeSessionTimer,resetSessionTimer};',context);
 return context;
}
test('timer follows audio time across browser suspension and wall-clock jumps',()=>{
 const c=timer();c.timer.resumeSessionTimer();assert.equal(c.armed,60);
 c.audio.ctx.currentTime+=5;c.wall+=5000;assert.equal(c.timer.currentSessionTimer(),55);
 c.wall+=3600000;assert.equal(c.timer.currentSessionTimer(),55,'suspended audio time must not consume the session');
 c.audio.ctx.currentTime+=3;assert.equal(c.timer.currentSessionTimer(),52);
});
test('user pause and resume preserve remaining audible time and rearm the fade',()=>{
 const c=timer();c.timer.resumeSessionTimer();c.audio.ctx.currentTime+=8;c.wall+=8000;c.timer.pauseSessionTimer();
 c.audio.ctx.currentTime+=20;c.wall+=20000;assert.equal(c.timer.currentSessionTimer(),52);
 c.timer.resumeSessionTimer();assert.equal(c.armed,52);c.audio.ctx.currentTime+=2;c.wall+=2000;assert.equal(c.timer.currentSessionTimer(),50);
 c.state.timer=0;c.timer.resetSessionTimer();c.timer.resumeSessionTimer();assert.equal(c.timer.currentSessionTimer(),null);assert.equal(c.cleared,true);
});
