'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Terms = require('../server/kk-booking-terms-evidence');

const source=fs.readFileSync(path.resolve(__dirname,'../assets/kk-booking-agreement.js'),'utf8');

function fixture({storageDenied=false}={}){
  const values=new Map(),listeners=new Map();
  function element(){
    return {hidden:false,checked:false,disabled:false,handlers:{},
      addEventListener(type,fn){this.handlers[type]=fn;},
      focus(){},getClientRects(){return [{width:48,height:48}]},
      querySelectorAll(){return [];}
    };
  }
  const [gate,dialog,check,confirm,cancel]=Array.from({length:5},element);
  gate.hidden=true;
  confirm.disabled=true;
  const ids={
    'kk-booking-agreement':gate,
    'kk-booking-agreement-dialog':dialog,
    'kk-booking-terms-check':check,
    'kk-booking-terms-continue':confirm,
    'kk-booking-terms-cancel':cancel
  };
  const document={
    documentElement:{style:{overflow:''}},activeElement:null,
    getElementById(id){return ids[id]||null;},
    addEventListener(type,fn){listeners.set(type,fn);},
    contains(){return true;}
  };
  const window={localStorage:{
    getItem(key){if(storageDenied)throw Error('storage unavailable');return values.get(key)||null;},
    setItem(key,value){if(storageDenied)throw Error('storage unavailable');values.set(key,value);}
  }};
  let navigations=0,blockedClicks=0;
  function dispatch(link){
    let prevented=false;
    listeners.get('click')({
      target:{closest(){return link;}},
      preventDefault(){prevented=true;blockedClicks++;},
      stopImmediatePropagation(){}
    });
    if(!prevented)navigations++;
    return prevented;
  }
  const line={href:'https://line.me/R/ti/p/%40827blnmo',click(){dispatch(line);}};
  const unrelated={href:'https://example.com/',click(){dispatch(unrelated);}};
  vm.runInNewContext(source,{document,window,location:{href:'https://kk-phone-rental.vercel.app/'},URL});
  return {gate,check,confirm,cancel,line,unrelated,values,dispatch,
    get navigations(){return navigations;},
    get blockedClicks(){return blockedClicks;}
  };
}
test('the UI storage version stays aligned with the signed LINE terms marker',()=>{
  assert.match(source,/var termsVersion = 'KK-TERMS-2026-11-06'/);
  assert.equal(Terms.VERSION,'KK-TERMS-2026-11-06');
});
test('first booking remains opt-in; only explicit confirmation remembers UX and preserves LINE link',()=>{
  const f=fixture();
  assert.equal(f.dispatch(f.line),true);
  assert.equal(f.gate.hidden,false);
  assert.equal(f.check.checked,false);
  assert.equal(f.confirm.disabled,true);
  assert.equal(f.navigations,0);
  f.check.checked=true;
  f.check.handlers.change();
  assert.equal(f.confirm.disabled,false);
  f.confirm.handlers.click();
  assert.equal(f.gate.hidden,true);
  assert.equal(f.navigations,1);
  assert.equal(f.values.get('kk_booking_terms_prompt_version'),Terms.VERSION);
  assert.equal(f.dispatch(f.line),false,'repeat booking opens LINE without another prompt');
  assert.equal(f.gate.hidden,true);
  assert.equal(f.navigations,2);
});
test('cancelling cannot write browser acknowledgement',()=>{
  const f=fixture();
  f.dispatch(f.line);
  f.cancel.handlers.click();
  assert.equal(f.gate.hidden,true);
  assert.equal(f.values.size,0);
  assert.equal(f.dispatch(f.line),true);
});
test('a changed Terms version forces a fresh unchecked acknowledgement',()=>{
  const f=fixture();
  f.values.set('kk_booking_terms_prompt_version','KK-TERMS-2026-11-05');
  assert.equal(f.dispatch(f.line),true);
  assert.equal(f.gate.hidden,false);
  assert.equal(f.check.checked,false);
});
test('disabled/private-mode localStorage fails safely to existing checkbox each time',()=>{
  const f=fixture({storageDenied:true});
  f.dispatch(f.line);
  f.check.checked=true;
  f.check.handlers.change();
  f.confirm.handlers.click();
  assert.equal(f.navigations,1);
  assert.equal(f.dispatch(f.line),true);
  assert.equal(f.gate.hidden,false);
});
test('unrelated links are untouched and no server claims are made from local UX storage',()=>{
  const f=fixture();
  assert.equal(f.dispatch(f.unrelated),false);
  assert.equal(f.gate.hidden,true);
  assert.doesNotMatch(source,/fetch\(|sendBeacon|XMLHttpRequest|document\.cookie/i);
  assert.doesNotMatch(source,/terms_accepted_at|line_user_id|service_role_key/i);
});
