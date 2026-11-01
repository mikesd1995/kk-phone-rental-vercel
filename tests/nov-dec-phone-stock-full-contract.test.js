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
 assert.match(formula,/IF\(J37="hide","ซ่อนจากเว็บ",IF\(AND\(J37="show",G37>0\),"เปิดจอง","เต็มแล้ว"\)\)/);
 assert.doesNotMatch(formula,/IF\(G37>0,"เปิดจอง"/);
 assert.doesNotMatch(formula,/MAX\(G37,H37\)/);
});

test('owner repair is read-only preflight-gated and never writes a package status',()=>{
 assert.match(gs,/function kkPreflightOwnerVisibilityLockFormulas_\(\)/);
 assert.match(gs,/WEB_READY_FORMULA_PREFLIGHT_BLOCKED/);
 assert.match(gs,/WEB_READY_FORMULA_READBACK_MISMATCH/);
 assert.match(gs,/getRange\(startRow, 9, rowCount, 2\)/);
 assert.doesNotMatch(sourceFunction(gs,'kkRepairOwnerVisibilityLockFormulas_'),/KK\.webPackages/);
 assert.doesNotMatch(sourceFunction(gs,'kkRepairOwnerVisibilityLockFormulas_'),/getRange\(startRow, 10, rowCount, 1\)/);
});

function mockOwnerRepair(options={}){
 const rows=Array.from({length:996},()=>Array(10).fill(''));
 const formulaRows=Array.from({length:996},()=>['','']);
 for(const row of [37,38]){
  const i=row-5;
  rows[i][0]='EVT-BTS-'+row;
  rows[i][6]='0'; rows[i][7]='1'; rows[i][8]='เปิดจอง'; rows[i][9]='show';
  formulaRows[i][0]='=IF(A'+row+'="","",IF(J'+row+'="hide","ซ่อนจากเว็บ",IF(MAX(G'+row+',H'+row+')>0,"เปิดจอง","เต็มแล้ว")))';
  formulaRows[i][1]=webAction(row).replace('IF(G'+row+'>0,"show","show_full")','IF(MAX(G'+row+',H'+row+')>0,"show","show_full")');
 }
 if(options.badStatus)formulaRows[32][0]='=IF(TRUE,"เปิดจอง","เต็มแล้ว")';
 if(options.blankCell){rows[50][9]='manual action';}
 const writes=[];
 const ready={
   getRange:(start,col,count,width)=>{
     assert.equal(start,5);assert.equal(count,996);
     if(col===1&&width===10)return {getDisplayValues:()=>rows};
     if(col===9&&width===2)return {
       getFormulas:()=>formulaRows,
       setFormulas:values=>{
         writes.push(values);
         if(!options.badReadback)values.forEach((pair,i)=>formulaRows[i]=pair);
       }
     };
     throw new Error('Unexpected range '+col+'/'+width);
   }
 };
 const sandbox={
   kkSheet_:which=>{assert.equal(which,'ready','must not touch 09_Web_Packages');return ready;},
   KK:{webReady:'ready'},
   SpreadsheetApp:{flush(){}},
   kkFormulaWebReadyBookingStatus_:webBookingStatus,
   kkFormulaWebReadyAction_:webAction
 };
 const ctx=vm.createContext(sandbox);
 vm.runInContext(
   sourceFunction(gs,'kkPreflightOwnerVisibilityLockFormulas_')+'\n'+
   sourceFunction(gs,'kkRepairOwnerVisibilityLockFormulas_')+'\n',
   ctx
 );
 return {preflight:ctx.kkPreflightOwnerVisibilityLockFormulas_,
   repair:ctx.kkRepairOwnerVisibilityLockFormulas_,writes,formulaRows};
}

test('owner dry-run audits all rows without writes and detects two stale BTS dates',()=>{
 const a=mockOwnerRepair(),res=a.preflight();
 assert.equal(res.status,'READY_FOR_OWNER_APPROVAL');
 assert.equal(res.production_writes,0);
 assert.equal(res.checked_rows,996);
 assert.equal(res.populated_rows,2);
 assert.equal(res.legacy_rows,2);
 assert.equal(res.unexpected_count,0);
 assert.equal(a.writes.length,0);
});

