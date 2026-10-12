'use strict';

const crypto=require('node:crypto');
const Intake=require('./line-booking-intake');

const VERSION='KK_LINE_BOOKING_OWNER_APPROVAL_V1';
const VERSION_V2='KK_LINE_BOOKING_OWNER_APPROVAL_V2';
const APPROVAL_VERSION=/^[a-f0-9]{64}$/i;
const MAX_CHALLENGE_SECONDS=24*60*60;
function version2Enabled(env=process.env){return enabled(env.KK_LINE_OWNER_APPROVAL_V2_ENABLED);}
const LINE_PUSH_URL='https://api.line.me/v2/bot/message/push';
const LINE_REPLY_URL='https://api.line.me/v2/bot/message/reply';

function text(v){return String(v===undefined||v===null?'':v).trim();}
function enabled(v){return /^(1|true|yes|on)$/i.test(text(v));}
function ownerUserId(env=process.env){return text(env.KK_OWNER_LINE_USER_ID);}
function ownerTargetId(env=process.env){return text(env.KK_OWNER_LINE_TARGET_ID)||ownerUserId(env);}
function approvalSecret(env=process.env){return text(env.KK_LINE_APPROVAL_SECRET)||text(env.LINE_CHANNEL_SECRET);}
function looksLikeAppsScriptUrl(value){
  try{
    const u=new URL(text(value));
    return u.protocol==='https:'&&u.host==='script.google.com'&&/\/macros\/s\/[^/]+\/exec$/.test(u.pathname);
  }catch(_){return false;}
}
function automationReadiness(env=process.env){
  const reasons=[];
  if(!enabled(env.KK_LINE_BOOKING_AUTOMATION_ENABLED)) reasons.push('AUTOMATION_DISABLED');
  if(!looksLikeAppsScriptUrl(env.KK_ADMIN_SCRIPT_URL)) reasons.push('APPS_SCRIPT_URL_MISSING');
  if(!text(env.KK_ADMIN_API_KEY)) reasons.push('APPS_SCRIPT_API_KEY_MISSING');
  if(!text(env.LINE_CHANNEL_ACCESS_TOKEN)) reasons.push('LINE_ACCESS_TOKEN_MISSING');
  if(!approvalSecret(env)) reasons.push('APPROVAL_SECRET_MISSING');
  if(!ownerUserId(env)) reasons.push('OWNER_USER_ID_MISSING');
  if(!ownerTargetId(env)) reasons.push('OWNER_TARGET_ID_MISSING');
  if(version2Enabled(env) && !enabled(env.KK_LINE_OWNER_APPROVAL_V2_SOURCE_READY)) reasons.push('OWNER_V2_CANONICAL_APPS_SCRIPT_UNVERIFIED');
  return {version:VERSION,ready:reasons.length===0,reasons};
}
async function appsScriptCall(payload,env=process.env,fetchImpl=fetch){
  const ready=automationReadiness(env);
  if(!ready.ready){
    const err=new Error('LINE booking automation is not ready: '+ready.reasons.join(','));
    err.code='LINE_BOOKING_AUTOMATION_NOT_READY';
    err.reasons=ready.reasons;
    throw err;
  }
  const body=Object.assign({},payload,{
    apiKey:text(env.KK_ADMIN_API_KEY),
    source:'LINE_OWNER_APPROVAL',
    automation_version:VERSION
  });
  const r=await fetchImpl(text(env.KK_ADMIN_SCRIPT_URL),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const raw=await r.text();
  let parsed={};
  try{parsed=raw?JSON.parse(raw):{};}catch(_){
    const err=new Error('Apps Script returned non-JSON response');
    err.code='LINE_BOOKING_UPSTREAM_NON_JSON';
    err.status=r.status;
    throw err;
  }
  if(!r.ok||!parsed||parsed.ok!==true){
    const err=new Error(text(parsed&&parsed.error)||('Apps Script booking write failed '+r.status));
    err.code=text(parsed&&parsed.error_code)||'LINE_BOOKING_UPSTREAM_FAILED';
    err.status=r.status;
    throw err;
  }
  return parsed;
}
async function createPendingBooking(event,booking,canonical,env=process.env,fetchImpl=fetch){
  if(!text(event&&event.source&&event.source.userId)){
    const err=new Error('LINE customer userId is required for governed owner approval');
    err.code='LINE_CUSTOMER_USER_ID_REQUIRED';
    throw err;
  }
  const intent=Intake.prepareBookingIntent(event,booking,canonical);
  if(!intent.ok){
    const err=new Error(intent.code);
    err.code=intent.code;
    throw err;
  }
  const payload=Object.assign({},intent.payload);
  // Compatibility contract: legacy pending intake never requires V2 commercial
  // fingerprint computation. Enable only after the Apps Script V2 deployment
  // and its canonical price/date readback are independently accepted.
  if(version2Enabled(env)) payload.approval_mode='v2';
  const result=await appsScriptCall(payload,env,fetchImpl);
  const canonicalResult=Intake.canonicalResult(result);
  if(!canonicalResult.ok){
    const err=new Error(canonicalResult.code);
    err.code=canonicalResult.code;
    throw err;
  }
  const data=result&&result.data||result||{};
  const approvalVersion=text(data.approval_version);
  if(version2Enabled(env) && !APPROVAL_VERSION.test(approvalVersion)){
    const err=new Error('Canonical approval version missing from pending intake');
    err.code='LINE_OWNER_APPROVAL_VERSION_REQUIRED';
    throw err;
  }
  return Object.assign({status:'PENDING_CREATED',request_id:intent.payload.request_id,
    approval_version:approvalVersion},canonicalResult);
}
function sigFor(decision,bookingId,secret){
  return crypto.createHmac('sha256',secret)
    .update([VERSION,decision,bookingId].join('|'),'utf8')
    .digest('base64url')
    .slice(0,24);
}
function sigForV2(decision,bookingId,version,expiry,secret){
  return crypto.createHmac('sha256',secret)
    .update([VERSION_V2,decision,bookingId,version,String(expiry)].join('|'),'utf8')
    .digest('base64url').slice(0,24);
}
function decisionData(decision,bookingId,env=process.env,approvalVersion='',now=Date.now()){
  const d=decision==='approve'?'approve':decision==='reject'?'reject':'';
  const bid=text(bookingId), secret=approvalSecret(env);
  if(!d||!bid||!secret) throw Object.assign(new Error('approval data incomplete'),{code:'LINE_APPROVAL_DATA_INCOMPLETE'});
  if(version2Enabled(env)){
    const ver=text(approvalVersion);
    if(!APPROVAL_VERSION.test(ver)){
      throw Object.assign(new Error('canonical version required'),{code:'LINE_OWNER_APPROVAL_VERSION_REQUIRED'});
    }
    const expiry=Math.floor(Number(now)/1000)+MAX_CHALLENGE_SECONDS;
    return ['kkb2',d,bid,ver,String(expiry),sigForV2(d,bid,ver,expiry,secret)].join('|');
  }
  return ['kkb1',d,bid,sigFor(d,bid,secret)].join('|');
}
function parseDecisionData(value,env=process.env,now=Date.now()){
  const raw=text(value),v2=version2Enabled(env);
  if(v2){
    const parts=raw.split('|');
    if(parts.length!==6||parts[0]!=='kkb2')return null;
    const [,decision,bookingId,version,expiresRaw,sig]=parts;
    const expiration=Number(expiresRaw),nowSecs=Math.floor(Number(now)/1000);
    if(!['approve','reject'].includes(decision)||!bookingId||
       !APPROVAL_VERSION.test(version)||!/^[0-9]{10}$/.test(expiresRaw)||
       !Number.isSafeInteger(expiration)||expiration<=nowSecs||
       expiration>nowSecs+MAX_CHALLENGE_SECONDS||!sig)return null;
    const secret=approvalSecret(env);
    if(!secret)return null;
    const expected=sigForV2(decision,bookingId,version,expiration,secret);
    const a=Buffer.from(expected),b=Buffer.from(sig);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
    return {decision,booking_id:bookingId,approval_version:version,
      expires_at:expiration,protocol:'kkb2'};
  }
  const parts=text(value).split('|');
  if(parts.length!==4||parts[0]!=='kkb1') return null;
  const [,decision,bookingId,sig]=parts;
  if(!['approve','reject'].includes(decision)||!bookingId||!sig) return null;
  const secret=approvalSecret(env);
  if(!secret) return null;
  const expected=sigFor(decision,bookingId,secret);
  const a=Buffer.from(expected),b=Buffer.from(sig);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return null;
  return {decision,booking_id:bookingId};
}
function ownerApprovalMessage(ctx={},env=process.env){
  const bookingId=text(ctx.booking_id);
  const approvalVersion=text(ctx.approval_version);
  const approve=decisionData('approve',bookingId,env,approvalVersion);
  const reject=decisionData('reject',bookingId,env,approvalVersion);
  const eventName=text(ctx.event_name)||'-';
  const date=text(ctx.event_date)||'-';
  const packageName=text(ctx.package_name)||'-';
  const price=text(ctx.price_display)||'-';
  const customer=text(ctx.nickname)||'-';
  const phone=text(ctx.phone)||'-';
  const pickup=text(ctx.pickup_time)||'-';
  return {
    type:'flex',
    altText:('Booking รออนุมัติ • '+eventName).slice(0,400),
    contents:{
      type:'bubble',
      body:{type:'box',layout:'vertical',spacing:'sm',contents:[
        {type:'text',text:'Booking รออนุมัติ',weight:'bold',size:'lg'},
        {type:'text',text:eventName,weight:'bold',wrap:true},
        {type:'text',text:'Booking ID  '+bookingId,size:'sm',wrap:true},
        {type:'text',text:'วันที่  '+date,size:'sm',wrap:true},
        {type:'text',text:'แพ็กเกจ  '+packageName,size:'sm',wrap:true},
        {type:'text',text:'ราคา  '+price,size:'sm',weight:'bold',wrap:true},
        {type:'separator',margin:'md'},
        {type:'text',text:'ลูกค้า  '+customer,size:'sm',wrap:true,margin:'md'},
        {type:'text',text:'โทร  '+phone,size:'sm',wrap:true},
        {type:'text',text:'เวลารับ  '+pickup,size:'sm',wrap:true}
      ]},
      footer:{type:'box',layout:'horizontal',spacing:'sm',contents:[
        {type:'button',style:'primary',action:{type:'postback',label:'Confirm',data:approve,displayText:'Confirm '+bookingId}},
        {type:'button',style:'secondary',action:{type:'postback',label:'Reject',data:reject,displayText:'Reject '+bookingId}}
      ]}
    }
  };
}
async function sendLine(url,body,token,fetchImpl=fetch){
  const r=await fetchImpl(url,{
    method:'POST',
    headers:{Authorization:'Bearer '+text(token),'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok){
    const raw=await r.text().catch(()=>'');
    const err=new Error('LINE send failed '+r.status+' '+raw.slice(0,160));
    err.code='LINE_SEND_FAILED';
    err.status=r.status;
    throw err;
  }
  return {ok:true};
}
function pushMessage(to,message,env=process.env,fetchImpl=fetch){
  return sendLine(LINE_PUSH_URL,{to,messages:[message]},env.LINE_CHANNEL_ACCESS_TOKEN,fetchImpl);
}
function replyMessage(replyToken,message,env=process.env,fetchImpl=fetch){
  return sendLine(LINE_REPLY_URL,{replyToken,messages:[message]},env.LINE_CHANNEL_ACCESS_TOKEN,fetchImpl);
}
async function notifyOwner(context,env=process.env,fetchImpl=fetch){
  const ready=automationReadiness(env);
  if(!ready.ready) return {status:'DISABLED',reasons:ready.reasons};
  await pushMessage(ownerTargetId(env),ownerApprovalMessage(context,env),env,fetchImpl);
  return {status:'OWNER_NOTIFIED',target:ownerTargetId(env)};
}
function customerDecisionMessage(decision,bookingId){
  if(decision==='approve') return {type:'text',text:'✅ ยืนยันการจองแล้ว\nBooking ID: '+bookingId+'\nร้านจะใช้ข้อมูลนี้ในการเตรียมอุปกรณ์และนัดรับต่อไป'};
  return {type:'text',text:'❌ คำขอเช่า '+bookingId+' ยังไม่สามารถยืนยันได้\nหากต้องการเปลี่ยนงาน/แพ็กเกจ กรุณาส่งคำขอใหม่'};
}
function ownerDecisionMessage(decision,bookingId){
  return {type:'text',text:(decision==='approve'?'✅ Confirmed ':'❌ Rejected ')+bookingId};
}
async function processOwnerPostback(event,env=process.env,fetchImpl=fetch){
  if(!event||event.type!=='postback'||!event.postback) return {handled:false};
  const parsed=parseDecisionData(event.postback.data,env);
  if(!parsed) return {handled:false};
  const actor=text(event.source&&event.source.userId);
  if(!ownerUserId(env)||actor!==ownerUserId(env)){
    return {handled:true,status:'UNAUTHORIZED_OWNER',booking_id:parsed.booking_id};
  }
  const decision=parsed.decision;
  const result=await appsScriptCall({
    action:parsed.protocol==='kkb2'?'decideLineBookingPendingV2':'decideLineBookingPending',
    booking_id:parsed.booking_id,
    decision,
    ...(parsed.protocol==='kkb2'?{expected_version:parsed.approval_version}:{})
  },env,fetchImpl);
  const data=result&&result.data||result||{};
  // Owner callbacks are valid only against the same canonical booking identity.
  // A stale/wrong upstream readback must never notify another customer's LINE ID.
  if(text(data.booking_id)!==parsed.booking_id){
    const err=new Error('Owner decision booking identity mismatch');
    err.code='LINE_OWNER_DECISION_BOOKING_ID_MISMATCH';
    throw err;
  }
  if(parsed.protocol==='kkb2' &&
     text(data.approved_version)!==parsed.approval_version){
    const err=new Error('Canonical version verification missing');
    err.code='LINE_OWNER_DECISION_VERSION_READBACK_MISMATCH';
    throw err;
  }
  const expected=decision==='approve'?'confirmed':'cancelled';
  if(text(data.booking_status).toLowerCase()!==expected){
    const err=new Error('Owner decision readback mismatch');
    err.code='LINE_OWNER_DECISION_READBACK_MISMATCH';
    throw err;
  }
  // V2 must return an explicit replay decision from the canonical locked writer.
  // An absent or stringified flag must never be treated as a first-time send.
  if(parsed.protocol==='kkb2' && typeof data.idempotent_replay!=='boolean'){
    const err=new Error('Canonical replay status missing after owner decision');
    err.code='LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED';
    throw err;
  }
  // The atomic pending-only Apps Script writer labels retries idempotent_replay.
  // Never re-send customer or owner notifications for a replayed callback: an
  // ambiguous prior provider send requires manual delivery reconciliation, not
  // another potentially duplicate message.
  if(data.idempotent_replay===true){
    return {handled:true,status:'ALREADY_APPLIED',booking_id:parsed.booking_id,
      idempotent_replay:true,customer_notifications:0,owner_notifications:0,
      requires_manual_delivery_review:true};
  }
  const customerUserId=text(data.customer_contact);
  if(!customerUserId){
    const err=new Error('Canonical LINE customer contact missing after owner decision');
    err.code='LINE_CUSTOMER_CONTACT_READBACK_REQUIRED';
    throw err;
  }
  const sends=[];
  if(event.replyToken) sends.push(replyMessage(event.replyToken,ownerDecisionMessage(decision,parsed.booking_id),env,fetchImpl));
  sends.push(pushMessage(customerUserId,customerDecisionMessage(decision,parsed.booking_id),env,fetchImpl));
  await Promise.all(sends);
  return {handled:true,status:expected.toUpperCase(),booking_id:parsed.booking_id,idempotent_replay:Boolean(data.idempotent_replay)};
}

module.exports={
  VERSION,VERSION_V2,version2Enabled,automationReadiness,ownerUserId,ownerTargetId,approvalSecret,
  appsScriptCall,createPendingBooking,decisionData,parseDecisionData,
  ownerApprovalMessage,notifyOwner,processOwnerPostback,
  customerDecisionMessage,ownerDecisionMessage,pushMessage,replyMessage
};
