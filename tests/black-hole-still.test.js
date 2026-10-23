'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Event horizon renderer never installs its own animation loop',()=>{
 const source=fs.readFileSync('gpu/optimized-black-hole/renderer.ts','utf8');
 assert.doesNotMatch(source,/requestAnimationFrame\s*\(/);
 assert.doesNotMatch(source,/setInterval\s*\(/);
});