test('owner repair changes only Web Ready I:J and verifies exact post-write formulas',()=>{
 const a=mockOwnerRepair();
 assert.equal(a.repair(),996);
 assert.equal(a.writes.length,1,'one rectangular I:J write, no package status write');
 assert.deepEqual(Array.from(a.formulaRows[32]),[webBookingStatus(37),webAction(37)]);
 assert.deepEqual(Array.from(a.formulaRows[33]),[webBookingStatus(38),webAction(38)]);
});

test('owner repair rejects an unknown manual formula before any writes',()=>{
 const a=mockOwnerRepair({badStatus:true});
 const result=a.preflight();
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.unexpected_rows.includes(37));
 assert.throws(()=>a.repair(),/WEB_READY_FORMULA_PREFLIGHT_BLOCKED/);
 assert.equal(a.writes.length,0);
});

test('owner repair rejects manual display values in a blank row before any writes',()=>{
 const a=mockOwnerRepair({blankCell:true});
 assert.equal(a.preflight().status,'BLOCKED');
 assert.throws(()=>a.repair(),/WEB_READY_FORMULA_PREFLIGHT_BLOCKED/);
 assert.equal(a.writes.length,0);
});

test('owner repair reports failed post-write readback rather than reporting success',()=>{
 const a=mockOwnerRepair({badReadback:true});
 assert.throws(()=>a.repair(),/WEB_READY_FORMULA_READBACK_MISMATCH/);
 assert.equal(a.writes.length,1);
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

test('headline phone-rental price excludes cheaper lens-only add-ons and inactive offers',()=>{
 const startingPrice=compile(storefront,'startingPriceFor',{
  toNum:value=>{const n=Number(value);return Number.isFinite(n)?n:0;}
 });
 const date={
  phoneCnt:1,lensCnt:1,packages:[
   {type:'lens_only',avail:true,price:390},
   {type:'phone_only',avail:false,price:490},
   {type:'phone_only',avail:true,price:790},
   {type:'phone_lens_bundle',avail:true,price:990}
  ]
 };
 assert.equal(startingPrice(date),790,'phone rental price not lens add-on price');
 assert.equal(startingPrice({...date,packages:date.packages.filter(p=>p.type!=='phone_only')}),990);
 assert.equal(startingPrice({...date,packages:[{type:'lens_only',avail:true,price:390}]}),0);
});

test('Web Ready booking label requires both explicit show action and phone inventory',()=>{
 const formula=webBookingStatus(38);
 assert.match(formula,/AND\(J38="show",G38>0\)/);
 assert.doesNotMatch(formula,/MAX\(G38,H38\)/);
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
 // Keep machine-checked model text unchanged; put eligibility in a separate small label.
 assert.ok(storefront.includes('mEl.textContent=p.model||"";'));
 assert.ok(storefront.includes('note.className="ph-addon-eligibility"'));
});

test('explicit show_full always prevents phone booking badges with stale positive stock',()=>{
 const event={action:'show_full',phoneCnt:2,lensCnt:1,packages:[{type:'phone_only',avail:true}]};
 assert.equal(availCnt(event),0);
});

test('lens-only LINE inquiry says existing-booking add-on rather than a new phone rental',()=>{
 const render=compile(storefront,'buildBookingMsg',{
  tr:key=>key,lineVal:value=>String(value||''),fmtPriceLine:value=>String(value)
 });
 const event={name:'Test Fanmeet',date:'03/12/2026',venue:'Bangkok'};
 const lens=render(event,{type:'lens_only',model:'Lens',price:390});
 const phone=render(event,{type:'phone_only',model:'vivo X300 Pro',price:790});
 assert.ok(lens.startsWith('สอบถามเพิ่มเลนส์สำหรับผู้จองมือถือแล้ว'));
 assert.doesNotMatch(lens,/^สนใจเช่ามือถือ/);
 assert.ok(phone.startsWith('สนใจเช่ามือถือ'));
 assert.ok(lens.includes('Test Fanmeet'));
});
