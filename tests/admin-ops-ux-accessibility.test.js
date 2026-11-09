'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'admin/operations-dashboard.css'),'utf8');
const html=fs.readFileSync(path.join(root,'admin/operations-dashboard.html'),'utf8');

test('Admin filter inputs remain iOS font 16px and 44px accessible targets',()=>{
 assert.match(css,/\.filters input,\.filters select\s*\{\s*min-height:44px;\s*font-size:16px\s*\}/);
});
test('Admin primary action targets have 44px touch height',()=>{
 assert.match(css,/\.btn,\.tab,\.mini-btn,\.calendar \.cal-day button,\.qa-box button\s*\{\s*min-height:44px/);
});
test('Admin table provides mobile scroll affordance and visible details action',()=>{
 assert.match(css,/\.tablewrap th:last-child,\.tablewrap td:last-child\s*\{\s*position:sticky;right:0/);
 assert.match(html,/<p class="table-hint">ตารางเลื่อนซ้าย–ขวาได้/);
});
test('Admin mobile table remains deliberately contained for independent scrolling',()=>{
 assert.match(css,/\.tablewrap\{overflow:auto\}/);
 assert.match(html,/<div class="tablewrap"><table>/);
});

test('Admin registered UX gate rejects unexpected viewport values before writing artifacts',()=>{
 const {spawnSync}=require('node:child_process');
 const os=require('node:os');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kk-admin-ux-guard-'));
 const input=path.join(temp,'invalid-evidence.json');
 const output=path.join(temp,'output');
 try{
  const widths=[320,375,390,430,480,768,1024,'../../../../outside'];
  const packets=widths.map(width=>({viewport:{width}}));
  fs.writeFileSync(input,JSON.stringify({packets})+'\n');
  const run=spawnSync(process.execPath,[path.join(root,'scripts/kk-admin-ops-registered-ux-gate.cjs')],{
   cwd:root,
   env:{...process.env,GITHUB_SHA:'a'.repeat(40),ADMIN_UX_EVIDENCE_PATH:input,ADMIN_UX_OUTPUT_DIR:output},
   encoding:'utf8',
   timeout:15000
  });
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/INVALID_VIEWPORT_EVIDENCE_7/);
  assert.equal(fs.existsSync(output),false);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('Admin registered UX evidence requires all eight exact policy widths',()=>{
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'config/kk-admin-ops-ux-evidence.json'),'utf8'));
 assert.deepEqual(evidence.packets.map(x=>x.viewport.width),[320,375,390,430,480,768,1024,1440]);
});

test('Admin UX audit never persists raw Gateway records or provider result bodies',()=>{
 const src=fs.readFileSync(path.join(root,'scripts/kk-admin-ops-registered-ux-gate.cjs'),'utf8');
 assert.doesNotMatch(src,/\.\.\.rec\b/);
 assert.doesNotMatch(src,/writeJson\(artifact,\s*result\)/);
 assert.match(src,/raw_result_included:false/);
 assert.match(src,/safeInvocationId\(rec&&rec\.invocation_id\)/);
});
