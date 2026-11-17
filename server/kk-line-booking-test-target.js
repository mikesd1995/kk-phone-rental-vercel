'use strict';
const crypto=require('node:crypto');
const {isIP}=require('node:net');
const Admission=require('./kk-line-booking-test-admission');
const VERSION='KK_LINE_BOOKING_TEST_TARGET_V1';
const PRODUCTION_ORIGIN='https://kk-phone-rental.vercel.app';
const FIELDS=['ORIGIN','SCOPE','WINDOW_START','WINDOW_END','EVENT_IDS'].map(s=>'KK_LINE_BOOKING_TEST_'+s);
function fail(code='LINE_BOOKING_TEST_TARGET_INVALID'){throw Object.assign(new Error(code),{code});}
function configuration(env={}){
 const admission=Admission.configuration(env);
 if(!admission.enabled){
  if(FIELDS.some(key=>env[key]!==undefined))fail();
  return Object.freeze({enabled:false,origin:PRODUCTION_ORIGIN});
 }
 Admission.assertOwnerAllowed(env,admission);
 const raw=env.KK_LINE_BOOKING_TEST_ORIGIN;let url;
 try{url=new URL(raw);}catch(_){fail();}
 if(typeof raw!=='string'||url.origin!==raw||url.protocol!=='https:'||url.username||url.password||url.port
  ||url.origin===PRODUCTION_ORIGIN||url.hostname==='www.kk-phone-rental.vercel.app'
  ||url.hostname.endsWith('.')||isIP(url.hostname.replace(/^\[|\]$/g,''))
  ||url.hostname==='localhost'||/\.(?:localhost|local)$/.test(url.hostname))fail();
 const scope=env.KK_LINE_BOOKING_TEST_SCOPE;
 if(typeof scope!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(scope))fail();
 const stamp=key=>{const raw=env[key],value=Date.parse(raw);if(typeof raw!=='string'||!Number.isFinite(value)||new Date(value).toISOString()!==raw)fail();return value;};
 const start=stamp(FIELDS[2]),end=stamp(FIELDS[3]);
 if(end<=start||end-start>3600000)fail();
 const rawEvents=env.KK_LINE_BOOKING_TEST_EVENT_IDS;
 if(typeof rawEvents!=='string')fail();
 const eventIds=rawEvents.split(',');
 if(eventIds.length<1||eventIds.length>10||new Set(eventIds).size!==eventIds.length
  ||eventIds.some(id=>!/^EVT-[A-Za-z0-9-]{3,180}$/.test(id)))fail();
 const key=env.KK_LINE_APPROVAL_SECRET;
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(key)
  ||['LINE_CHANNEL_SECRET','KK_ADMIN_API_KEY','KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET','KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET'].some(name=>key===String(env[name]??'').trim()))fail();
 const cfg={enabled:true,origin:url.origin,scope,start,end,eventIds:Object.freeze(eventIds),admission};
 Object.defineProperty(cfg,'signingKey',{value:key});
 return Object.freeze(cfg);
}
function withinWindow(cfg,now=Date.now()){return !cfg.enabled||(Number.isSafeInteger(now)&&now>=cfg.start&&now<=cfg.end);}
function assertNow(cfg,now=Date.now()){if(!withinWindow(cfg,now))fail('LINE_BOOKING_TEST_WINDOW_CLOSED');}
function assertHost(req,cfg){
 if(cfg.enabled&&(req?.headers?.host??req?.headers?.Host)!==new URL(cfg.origin).host)fail('LINE_BOOKING_TEST_TARGET_HOST_MISMATCH');
}
function guardFetch(fetchImpl,cfg){
 return !cfg.enabled?fetchImpl:async(...args)=>{assertNow(cfg);return fetchImpl(...args);};
}
function isEventAllowed(event,cfg,now=Date.now()){
 return !cfg.enabled||(withinWindow(cfg,now)&&Admission.isEventAllowed(event,cfg.admission)
  &&Number.isSafeInteger(event?.timestamp)&&event.timestamp>=cfg.start&&event.timestamp<=cfg.end&&event.timestamp<=now+30000);
}
function isCanonicalAllowed(canonical,cfg){return !cfg.enabled||cfg.eventIds.includes(canonical?.event_id);}
function assertDurable(env,cfg){
 if(cfg.enabled&&['KK_LINE_BOOKING_AUTOMATION_ENABLED','KK_LINE_INITIAL_OUTBOX_V1_ENABLED','KK_LINE_OWNER_OUTBOX_V1_ENABLED'].some(k=>env[k]!=='true'))
  fail('LINE_BOOKING_TEST_DURABLE_REQUIRED');
}
function binding(cfg){return [VERSION,cfg.scope,cfg.origin,cfg.start,cfg.end,[...cfg.eventIds].sort()];}
function signature(parts,cfg){return crypto.createHmac('sha256',cfg.signingKey).update(JSON.stringify([...binding(cfg),...parts]),'utf8').digest('base64url').slice(0,24);}
function scopedEvent(event,cfg){
 if(!cfg.enabled)return event;
 const id=event?.webhookEventId;
 if(typeof id!=='string'||!id.trim())fail('LINE_EVENT_ID_REQUIRED');
 return {...event,webhookEventId:'s2:'+signature(['line-event',id],cfg)};
}
function posterSource(raw,cfg){
 if(!cfg.enabled)return '';
 let u;try{u=new URL(String(raw||''),cfg.origin);}catch(_){return '';}
 return u.origin===cfg.origin&&!u.username&&!u.password&&!u.search&&!u.hash
  &&u.pathname.startsWith('/assets/event-posters/')?u.href:'';
}
function readOptions(options,cfg){return cfg.enabled?{...options,redirect:'error'}:options;}
function validReadResponse(response,cfg){
 if(!cfg.enabled)return true;
 if(response?.redirected===true||(response?.status>=300&&response?.status<400))return false;
 if(response?.url){try{if(new URL(response.url).origin!==cfg.origin)return false;}catch(_){return false;}}
 return true;
}
module.exports={VERSION,PRODUCTION_ORIGIN,configuration,withinWindow,assertNow,assertHost,guardFetch,isEventAllowed,isCanonicalAllowed,
 assertDurable,signature,scopedEvent,posterSource,readOptions,validReadResponse};
