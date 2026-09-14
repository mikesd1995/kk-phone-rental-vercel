const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const v2=fs.readFileSync(path.join(root,'admin','admin.css'),'utf8');
const v1=fs.readFileSync(path.join(root,'admin','admin-ux-v1.css'),'utf8');

test('Admin UX polish v2 preserves v1 as rollback layer',()=>{
  assert.match(v2,/admin-ux-v1\.css/);
  assert.ok(v1.length>5000,'v1 stylesheet should remain intact as a rollback layer');
});

test('Admin UX polish v2 adds professional operations refinements',()=>{
  assert.match(v2,/--ux2-max:1600px/);
  assert.match(v2,/\.action-card\{border-left:3px solid/);
  assert.match(v2,/tbody td\[colspan\]/);
  assert.match(v2,/SECURE ADMIN WORKSPACE/);
});

test('Admin UX polish v2 improves tablet and mobile navigation',()=>{
  assert.match(v2,/@media\(max-width:980px\)/);
  assert.match(v2,/\.sidebar nav\{[\s\S]*display:flex!important/);
  assert.match(v2,/overflow-x:auto!important/);
  assert.match(v2,/@media\(max-width:680px\)/);
});

test('Admin UX polish v2 respects reduced motion accessibility',()=>{
  assert.match(v2,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(v2,/transition-duration:\.001ms!important/);
});
