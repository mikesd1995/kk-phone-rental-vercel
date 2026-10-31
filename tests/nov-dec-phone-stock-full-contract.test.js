'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const gs=fs.readFileSync(path.join(root,'apps-script','Code.gs'),'utf8');
const storefront=fs.readFileSync(path.join(root,'script.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'admin','admin.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function sourceFunction(src,name){
 const pattern=new RegExp('function '+name+'\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}');
 const hit=src.match(pattern);
 assert.ok(hit,'Missing function '+name);
 return hit[0];
}
function compile(src,name,sandbox={}){
 const context=vm.createContext(sandbox);
 return vm.runInContext(sourceFunction(src,name)+'\n'+name,context);
}
const webAction=compile(gs,'kkFormulaWebReadyAction_');
const webBookingStatus=compile(gs,'kkFormulaWebReadyBookingStatus_');
const availCnt=compile(storefront,'availCnt',{
 availPkgs:c=>(c.packages||[]).filter(p=>p.avail),
 toNum:v=>{const x=Number(v);return Number.isFinite(x)?x:0;}
});

test('Web Ready J: stock 0 phone / 1 lens is full rather than show',()=>{
 const formula=webAction(37);
 assert.match(formula,/IF\(G37>0,"show","show_full"\)/);
 assert.doesNotMatch(formula,/MAX\(G37,H37\)/);
 assert.match(formula,/18_Event_Visibility_Locks/);
 assert.match(formula,/data_health|01_Events/);
});

test('Web Ready I: only phone count can advertise a new phone booking',()=>{
 const formula=webBookingStatus(37);
 assert.match(formula,/IF\(J37="hide","ซ่อนจากเว็บ",IF\(G37>0,"เปิดจอง","เต็มแล้ว"\)\)/);
 assert.doesNotMatch(formula,/MAX\(G37,H37\)/);
});

test('Owner lock formula repair updates I and J together and preserves 09 package status',()=>{
 assert.match(gs,/webReadyBookingStatus\.push\(\[kkFormulaWebReadyBookingStatus_\(row\)\]\)/);
 assert.match(gs,/getRange\(startRow, 9, rowCount, 1\)\.setFormulas\(webReadyBookingStatus\)/);
 assert.match(gs,/getRange\(startRow, 10, rowCount, 1\)\.setFormulas\(webReadyAction\)/);
 assert.match(gs,/getRange\(startRow, 10, rowCount, 1\)\.setFormulas\(webPackageStatus\)/);
});

test('BTS full-booked days keep phone waitlist even with one spare lens',()=>{
 for(const date of ['2026-12-03','2026-12-05']){
  const state={date,phoneCnt:0,lensCnt:1,packages:[
   {type:'phone_only',avail:false},
   {type:'phone_lens_bundle',avail:false},
   {type:'lens_only',avail:true}
  ]};
  assert.equal(availCnt(state),0,'No phone remains '+date);
 }
});

test('real phone availability still offers the correct shared phone pool',()=>{
 const state={phoneCnt:1,lensCnt:2,packages:[
  {type:'phone_only',avail:true},
  {type:'phone_lens_bundle',avail:true},
  {type:'lens_only',avail:true}
 ]};
 assert.equal(availCnt(state),1);
 assert.equal(availCnt({...state,phoneCnt:0}),0);
});

test('lens-only is not a new phone rental even when phone count is stale positive',()=>{
 const state={phoneCnt:2,lensCnt:1,packages:[{type:'lens_only',avail:true}]};
 assert.equal(availCnt(state),0);
 assert.equal(availCnt({...state,packages:[{type:'ask',avail:true}]}),0);
});

test('Admin identifies full phone dates independently of lens-only add-ons',()=>{
 assert.match(admin,/const full=phones<=0 \\|\\| String\(web&&web\.action_for_web\\|\\|""\)\.toLowerCase\(\)==="show_full"/);
 assert.doesNotMatch(admin,/phones<=0 && lenses<=0/);
});

test('storefront preserves full event as visible waitlist, not an owner hide',()=>{
 assert.match(storefront,/value==="show"\\|\\|value==="show_full"/);
 assert.match(storefront,/if\(availCnt\(c\)<=0\) return tr\("card_waitlist"\)/);
 assert.ok(gs.includes('IF(G${r}>0,"show","show_full")'));
});

test('future approved deploy forces browsers to load the corrected storefront code',()=>{
 assert.ok(html.includes('script.js?v=storefront-minimal-event-details-phone-stock-20261031'));
});

test('lens-only add-on remains available to an existing verified phone renter',()=>{
 const event={phoneCnt:0,lensCnt:1,packages:[
  {type:'phone_only',avail:false},
  {type:'phone_lens_bundle',avail:false},
  {type:'lens_only',avail:true}
 ]};
 assert.equal(availCnt(event),0,'New phone rental remains full');
 // Do NOT remove a valid existing-renter lens add-on or the phone waitlist.
 assert.ok(storefront.includes('var phoneBookable=availCnt(c)>0;'));
 assert.ok(storefront.includes('return phoneBookable || p.type==="lens_only";'));
 assert.ok(storefront.includes('if(!phoneBookable || !avail.length){'));
 assert.ok(storefront.includes('if(!avail.length){openModal(); return;}'));
 assert.ok(storefront.includes('waitBtn.href=getWaitlistUrl(c,null)'));
 assert.ok(storefront.includes('p.avail = p.avail && lensCnt>0;'));
 assert.ok(storefront.includes('existing phone booking only'));
 assert.ok(storefront.includes('สำหรับผู้จองมือถือแล้ว'));
 assert.ok(storefront.includes('p.type==="lens_only" || p.inquiryOnly'));
});

test('explicit show_full always prevents phone booking badges with stale positive stock',()=>{
 const event={action:'show_full',phoneCnt:2,lensCnt:1,packages:[{type:'phone_only',avail:true}]};
 assert.equal(availCnt(event),0);
});
