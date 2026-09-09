'use strict';
// Executes actual repository Apps Script source with in-memory providers.
// Never imports deployment credentials and never calls network/provider APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const lib = name => require(path.join(root, 'lib', name));
class Sheet {
  constructor(name, rows=[]) { this.name=name; this.rows=rows; this.formula=''; this.formulas=new Map(); this.reads=0; this.writes=0; this.clears=0; }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return Math.max(100, this.rows.length); }
  setFrozenRows() {}
  getRange(r,c,n=1,w=1) {
    if(typeof r==='string') {
      const m=r.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      const col=s=>[...s].reduce((a,x)=>a*26+x.charCodeAt(0)-64,0);
      if(!m) throw Error('unsupported mock range '+r);
      return this.getRange(Number(m[2]),col(m[1]),Number(m[4])-Number(m[2])+1,col(m[3])-col(m[1])+1);
    }
    const values=()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>this.rows[r+i-1]?.[c+j-1]??''));
    return {
      getValue:()=>{this.reads++;return values()[0][0];},
      getValues:()=>{this.reads++;return values();},
      getDisplayValues:()=>{this.reads++;return values().map(row=>row.map(String));},
      getFormula:()=>this.formulas.get(r+':'+c) ?? (typeof this.formula==='function'?this.formula(r,c):this.formula),
      getFormulas:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>this.formulas.get((r+i)+':'+(c+j)) || '')),
      setFormula:value=>{this.writes++;this.formulas.set(r+':'+c,value);},
      setValue:value=>{this.writes++;this.formulas.delete(r+':'+c);this.rows[r-1]||=[];this.rows[r-1][c-1]=value;},
      setValues:rows=>{
        this.writes++;
        rows.forEach((row,i)=>{
          this.rows[r+i-1] ||= [];
          row.forEach((x,j)=>{this.rows[r+i-1][c+j-1]=x;});
        });
        if(this.onWrite) this.onWrite(r,c,rows);
      }
    };
  }
  getRangeList(ranges) { return {clearContent:()=>{
    this.clears++;
    if(this.failClearOnce) { this.failClearOnce=false; throw Error('INJECTED_CLEAR_FAILURE'); }
    for(const a of ranges) {
      const m=a.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      const col=s=>[...s].reduce((n,x)=>n*26+x.charCodeAt(0)-64,0);
      for(let r=+m[2];r<=+m[4];r++) for(let c=col(m[1]);c<=col(m[3]);c++) this.rows[r-1][c-1]='';
    }
  }}; }
}
function context(sheets={}, overlay=false) {
  let held=false;
  const scriptLock={tryLock:()=>{held=true;return true;},hasLock:()=>held,releaseLock:()=>{held=false;}};
  const c={Date,console,URL,JSON,Math,Number,String,Array,Object,Set,Map,
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()],formatDate:d=>d.toISOString().slice(0,10).replace(/-/g,'')},
    Session:{getScriptTimeZone:()=> 'UTC'},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='KK_CRM_SPREADSHEET_ID'?'SYNTHETIC_SHEET':''})},
    SpreadsheetApp:{flush:()=>{},getActive:()=>({getId:()=> 'SYNTHETIC_SHEET',getSpreadsheetTimeZone:()=> 'Etc/GMT',getSheetByName:n=>sheets[n],insertSheet:n=>(sheets[n]=new Sheet(n))})},
    LockService:{getScriptLock:()=>scriptLock,getDocumentLock:()=>null}
  };
  vm.createContext(c);vm.runInContext(read('apps-script/Code.gs'),c);
  if(overlay)vm.runInContext(read('apps-script/BookingIdempotency.gs'),c);
  c.actualKkSheet = c.kkSheet_; // Dedicated schema tests execute the real guard.
  c.kkSheet_=n=>{if(!sheets[n])throw Error('unknown mock sheet '+n);return sheets[n];};
  c.kkGetValues_=(n,start,col,width)=>sheets[n].rows.slice(start-1).map(r=>Array.from({length:width},(_,i)=>r[col+i-1]??''));
  return c;
}

module.exports = {Sheet, context};
