'use strict';
// Offline owner-cutover regression. NO live Sheets, GAS, Booking, Drive, or network.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
const begin=source.indexOf('function kkFormulaWebReadyAction_(');
const end=source.indexOf('// Storefront policy:',begin);
assert.ok(begin>=0&&end>begin,'owner source slice missing');
const selected=source.slice(begin,end);
const firstRow=5,totalRows=996,populatedRows=438;

function build(opts={}){
  const sandbox={};
  const calls={read:0,write:[],flush:0,released:0,packageReads:0,packageWrites:0,locks:0};
  const state={ids:[],display:[],formulas:[]};
  const context=vm.createContext(sandbox);
  Object.assign(sandbox,{KK:{webReady:'08_Web_Ready',webPackages:'09_Web_Packages'}});
  const code=new vm.Script(selected,{filename:'apps-script/Code.gs WebReady-only'});
  code.runInContext(context,{timeout:4000});
  const genA=vm.runInContext('kkFormulaWebReadyAction_',context);
  const genI=vm.runInContext('kkFormulaWebReadyBookingStatus_',context);
  for(let i=0;i<totalRows;i++){
    const row=i+firstRow,id=i<populatedRows?'EVT-2026-SYNTHETIC-'+i:'';
    const status='=IF(A'+row+'="","",IF(J'+row+'="hide","ซ่อนจากเว็บ",IF(MAX(G'+row+',H'+row+')>0,"เปิดจอง","เต็มแล้ว")))';
    const action=genA(row).replace('IF(G'+row+'>0,"show","show_full")',
      'IF(MAX(G'+row+',H'+row+')>0,"show","show_full")');
    state.ids.push([id]);
    state.formulas.push(i===totalRows-1&&opts.lastBlank!==false?['','']:[status,action]);
    state.display.push([id,'synthetic event','03/12/2026','mock venue','mock poster','','0','1','เปิดจอง','show']);
  }
  function range(row,col,numRows,numCols){
    const first=row-firstRow,last=first+numRows;
    assert.ok(first>=0&&last<=totalRows,'bounded row range');
    return {
      getDisplayValues:()=>{
        calls.read++;
        if(col===1&&numCols===10)return state.display.slice(first,last).map(r=>r.slice());
        if(col===1&&numCols===1)return state.ids.slice(first,last).map(r=>r.slice());
        throw Error('unexpected getDisplayValues column '+col);
      },
      getFormulas:()=>{
        calls.read++;
        if(col===9&&numCols===2)return state.formulas.slice(first,last).map(r=>r.slice());
        throw Error('unexpected getFormulas '+col+'/'+numCols);
      },
      setFormulas:(formulaPairs)=>{
        assert.equal(col,9,'only I:J may be written');
        assert.equal(numCols,2);
        assert.equal(formulaPairs.length,numRows);
        calls.write.push({row,count:numRows});
        if(opts.failOnce && calls.write.length===1)throw Error('MOCK_PROVIDER_WRITE_FAIL');
        for(let j=0;j<numRows;j++)state.formulas[first+j]=Array.from(formulaPairs[j]);
      }
    };
  }
  Object.assign(sandbox,{
    kkSheet_:(tab)=>{
      if(tab==='08_Web_Ready')return {getRange:range};
      if(tab==='09_Web_Packages'){
        calls.packageReads++;
        return {getRange:()=>({setFormulas:()=>{calls.packageWrites++}})};
      }
      throw Error('unexpected sheet '+tab);
    },
    kkAcquireDocumentLock_:(label)=>{
      assert.match(label,/owner Web Ready/);
      calls.locks++;
      return {releaseLock:()=>{calls.released++}};
    },
    SpreadsheetApp:{flush:()=>{calls.flush++}}
  });
  return {state,calls,genA,genI,preflight:vm.runInContext('kkPreflightOwnerVisibilityLockFormulas_',context),
    repair:vm.runInContext('kkRepairOwnerVisibilityLockFormulas_',context),
    spans:vm.runInContext('kkWebReadyOwnerRepairSpans_',context)};
}

