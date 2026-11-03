'use strict';

// Regression for restoring the actual customer-facing event share CTA.
// This is source-only: no booking, price, Google Sheets or Production writes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const index=fs.readFileSync('index.html','utf8');
const script=fs.readFileSync('script.js','utf8');
const styles=fs.readFileSync('style.css','utf8');

test('modal exposes exactly one accessible share control and readout',()=>{
  assert.equal((index.match(/id="modal-share-btn"/g)||[]).length,1);
  assert.match(index,/<button class="modal-share-btn" id="modal-share-btn" type="button">แชร์งานนี้<\/button>/);
  assert.match(index,/<span class="modal-share-status" id="modal-share-status" role="status" aria-live="polite"><\/span>/);
  assert.match(styles,/\.modal-share-btn\{[^}]*min-height:44px/);
  assert.match(styles,/\.modal-share-btn:focus-visible\{/);
});

test('modal share invokes the server social route and has clipboard fallback',()=>{
  assert.match(script,/function eventShareUrl\(c\)\{/);
  assert.match(script,/modalShareButton\.addEventListener\("click",function\(\)\{/);
  assert.match(script,/navigator\.share\(\{title:[^\n]*url:eventShareUrl\(activeModalEvent\)\}\)/);
  assert.match(script,/navigator\.clipboard\.writeText\(url\)/);
  assert.match(script,/if\(err&&err\.name==="AbortError"\)return;/);
  assert.match(script,/if\(!activeModalEvent\)return;/);
  assert.match(script,/shareBtn\.textContent=tr\("share_event"\)/);
});

test('event-share route encodes event identifiers and reveals no booking data',()=>{
  const matched=script.match(/function eventShareUrl\(c\)\{[\s\S]*?\n\}/);
  assert.ok(matched,'exact eventShareUrl helper exists');
  const origin='https://kk-phone-rental.vercel.app';
  const fn=vm.runInNewContext(matched[0]+'\n eventShareUrl',{
    window:{location:{origin}},
  });
  assert.equal(fn({id:'EVT-20261205-HAPPY-BUSDAY-1-2-3'}),origin+'/event/EVT-20261205-HAPPY-BUSDAY-1-2-3');
  assert.equal(fn({id:'EVT/DEC?x=booking'}),origin+'/event/EVT%2FDEC%3Fx%3Dbooking');
});
