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
 const legacy=(r)=>[
   '=IF(A'+r+'="","",IF(J'+r+'="hide","ซ่อนจากเว็บ",IF(MAX(G'+r+',H'+r+')>0,"เปิดจอง","เต็มแล้ว")))',
   webAction(r).replace('IF(G'+r+'>0,"show","show_full")','IF(MAX(G'+r+',H'+r+')>0,"show","show_full")')
 ];
 for(const row of [37,38]){
   const i=row-5;
   rows[i][0]='EVT-BTS-'+row;
   rows[i][6]='0';rows[i][7]='1';rows[i][8]='เปิดจอง';rows[i][9]='show';
   formulaRows[i]=legacy(row);
 }
 if(options.allSafe || options.safeRow37)formulaRows[32]=[webBookingStatus(37),webAction(37)];
 if(options.allSafe)formulaRows[33]=[webBookingStatus(38),webAction(38)];
 if(options.badStatus)formulaRows[32][0]='=IF(TRUE,"เปิดจอง","เต็มแล้ว")';
 if(options.piggybackAction)formulaRows[32][1]+='&"MALICIOUS_EXTRA"';
 if(options.piggybackStatus)formulaRows[32][0]+='&"MALICIOUS_EXTRA"';
 if(options.blankCell)rows[50][9]='manual action';
 if(options.blankUnknownFormula)formulaRows[50][0]='=HYPERLINK("https://bad.example","x")';
 if(options.blankPartialFormula)formulaRows[50][0]=webBookingStatus(55);
 if(options.blankKnownFormula)formulaRows[50]=[webBookingStatus(55),webAction(55)];
 if(options.blankLegacyFormula)formulaRows[50]=legacy(55);
 const writes=[],sequence=[],original=formulaRows.map(pair=>pair.slice());
 let locked=false,fullReads=0;
 const lock=()=>{
   sequence.push('acquire');
   if(options.lockUnavailable)throw Error('OWNER_FORMULA_LOCK_UNAVAILABLE');
   locked=true;
   return {releaseLock(){sequence.push('release');locked=false;}};
 };
 const ready={
   getRange:(start,col,count,width)=>{
     const offset=start-5;
     assert.ok(offset>=0&&offset+count<=996,'range bounded to Web Ready rows');
     if(col===1&&width===10&&start===5&&count===996)
       return {getDisplayValues:()=>rows};
     if(col===1&&width===1&&start===5&&count===996)
       return {getDisplayValues:()=>rows.map(r=>[r[0]])};
     if(col===9&&width===2)return {
       getFormulas:()=>{
         if(start===5&&count===996&&++fullReads===2&&options.snapshotDrift)
           formulaRows[32][0]='=UNSAFE_MANUAL_EDIT';
         return formulaRows.slice(offset,offset+count).map(pair=>pair.slice());
       },
       setFormulas:values=>{
         assert.equal(values.length,count);
         writes.push({start,count,values:values.map(pair=>pair.slice())});
         const n=writes.length;
         const partial=(n===1&&(options.badReadback||options.partialWriteThrows)) ||
           (n===2&&options.partialSecondWriteThrows);
         if(partial){
           formulaRows[offset]=values[0].slice();
           if(options.partialWriteThrows||options.partialSecondWriteThrows)
             throw Error('SYNTHETIC_UPSTREAM_PRIVATE_DETAIL');
           return;
         }
         if(n===2&&options.rollbackWriteFails)throw Error('SYNTHETIC_UPSTREAM_PRIVATE_DETAIL');
         values.forEach((pair,i)=>formulaRows[offset+i]=pair.slice());
         if(n===2&&options.rollbackReadbackFails)
           formulaRows[offset]=['=CORRUPTED_ROLLBACK','=UNEXPECTED'];
       }
     };
     throw Error('unexpected range '+start+'/'+col+'/'+count+'/'+width);
   }
 };
 const ctx=vm.createContext({
   kkSheet_:which=>{assert.equal(which,'ready','no Web Packages writes');return ready;},
   KK:{webReady:'ready'},SpreadsheetApp:{flush(){}},
   kkFormulaWebReadyBookingStatus_:webBookingStatus,
   kkFormulaWebReadyAction_:webAction,kkAcquireDocumentLock_:lock
 });
 vm.runInContext(sourceFunction(gs,'kkPreflightOwnerVisibilityLockFormulas_')+'\n'+
   sourceFunction(gs,'kkWebReadyOwnerRepairSpans_')+'\n'+
   sourceFunction(gs,'kkRepairOwnerVisibilityLockFormulas_'),ctx);
 return {preflight:ctx.kkPreflightOwnerVisibilityLockFormulas_,
   repair:ctx.kkRepairOwnerVisibilityLockFormulas_,writes,formulaRows,original,sequence,
   isLocked:()=>locked};
}

