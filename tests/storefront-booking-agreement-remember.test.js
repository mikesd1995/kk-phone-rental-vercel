'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Terms=require('../server/kk-booking-terms-evidence');
const source=fs.readFileSync(path.resolve(__dirname,'../assets/kk-booking-agreement.js'),'utf8');

function fixture({storageDenied=false,cookieDenied=false,shared}={}){
  const values=shared?.values||new Map(),listeners=new Map();
  const cookieJar=shared?.cookieJar||{raw:''};
  function element(){
    return {hidden:false,checked:false,disabled:false,handlers:{},
      addEventListener(type,fn){this.handlers[type]=fn;},
      focus(){},getClientRects(){return [{width:48,height:48}]},
      querySelectorAll(){return [];}
    };
  }
  const [gate,dialog,check,confirm]=Array.from({length:4},element);
  gate.hidden=true;confirm.disabled=true;
  const ids={
    'kk-booking-agreement':gate,
    'kk-booking-agreement-dialog':dialog,
    'kk-booking-terms-check':check,
    'kk-booking-terms-continue':confirm
  };
  const document={
    get cookie(){if(cookieDenied)throw Error('cookies denied');return cookieJar.raw;},
    set cookie(value){if(cookieDenied)throw Error('cookies denied');
      const part=String(value).split(';')[0];
      cookieJar.raw=cookieJar.raw.split('; ').filter(x=>x&&!x.startsWith(part.split('=')[0]+'=')).concat(part).join('; ');
    },
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
  function escape(){
    let prevented=false;
    listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;},stopImmediatePropagation(){}});
    return prevented;
  }
  const line={href:'https://line.me/R/ti/p/%40827blnmo'};
  const unrelated={href:'https://example.com/'};
  vm.runInNewContext(source,{document,window,location:{href:'https://kk-phone-rental.vercel.app/'},URL});
  return {gate,check,confirm,line,unrelated,values,cookieJar,dispatch,escape,
    get navigations(){return navigations;},get blockedClicks(){return blockedClicks;}
  };
}
test('the first-visit UI storage stays version-bound without asserting LINE evidence',()=>{
  assert.match(source,/var termsVersion = 'KK-TERMS-2026-11-06'/);
  assert.equal(Terms.VERSION,'KK-TERMS-2026-11-06');
  assert.doesNotMatch(source,/sendBeacon|XMLHttpRequest|terms_accepted_at|line_user_id|service_role_key/i);
  assert.match(source,/customerLoginEnabled === true/);
  assert.match(source,/if \(identityEnabled\) return remoteAccepted;/);
});
test('first website entry immediately shows unchecked Terms, not a checkout popup',()=>{
  const f=fixture();
  assert.equal(f.gate.hidden,false);
  assert.equal(f.check.checked,false);
  assert.equal(f.confirm.disabled,true);
  assert.equal(f.dispatch(f.line),true,'do not allow LINE until first entry confirmed');
  assert.equal(f.navigations,0);
  f.check.checked=true;
  f.check.handlers.change();
  f.confirm.handlers.click();
  assert.equal(f.gate.hidden,true);
  assert.equal(f.navigations,0,'confirmation must never launch LINE');
  assert.equal(f.values.get('kk_booking_terms_prompt_version'),Terms.VERSION);
  assert.match(f.cookieJar.raw,/kk_booking_terms_prompt_version=KK-TERMS-2026-11-06/);
  assert.equal(f.dispatch(f.line),false,'first booking opens LINE directly');
  assert.equal(f.dispatch(f.line),false,'repeat booking never reopens a modal');
  assert.equal(f.navigations,2);
});
test('Escape cannot silently bypass mandatory first-entry confirmation',()=>{
  const f=fixture();
  assert.equal(f.escape(),true);
  assert.equal(f.gate.hidden,false);
  assert.equal(f.values.size,0);
  assert.equal(f.dispatch(f.line),true);
});
test('version changes trigger immediate first-entry prompt, before any booking click',()=>{
  const shared={values:new Map([['kk_booking_terms_prompt_version','KK-TERMS-2026-11-05']]),cookieJar:{raw:''}};
  const f=fixture({shared});
  assert.equal(f.gate.hidden,false);
  assert.equal(f.check.checked,false);
  assert.equal(f.confirm.disabled,true);
});
test('same browser reload skips the first-entry prompt for current version',()=>{
  const shared={values:new Map(),cookieJar:{raw:''}};
  const first=fixture({shared});
  first.check.checked=true;first.check.handlers.change();first.confirm.handlers.click();
  const next=fixture({shared});
  assert.equal(next.gate.hidden,true);
  assert.equal(next.dispatch(next.line),false);
});
test('cookie fallback remembers entry confirmation when localStorage is blocked',()=>{
  const shared={values:new Map(),cookieJar:{raw:''}};
  const first=fixture({storageDenied:true,shared});
  assert.equal(first.gate.hidden,false);
  first.check.checked=true;first.check.handlers.change();first.confirm.handlers.click();
  assert.match(shared.cookieJar.raw,/KK-TERMS-2026-11-06/);
  const next=fixture({storageDenied:true,shared});
  assert.equal(next.gate.hidden,true);
  assert.equal(next.dispatch(next.line),false);
});
test('localStorage fallback remembers entry confirmation when cookies are blocked',()=>{
  const shared={values:new Map(),cookieJar:{raw:''}};
  const first=fixture({cookieDenied:true,shared});
  first.check.checked=true;first.check.handlers.change();first.confirm.handlers.click();
  const next=fixture({cookieDenied:true,shared});
  assert.equal(next.gate.hidden,true);
});
test('when both storages are denied, only the current page remembers and next entry prompts',()=>{
  const first=fixture({cookieDenied:true,storageDenied:true});
  first.check.checked=true;first.check.handlers.change();first.confirm.handlers.click();
  assert.equal(first.dispatch(first.line),false);
  const second=fixture({cookieDenied:true,storageDenied:true});
  assert.equal(second.gate.hidden,false);
});
test('stale first-party cookie cannot bypass updated Terms',()=>{
  const f=fixture({storageDenied:true,shared:{values:new Map(),cookieJar:{raw:'kk_booking_terms_prompt_version=KK-TERMS-2026-11-05'}}});
  assert.equal(f.gate.hidden,false);
});
test('unrelated link is not intercepted by LINE safety guard',()=>{
  const f=fixture();
  assert.equal(f.dispatch(f.unrelated),false);
  assert.equal(f.gate.hidden,false);
  assert.match(source,/SameSite=Lax; Secure/);
  assert.match(source,/Max-Age=/);
});
