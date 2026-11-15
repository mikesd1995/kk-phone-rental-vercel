'use strict';
// Strictly offline browser simulation: no LINE/Database/Production calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../assets/kk-booking-agreement.js'),'utf8');
const version = 'KK-TERMS-2026-11-06';

function fixture({session,accept={ok:true,status:'ACCEPTED',skip_agreement:true,terms_version:version},
                  previousCookie='',remoteEnabled=true,throwOnSession=false}={}){
  const calls=[], redirects=[], handlers=new Map(),values=new Map();
  const note={textContent:'existing original note'};
  let cookie=previousCookie;
  function el(){return {hidden:false,checked:false,disabled:false,textContent:'ยืนยันและเลือกงาน',handlers:{},
    addEventListener(type,fn){this.handlers[type]=fn;},focus(){},getClientRects(){return [{width:300}]},
    querySelectorAll(){return []}};}
  const gate=el(),dialog=el(),check=el(),confirm=el();
  gate.hidden=true;confirm.disabled=true;
  const ids={'kk-booking-agreement':gate,'kk-booking-agreement-dialog':dialog,
    'kk-booking-terms-check':check,'kk-booking-terms-continue':confirm};
  const document={
    get cookie(){return cookie;},
    set cookie(v){cookie=String(v).split(';')[0];},
    querySelector(s){return s==='.kk-booking-agreement-note'?note:null;},
    getElementById(id){return ids[id]||null;},addEventListener(type,fn){handlers.set(type,fn);},
    documentElement:{style:{overflow:''}},activeElement:null,contains(){return true}
  };
  const window={KK_CONFIG:{customerLoginEnabled:remoteEnabled},
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
    location:{assign:url=>redirects.push(url)},
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('action=session')){
        if(throwOnSession)throw Error('synthetic upstream failure');
        return {ok:true,json:async()=>session};
      }
      if(url.endsWith('action=accept')){
        return {ok:accept.ok,json:async()=>accept};
      }
      throw Error('Unexpected provider request '+url);
    }
  };
  vm.runInNewContext(source,{document,window,URL,location:{href:'https://kk-phone-rental.vercel.app/'}});
  const flush=async()=>{for(let i=0;i<7;i++)await Promise.resolve();};
  const checked=()=>{check.checked=true;check.handlers.change();};
  return {gate,dialog,check,confirm,note,window,values,calls,redirects,checked,flush,
    get cookie(){return cookie;},handlers};
}

test('existing authenticated LINE current-version evidence skips gate without a second click',async()=>{
  const f=fixture({session:{authenticated:true,skip_agreement:true,terms_version:version,csrf:'csrf-token'}});
  await f.flush();
  assert.equal(f.gate.hidden,true);
  assert.equal(f.values.get('kk_booking_terms_prompt_version'),version);
  assert.match(f.cookie,/KK-TERMS-2026-11-06/);
  assert.equal(f.calls.length,1);
  assert.match(f.calls[0].url,/action=session/);
});
test('new authenticated acceptance persists server side before cookie or booking access',async()=>{
  const f=fixture({session:{authenticated:true,skip_agreement:false,terms_version:version,csrf:'csrf-only-from-server'}});
  await f.flush();
  assert.equal(f.gate.hidden,false);
  assert.equal(f.values.size,0);
  f.checked();
  assert.equal(f.confirm.disabled,false);
  await f.confirm.handlers.click();
  assert.equal(f.calls.length,2);
  assert.match(f.calls[1].url,/action=accept/);
  assert.equal(f.calls[1].options.method,'POST');
  assert.equal(f.calls[1].options.credentials,'same-origin');
  assert.equal(f.calls[1].options.headers['X-KK-CSRF'],'csrf-only-from-server');
  assert.deepEqual(JSON.parse(f.calls[1].options.body),{accept:true,terms_version:version});
  assert.equal(f.gate.hidden,true);
  assert.equal(f.values.get('kk_booking_terms_prompt_version'),version);
});
test('unverified LINE guest must login; checkbox never creates a forged consent receipt',async()=>{
  const f=fixture({previousCookie:'kk_booking_terms_prompt_version='+version,
    session:{authenticated:false,skip_agreement:false,terms_version:version}});
  await f.flush();
  assert.equal(f.gate.hidden,false,'stale local cookie cannot bypass identity');
  assert.equal(f.values.size,0);
  f.checked();
  await f.confirm.handlers.click();
  assert.equal(f.gate.hidden,false,'login is not acceptance');
  assert.deepEqual(f.redirects,['/api/kk-customer-auth?action=start']);
  assert.equal(f.calls.length,1,'no acceptance API post from an unauthenticated guest');
});
test('private backend unavailable leaves gate locked, never trusts local cookie',async()=>{
  const f=fixture({previousCookie:'kk_booking_terms_prompt_version='+version,throwOnSession:true});
  await f.flush();
  assert.equal(f.gate.hidden,false);
  assert.equal(f.values.size,0);
  assert.match(f.confirm.textContent,/ลองเชื่อม LINE/);
  f.checked();
  await f.confirm.handlers.click();
  await f.flush();
  assert.equal(f.gate.hidden,false);
  assert.equal(f.calls.filter(x=>x.url.endsWith('action=accept')).length,0);
});
test('failed acceptance write never unlocks booking or manufactures a browser receipt',async()=>{
  const f=fixture({session:{authenticated:true,skip_agreement:false,terms_version:version,csrf:'csrf'},accept:{ok:false}});
  await f.flush();
  f.checked();
  await f.confirm.handlers.click();
  assert.equal(f.gate.hidden,false);
  assert.equal(f.values.size,0);
  assert.equal(f.cookie,'');
  assert.match(f.note.textContent,/ยังไม่บันทึก/);
});