test('owner dry-run audits all 996 rows without writes and recognizes stale BTS rows',()=>{
 const a=mockOwnerRepair(),res=a.preflight();
 assert.equal(res.status,'READY_FOR_OWNER_APPROVAL');
 assert.equal(res.production_writes,0);
 assert.equal(res.checked_rows,996);
 assert.equal(res.populated_rows,2);
 assert.equal(res.legacy_rows,2);
 assert.equal(res.unexpected_count,0);
 assert.equal(a.writes.length,0);
});

test('owner repair changes only two legacy rows, never 994 blank templates',()=>{
 const a=mockOwnerRepair();
 assert.equal(a.repair(),2);
 assert.equal(a.writes.length,1);
 assert.equal(a.writes[0].start,37);
 assert.equal(a.writes[0].count,2);
 assert.deepEqual(Array.from(a.formulaRows[32]),[webBookingStatus(37),webAction(37)]);
 assert.deepEqual(Array.from(a.formulaRows[33]),[webBookingStatus(38),webAction(38)]);
 assert.deepEqual(a.formulaRows[996-1],['','']);
 assert.deepEqual(a.sequence,['acquire','release']);
});

test('owner repair is idempotent and keeps safe formula rows untouched',()=>{
 const a=mockOwnerRepair({allSafe:true});
 assert.equal(a.repair(),0);
 assert.equal(a.writes.length,0);
 const b=mockOwnerRepair({safeRow37:true});
 assert.equal(b.repair(),1);
 assert.deepEqual(b.writes.map(w=>[w.start,w.count]),[[38,1]]);
});

test('owner repair keeps safe blank formulas and untouched empty template row',()=>{
 const a=mockOwnerRepair({blankKnownFormula:true});
 assert.equal(a.repair(),2);
 assert.deepEqual(a.writes.map(w=>[w.start,w.count]),[[37,2]]);
 assert.deepEqual(a.formulaRows[50],[webBookingStatus(55),webAction(55)]);
});

test('owner repair can change separated legacy runs while preserving gap',()=>{
 const a=mockOwnerRepair({blankLegacyFormula:true});
 assert.equal(a.repair(),3);
 assert.deepEqual(a.writes.map(w=>[w.start,w.count]),[[37,2],[55,1]]);
 assert.deepEqual(a.formulaRows[50],[webBookingStatus(55),webAction(55)]);
});

test('owner repair rejects unknown manual formula or displayed literal before any write',()=>{
 for(const option of [{badStatus:true},{blankCell:true},{piggybackAction:true},
   {piggybackStatus:true},{blankUnknownFormula:true},{blankPartialFormula:true}]){
   const a=mockOwnerRepair(option);
   assert.equal(a.preflight().pass,false);
   assert.throws(()=>a.repair(),/WEB_READY_FORMULA_PREFLIGHT_BLOCKED/);
   assert.equal(a.writes.length,0);
   assert.deepEqual(a.sequence,['acquire','release']);
 }
});

test('owner repair fails on snapshot drift after preflight without writing',()=>{
 const a=mockOwnerRepair({snapshotDrift:true});
 assert.throws(()=>a.repair(),/WEB_READY_FORMULA_SNAPSHOT_DRIFT/);
 assert.equal(a.writes.length,0);
 assert.deepEqual(a.sequence,['acquire','release']);
});

test('owner repair rolls back one partially written span with exact readback',()=>{
 for(const option of [{badReadback:true},{partialWriteThrows:true}]){
   const a=mockOwnerRepair(option);
   assert.throws(()=>a.repair(),e=>e.message==='WEB_READY_FORMULA_REPAIR_ROLLED_BACK');
   assert.deepEqual(a.writes.map(w=>[w.start,w.count]),[[37,2],[37,2]]);
   assert.deepEqual(a.formulaRows,a.original);
   assert.deepEqual(a.sequence,['acquire','release']);
 }
});

