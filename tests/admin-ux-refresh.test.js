const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const current=fs.readFileSync(path.join(root,'admin','admin.css'),'utf8');
const v2=fs.readFileSync(path.join(root,'admin','admin-ux-v2.css'),'utf8');
const v1=fs.readFileSync(path.join(root,'admin','admin-ux-v1.css'),'utf8');
const base=fs.readFileSync(path.join(root,'admin','admin-base.css'),'utf8');
const html=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const combined=`${base}\n${v1}\n${v2}\n${current}`;

test('Admin refresh preserves the full stylesheet rollback chain',()=>{
  assert.match(current,/admin-ux-v2\.css/);
  assert.match(v2,/admin-ux-v1\.css/);
  assert.match(v1,/admin-base\.css/);
  assert.ok(v2.length>5000,'v2 stylesheet should contain the prior production polish');
  assert.ok(v1.length>5000,'v1 stylesheet should contain the professional refresh');
  assert.ok(base.length>5000,'base stylesheet should contain the pre-refresh production CSS');
});

test('Admin refresh stack includes professional hierarchy, responsive and accessibility rules',()=>{
  assert.match(v1,/--ux-sidebar:#0f172a/);
  assert.match(combined,/\.sidebar\{/);
  assert.match(combined,/\.pro-hero\{/);
  assert.match(combined,/#tab-booking \.form/);
  assert.match(combined,/@media\(max-width:680px\)/);
  assert.match(combined,/:focus-visible/);
});

test('Admin DOM contract remains intact for existing JavaScript behavior',()=>{
  for(const id of ['appPanel','statsGrid','eventsTable','bookingsTable','bookingForm','eventForm','refreshBtn','logoutBtn']){
    assert.match(html,new RegExp(`id=["']${id}["']`),`missing required admin DOM id ${id}`);
  }
  assert.match(html,/\/admin\/admin\.css\?v=/);
});