test('source preserves current owner lock and history filters',()=>{
  const f=build();
  const formula=f.genA(321);
  assert.ok(formula.includes('COUNTIFS('));
  assert.ok(formula.includes('historical')===false); // history is an actual COUNTIFS predicate
  assert.ok(formula.includes('"LOCKED"'));
  assert.ok(formula.includes('IF(G321>0,"show","show_full")'));
  assert.ok(!formula.includes('MAX(G321,H321)'));
  assert.ok(formula.includes("'01_Events'"));
});
test('booking status cannot be reopened from spare lens alone',()=>{
  const f=build();
  const formula=f.genI(321);
  assert.ok(formula.includes('IF(AND(J321="show",G321>0),"เปิดจอง","เต็มแล้ว")'));
  assert.ok(formula.includes('J321="hide"'));
  assert.ok(!formula.includes('H321'));
});
test('owner preflight recognizes 995 exact old I/J pairs and one truly blank row',()=>{
  const f=build();
  const r=f.preflight();
  assert.equal(r.pass,true);
  assert.equal(r.status,'READY_FOR_OWNER_APPROVAL');
  assert.equal(r.checked_rows,996);
  assert.equal(r.populated_rows,438);
  assert.equal(r.blank_rows,558);
  assert.equal(r.legacy_rows,438);
  assert.equal(r.unexpected_count,0);
  assert.equal(f.calls.write.length,0);
  assert.equal(f.calls.packageWrites,0);
});
test('unknown formula drift aborts owner preflight before writing',()=>{
  const f=build();
  f.state.formulas[5][1]='=TRUE';
  const result=f.preflight();
  assert.equal(result.pass,false);
  assert.equal(result.unexpected_count,1);
  assert.equal(result.unexpected_rows[0],10);
  assert.equal(f.calls.write.length,0);
});
test('manual I/J literal cannot be silently overwritten',()=>{
  const f=build();
  f.state.formulas[7][0]='';
  f.state.formulas[7][1]='';
  f.state.display[7][8]='manual owner override';
  assert.equal(f.preflight().pass,false);
  assert.equal(f.calls.write.length,0);
});
test('owner repair uses one bounded I:J span and never touches Web Packages',()=>{
  const f=build();
  const count=f.repair();
  assert.equal(count,995);
  assert.deepEqual(f.calls.write,[{row:5,count:995}]);
  assert.equal(f.calls.packageWrites,0);
  assert.equal(f.calls.packageReads,0);
  assert.equal(f.calls.released,1);
  assert.deepEqual(f.state.formulas[995],['','']);
  assert.equal(f.state.formulas[0][0],f.genI(5));
  assert.equal(f.state.formulas[0][1],f.genA(5));
  assert.equal(f.state.formulas[994][1],f.genA(999));
  const after=f.preflight();
  assert.equal(after.legacy_rows,0);
  assert.equal(after.already_safe_rows,438);
});
test('readback-repair is idempotent and makes zero writes a second time',()=>{
  const f=build();
  assert.equal(f.repair(),995);
  assert.equal(f.repair(),0);
  assert.equal(f.calls.write.length,1);
  assert.equal(f.calls.released,2);
});
test('unexpected legacy formula blocks every owner write',()=>{
  const f=build();
  const original=f.state.formulas[16].slice();
  f.state.formulas[16][1]='=UNKNOWN_FUNCTION()';
  assert.throws(()=>f.repair(),/WEB_READY_FORMULA_PREFLIGHT_BLOCKED/);
  assert.equal(f.calls.write.length,0);
  assert.deepEqual(f.state.formulas[16],['=IF(A21="","",IF(J21="hide","ซ่อนจากเว็บ",IF(MAX(G21,H21)>0,"เปิดจอง","เต็มแล้ว")))', '=UNKNOWN_FUNCTION()']);
  assert.equal(f.calls.released,1);
  assert.ok(original[1].includes('LOCKED'));
});
test('temporary provider failure causes rollback and rejects success',()=>{
  const f=build({failOnce:true});
  const original=f.state.formulas[0].slice();
  assert.throws(()=>f.repair(),/WEB_READY_FORMULA_REPAIR_ROLLED_BACK/);
  assert.equal(f.calls.write.length,2,'write attempted, then rollback');
  assert.deepEqual(f.state.formulas[0],original);
  assert.equal(f.calls.released,1);
});
test('more than 25 fragmented repair spans are prohibited',()=>{
  const f=build();
  const current=f.state.formulas.slice(0,61).map((row,i)=>
    i%2===1?[f.genI(i+5),f.genA(i+5)]:row.slice());
  const requested=current.map((r,i)=>[f.genI(i+5),f.genA(i+5)]);
  const ids=f.state.ids.slice(0,61);
  assert.throws(()=>f.spans(current,ids,requested,5),/WEB_READY_FORMULA_REPAIR_FRAGMENTED/);
});
test('invalid snapshot shape is not accepted by span planner',()=>{
  const f=build();
  assert.throws(()=>f.spans([],[],[[1,2]],5),/WEB_READY_FORMULA_ROLLBACK_SNAPSHOT_INVALID/);
});
test('no accidental install / deploy / trigger in scoped source',()=>{
  assert.equal((source.match(/function kkRepairOwnerVisibilityLockFormulas_/g)||[]).length,1);
  assert.equal(selected.includes('ScriptApp.newTrigger('),false);
  assert.equal(selected.includes('DriveApp.'),false);
  assert.equal(selected.includes('UrlFetchApp.'),false);
});