test('owner repair rolls back earlier span and failing second span in reverse',()=>{
 const a=mockOwnerRepair({blankLegacyFormula:true,partialSecondWriteThrows:true});
 assert.throws(()=>a.repair(),/WEB_READY_FORMULA_REPAIR_ROLLED_BACK/);
 assert.deepEqual(a.writes.map(w=>[w.start,w.count]),[[37,2],[55,1],[55,1],[37,2]]);
 assert.deepEqual(a.formulaRows,a.original);
 assert.equal(a.isLocked(),false);
});

test('owner repair explicitly blocks when rollback write or readback fails',()=>{
 for(const option of [{badReadback:true,rollbackWriteFails:true},
   {badReadback:true,rollbackReadbackFails:true}]){
   const a=mockOwnerRepair(option);
   assert.throws(()=>a.repair(),e=>e.message==='WEB_READY_FORMULA_REPAIR_ROLLBACK_FAILED'&&
     !/SYNTHETIC_UPSTREAM_PRIVATE_DETAIL/.test(e.message));
   assert.equal(a.writes.length,2);
   assert.deepEqual(a.sequence,['acquire','release']);
 }
});

test('owner selective repair always holds document lock; unavailable lock writes nothing',()=>{
 const a=mockOwnerRepair();
 assert.equal(a.repair(),2);
 assert.deepEqual(a.sequence,['acquire','release']);
 const b=mockOwnerRepair({lockUnavailable:true});
 assert.throws(()=>b.repair(),/OWNER_FORMULA_LOCK_UNAVAILABLE/);
 assert.deepEqual(b.sequence,['acquire']);
 assert.equal(b.writes.length,0);
});

test('lens compatibility status plan preserves a literal hidden package row',()=>{
 const build=compile(gs,'kkWebPackageStatusRepairPlan_');
 const formulaRows=Array.from({length:996},()=>['=ARRAY_CONSTRAIN(IF(TRUE,\'18_Event_Visibility_Locks\',\'18_Event_Visibility_Locks\'))']);
 const rendered=Array.from({length:996},()=>['available']);
 const output=Array.from({length:996},(_,i)=>['new-'+(i+5)]);
 formulaRows[139]=[''];rendered[139]=['hidden']; // Real 09_Web_Packages!J144.
 const spans=build(formulaRows,rendered,output,5);
 assert.equal(spans.length,2);
 assert.equal(spans[0].startRow,5);
 assert.equal(spans[0].formulas.length,139);
 assert.equal(spans[1].startRow,145);
 assert.equal(spans[1].formulas.length,856);
 assert.equal(spans.reduce((count,s)=>count+s.formulas.length,0),995);
});

test('lens compatibility status plan rejects unknown literal statuses',()=>{
 const build=compile(gs,'kkWebPackageStatusRepairPlan_');
 const generated=[['=ANY']],formulas=[['']],displayed=[['available']];
 assert.throws(()=>build(formulas,displayed,generated,144),/WEB_PACKAGE_STATUS_PREFLIGHT_UNEXPECTED_ROW: 144/);
});

