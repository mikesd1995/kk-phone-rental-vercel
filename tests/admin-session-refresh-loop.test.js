'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'admin','session-bridge.js'),'utf8');

test('protected Admin API fetches explicitly carry the signed same-origin session cookie',()=>{
  assert.match(bridge,/protectedApiUrl\(input\)/);
  assert.match(bridge,/Object\.assign\(\{\},init\|\|\{\}, \{credentials:'same-origin'\}\)/);
});

test('401 and 403 only redirect after the signed session is independently confirmed invalid',()=>{
  assert.match(bridge,/async function sessionStillValid\(\)/);
  assert.match(bridge,/nativeFetch\(AUTH_URL/);
  assert.match(bridge,/data\.authenticated===true/);
  assert.match(bridge,/if\(protectedUrl && \(response\.status===401 \|\| response\.status===403\)\)/);
  assert.match(bridge,/const valid=await sessionStillValid\(\);/);
  assert.match(bridge,/if\(!valid\) redirectToGate\(\);/);
  assert.doesNotMatch(
    bridge,
    /if\(protectedUrl[^}]+\)\{\s*clearBrowserMarker\(\);\s*location\.replace\('\/admin'\);/s
  );
});

test('redirect protection coalesces auth checks and prevents repeated navigation storms',()=>{
  assert.match(bridge,/let sessionCheck=null/);
  assert.match(bridge,/if\(sessionCheck\) return sessionCheck/);
  assert.match(bridge,/let redirecting=false/);
  assert.match(bridge,/if\(redirecting\) return/);
});