test('lens repair runs package preflight before any formulas and avoids J144',()=>{
 const writes=[];
 const forms=Array.from({length:996},()=>['=ARRAY_CONSTRAIN(IF(TRUE,\'18_Event_Visibility_Locks\',\'18_Event_Visibility_Locks\'))']);
 const rendered=Array.from({length:996},()=>['available']);
 forms[139]=[''];rendered[139]=['hidden'];
 const manualBookingRows=new Set([16,30,31,34,39,49,50]);
 const priceFormulas=Array.from({length:996},(_,i)=>[
   `=IF(I${i+5}="","",IF(I${i+5}="lens_only",SUMIFS('09_Web_Packages'!$H$5:$H),0))`
 ]);
 const priceDisplay=Array.from({length:996},()=>['']);
 for(const row of manualBookingRows){priceFormulas[row-5]=[''];priceDisplay[row-5]=['1,090'];}
 const sheet=name=>({
  getRange:(row,col,count,width)=>{
   assert.equal(width,1);
   const view={
    getFormulas:()=>name==='bookings'&&col===24?priceFormulas:forms,
    getDisplayValues:()=>name==='bookings'&&col===24?priceDisplay:rendered,
    setFormulas:values=>writes.push({name,row,col,count,values})
   };
   return view;
  }
 });
 const ctx=vm.createContext({
  kkSheet_:sheet,KK:{webPackages:'packages',bookings:'bookings'},
  kkFormulaWebPackageAvailable_:(row,raw)=>raw?'raw-'+row:'avail-'+row,
  kkFormulaWebPackageStatus_:row=>'status-'+row,
  kkFormulaBookingPrice_:row=>'price-'+row
 });
 vm.runInContext(sourceFunction(gs,'kkWebPackageStatusRepairPlan_')+'\n'+
   sourceFunction(gs,'kkBookingPriceRepairPlan_')+'\n'+
   sourceFunction(gs,'kkRepairLensCompatibilityFormulas_'),ctx);
 ctx.kkRepairLensCompatibilityFormulas_();
 const jWrites=writes.filter(w=>w.name==='packages'&&w.col===10);
 assert.equal(jWrites.length,2);
 assert.equal(jWrites[0].row,5);
 assert.equal(jWrites[0].count,139);
 assert.equal(jWrites[1].row,145);
 assert.equal(jWrites[1].count,856);
 assert.equal(writes.some(w=>w.name==='packages'&&w.col===8),false,'price column must stay untouched');
 const priceWrites=writes.filter(w=>w.name==='bookings'&&w.col===24);
 assert.ok(priceWrites.length>=2);
 assert.equal(priceWrites.reduce((n,w)=>n+w.count,0),996-manualBookingRows.size);
 for(const amountRow of manualBookingRows)
   assert.equal(priceWrites.some(w=>amountRow>=w.row&&amountRow<w.row+w.count),false,
     'manual Booking price row '+amountRow+' must be preserved');
});

test('lens repair unknown status blocks ALL writes, including booking formulas',()=>{
 const writes=[];
 const formulas=Array.from({length:996},()=>['=ARRAY_CONSTRAIN(IF(TRUE,\'18_Event_Visibility_Locks\',\'18_Event_Visibility_Locks\'))']);
 const displayed=Array.from({length:996},()=>['available']);
 formulas[139]=[''];displayed[139]=['available']; // Dangerous unknown manual OPEN status.
 const ctx=vm.createContext({
  kkSheet_:name=>({getRange:(row,col,count,width)=>({
    getFormulas:()=>formulas,
    getDisplayValues:()=>displayed,
    setFormulas:values=>writes.push({name,col})
  })}),
  KK:{webPackages:'packages',bookings:'bookings'},
  kkFormulaWebPackageAvailable_:()=>'=I',
  kkFormulaWebPackageStatus_:()=>'=J',
  kkFormulaBookingPrice_:()=>'=X'
 });
 vm.runInContext(sourceFunction(gs,'kkWebPackageStatusRepairPlan_')+'\n'+
   sourceFunction(gs,'kkRepairLensCompatibilityFormulas_'),ctx);
 assert.throws(()=>ctx.kkRepairLensCompatibilityFormulas_(),/WEB_PACKAGE_STATUS_PREFLIGHT_UNEXPECTED_ROW: 144/);
 assert.equal(writes.length,0);
});

test('automatic lens compatibility installer performs preflight before any mutation',()=>{
 const seq=[];
 const ctx=vm.createContext({
  PropertiesService:{getDocumentProperties:()=>({
    getProperty:()=>'',setProperty:()=>seq.push('property_write')
  })},
  KK_LENS_COMPAT_PATCH_VERSION:'test-safe-flag',
  kkTryDocumentLock_:()=>({releaseLock:()=>seq.push('unlock')}),
  kkPreflightLensCompatibilityPatchStatuses_:()=>{seq.push('preflight');throw Error('UNEXPECTED_MANUAL_STATUS')},
  kkEnsureZeissLensModelMaster_:()=>seq.push('model_write'),
  kkRetireG2AssetsAndPackages_:()=>seq.push('asset_write'),
  kkRepairLensCompatibilityFormulas_:()=>seq.push('booking_formula_write'),
  SpreadsheetApp:{flush:()=>seq.push('flush')}
 });
 vm.runInContext(sourceFunction(gs,'kkEnsureLensCompatibilityPatchInstalled_'),ctx);
 assert.throws(()=>ctx.kkEnsureLensCompatibilityPatchInstalled_(),/UNEXPECTED_MANUAL_STATUS/);
 assert.deepEqual(seq,['preflight','unlock'],'no owner or business writes before rejecting drift');
});

test('manual lens repair menu preflights before deleting its installed-version property',()=>{
 const manual=sourceFunction(gs,'kkRepairLensCompatibilityPatch');
 assert.ok(manual.indexOf('kkPreflightLensCompatibilityPatchStatuses_();')>=0);
 assert.ok(manual.indexOf('kkPreflightLensCompatibilityPatchStatuses_();') <
           manual.indexOf("deleteProperty('KK_LENS_COMPAT_PATCH_VERSION')"));
});

test('lens status preflight is read-only and checks every generated row before repair',()=>{
 const fn=sourceFunction(gs,'kkPreflightLensCompatibilityPatchStatuses_');
 assert.match(fn,/getRange\(startRow, 10, rowCount, 1\)/);
 assert.match(fn,/getFormulas\(\), range\.getDisplayValues\(\), generated, startRow/);
 assert.doesNotMatch(fn,/setFormula|setValue|deleteProperty/);
});

test('Booking X price plan preserves 37 manual prices and maintains row-aligned formulas',()=>{
 const pricePlan=compile(gs,'kkBookingPriceRepairPlan_');
 const formulas=Array.from({length:996},(_,i)=>['=IF(I'+(i+5)+'="","",IF(I'+(i+5)+'="lens_only",IFERROR(SUMIFS(\'09_Web_Packages\'!$H$5:$H),0),0))']);
 const display=Array.from({length:996},()=>['']);
 const overrides=[16,30,31,34,39,49,50];
 for(const row of overrides){formulas[row-5]=[''];display[row-5]=['1,090'];}
 const generated=Array.from({length:996},(_,i)=>['generated-'+(i+5)]);
 const spans=pricePlan(formulas,display,generated,5);
 assert.equal(spans.reduce((total,s)=>total+s.formulas.length,0),996-overrides.length);
 assert.equal(spans.some(s=>overrides.some(row=>row>=s.startRow&&row<s.startRow+s.formulas.length)),false);
 assert.equal(spans.some(s=>s.startRow===17),true);
});

test('Booking price repair preflight rejects unknown literal and formula without a write',()=>{
 const plan=compile(gs,'kkBookingPriceRepairPlan_');
 for(const bad of [
   {f:'',shown:'customer note'},
   {f:'=IF(TRUE,690,0)',shown:'690'}
 ]){
  assert.throws(()=>plan([[bad.f]],[[bad.shown]],[['=GENERATED']],144),
    /BOOKING_PRICE_PREFLIGHT_UNEXPECTED_ROW: 144/);
 }
 assert.throws(()=>plan([[]],[],[['=GENERATED']],5),
   /BOOKING_PRICE_PREFLIGHT_SHAPE_MISMATCH/);
});

test('lens installer checks booking price preflight before assets and property writes',()=>{
 const calls=[];
 const ctx=vm.createContext({
  PropertiesService:{getDocumentProperties:()=>({getProperty:()=>'',setProperty:()=>calls.push('setVersion')})},
  KK_LENS_COMPAT_PATCH_VERSION:'next',
  kkTryDocumentLock_:()=>({releaseLock:()=>calls.push('unlock')}),
  kkPreflightLensCompatibilityPatchStatuses_:()=>calls.push('statusPreflight'),
  kkPreflightLensCompatibilityBookingPrices_:()=>{calls.push('pricePreflight');throw Error('BOOKING_PRICE_PREFLIGHT_UNEXPECTED_ROW: 16');},
  kkEnsureZeissLensModelMaster_:()=>calls.push('modelWrite'),
  kkRetireG2AssetsAndPackages_:()=>calls.push('retireWrite'),
  kkRepairLensCompatibilityFormulas_:()=>calls.push('formulaWrite'),
  SpreadsheetApp:{flush:()=>calls.push('flush')}
 });
 vm.runInContext(sourceFunction(gs,'kkEnsureLensCompatibilityPatchInstalled_'),ctx);
 assert.throws(()=>ctx.kkEnsureLensCompatibilityPatchInstalled_(),/BOOKING_PRICE_PREFLIGHT_UNEXPECTED_ROW/);
 assert.deepEqual(calls,['statusPreflight','pricePreflight','unlock']);
});

test('manual lens installer checks Booking X before deleting version property',()=>{
 const body=sourceFunction(gs,'kkRepairLensCompatibilityPatch');
 assert.ok(body.indexOf('kkPreflightLensCompatibilityBookingPrices_();')>=0);
 assert.ok(body.indexOf('kkPreflightLensCompatibilityBookingPrices_();')<
   body.indexOf("deleteProperty('KK_LENS_COMPAT_PATCH_VERSION')"));
});

test('Booking X price plan runs before stock writes and cannot bulk-rewrite X',()=>{
 const body=sourceFunction(gs,'kkRepairLensCompatibilityFormulas_');
 assert.match(body,/const pricePlan = kkBookingPriceRepairPlan_\(/);
 assert.ok(body.indexOf('const pricePlan =')<body.indexOf('web.getRange(startRow, 9'));
 assert.match(body,/pricePlan\.forEach\(span => booking\.getRange\(span\.startRow, 24, span\.formulas\.length, 1\)\.setFormulas\(span\.formulas\)\)/);
 assert.doesNotMatch(body,/booking\.getRange\(startRow, 24, rowCount, 1\)\.setFormulas\(bookingPrice\)/);
});

test('booking admission does not trigger owner lens-compatibility migrations',()=>{
 const guard=compile(gs,'kkAssertLensCompatibilityPatchReady_',{
   PropertiesService:{getDocumentProperties:()=>({getProperty:()=> 'v16.7.0_PHASE3_9_5_11_SAME_DAY_INVENTORY_20260928'})},
   KK_LENS_COMPAT_PATCH_VERSION:'v16.7.0_PHASE3_9_5_11_SAME_DAY_INVENTORY_20260928'
 });
 assert.equal(guard(),true);
 const actionStart=gs.indexOf('function kkApiCreateBooking_(payload) {');
 assert.ok(actionStart>=0,'real Apps Script create-booking function must exist');
 const actionEnd=gs.indexOf('\nfunction ',actionStart+10);
 const creation=gs.slice(actionStart,actionEnd>actionStart?actionEnd:actionStart+14500);
 assert.match(creation,/kkAssertLensCompatibilityPatchReady_\(\)/);
 assert.doesNotMatch(creation,/\bkkEnsureLensCompatibilityPatchInstalled_\(\);/);
 assert.ok(creation.indexOf("if (!eventId || !templateId || !customerName)") <
           creation.indexOf("kkAssertLensCompatibilityPatchReady_();"));
});

test('stale or missing owner patch blocks booking before any owner mutation',()=>{
 const versions=['',null,'OLD_UNVERIFIED'];
 for(const installed of versions){
  const writes=[];
  const guard=compile(gs,'kkAssertLensCompatibilityPatchReady_',{
   PropertiesService:{getDocumentProperties:()=>({
      getProperty:()=>installed,
      setProperty:()=>writes.push('setProperty'),
      deleteProperty:()=>writes.push('deleteProperty')
   })},
   KK_LENS_COMPAT_PATCH_VERSION:'CURRENT_APPROVED'
  });
  assert.throws(()=>guard(),/LENS_COMPAT_OWNER_REPAIR_REQUIRED/);
  assert.deepEqual(writes,[]);
 }
});

test('explicit owner installer is still available for separately approved repair',()=>{
 const owner=sourceFunction(gs,'kkEnsureLensCompatibilityPatchInstalled_');
 const explicit=sourceFunction(gs,'kkRepairLensCompatibilityPatch');
 assert.match(owner,/kkPreflightLensCompatibilityPatchStatuses_\(\)/);
 assert.match(owner,/kkPreflightLensCompatibilityBookingPrices_\(\)/);
 assert.match(owner,/kkRepairLensCompatibilityFormulas_\(\)/);
 assert.match(explicit,/kkEnsureLensCompatibilityPatchInstalled_\(\)/);
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
