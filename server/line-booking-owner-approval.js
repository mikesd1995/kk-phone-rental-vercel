'use strict';

const crypto=require('node:crypto');
const Intake=require('./line-booking-intake');
const TermsEvidence=require('./kk-booking-terms-evidence');
const DurableOutbox=require('./line-owner-durable-outbox');
const LineIdentity=require('./kk-line-identity');
const Deadline=require('./line-booking-deadline');
const InitialOutbox=require('./line-initial-durable-outbox');
const TestAdmission=require('./kk-line-booking-test-admission');
const TestTarget=require('./kk-line-booking-test-target');

const VERSION='KK_LINE_BOOKING_OWNER_APPROVAL_V1';
const LINE_PUSH_URL='https://api.line.me/v2/bot/message/push';
const LINE_REPLY_URL='https://api.line.me/v2/bot/message/reply';
// LINE-issued IDs are provider-scoped: user U + 32 lowercase hex;
// a configured push destination may also be a group C or room R.
// Reject malformed environment bindings BEFORE a canonical pending write.
// Shared by pending customer intake and durable delivery to prevent regex drift.

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
  else if(!LineIdentity.isUserId(ownerUserId(env))) reasons.push('OWNER_USER_ID_INVALID');
  if(!ownerTargetId(env)) reasons.push('OWNER_TARGET_ID_MISSING');
  else if(!LineIdentity.isPushTarget(ownerTargetId(env))) reasons.push('OWNER_TARGET_ID_INVALID');
  return {version:VERSION,ready:reasons.length===0,reasons};
}
async function appsScriptCall(payload,env=process.env,fetchImpl=fetch){
  const target=TestTarget.configuration(env);
  TestTarget.assertNow(target);TestTarget.assertDurable(env,target);
  fetchImpl=TestTarget.guardFetch(fetchImpl,target);
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
  let r,raw;
  try{
    await Deadline.fetchWithDeadline(fetchImpl,text(env.KK_ADMIN_SCRIPT_URL),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    },async response=>{
      r=response;
      raw=await response.text();
    });
  }catch(_){
    // Both transport exceptions and response-body read exceptions are untrusted.
    // Never let provider/redirect details reach webhook error logs.
    const err=new Error('Apps Script booking transport failed');
    err.code='LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED';
    if(r&&Number.isInteger(r.status))err.status=r.status;
    throw err;
  }
  let parsed={};
  try{parsed=raw?JSON.parse(raw):{};}catch(_){
    const err=new Error('Apps Script returned non-JSON response');
    err.code='LINE_BOOKING_UPSTREAM_NON_JSON';
    err.status=r.status;
    throw err;
  }
  if(!r.ok||!parsed||parsed.ok!==true){
    // Upstream errors are untrusted and may contain customer contact, Booking
    // IDs or credentials. Never reflect their text or error_code into webhook logs.
    const err=new Error('Apps Script booking action failed');
    err.code='LINE_BOOKING_UPSTREAM_FAILED';
    err.status=r.status;
    throw err;
  }
  return parsed;
}
async function createPendingBooking(event,booking,canonical,env=process.env,fetchImpl=fetch,options={}){
  const target=TestTarget.configuration(env);
  if(target.enabled){
    if(!TestTarget.isEventAllowed(event,target)||!TestTarget.isCanonicalAllowed(canonical,target))
      throw Object.assign(new Error('Test event denied'),{code:'LINE_BOOKING_TEST_EVENT_DENIED'});
    TestTarget.assertDurable(env,target);
  }
  if(!text(event&&event.source&&event.source.userId)){
    const err=new Error('LINE customer userId is required for governed owner approval');
    err.code='LINE_CUSTOMER_USER_ID_REQUIRED';
    throw err;
  }
  const intent=Intake.prepareBookingIntent(TestTarget.scopedEvent(event,target),booking,canonical);
  if(!intent.ok){
    const err=new Error(intent.code);
    err.code=intent.code;
    throw err;
  }
  let initialExpected;
  if(InitialOutbox.enabled(env)){
    const secret=InitialOutbox.configuration(env);
    const raw=options.initialContext;
    const digest=typeof raw==='string'?InitialOutbox.hash(raw):'';
    InitialOutbox.parseContext(raw,digest);
    const readiness=await appsScriptCall({action:'lineInitialOutboxReadiness',initial_dispatch_key:secret},env,fetchImpl);
    const proof=readiness&&readiness.data||readiness||{};
    if(proof.ready!==true||proof.initial_outbox_mode!==InitialOutbox.VERSION||proof.columns!==14
      ||proof.owner_target!==ownerTargetId(env)){
      throw Object.assign(new Error('Initial outbox preflight not verified'),{code:'LINE_INITIAL_OUTBOX_PREFLIGHT_FAILED'});
    }
    intent.payload.initial_dispatch_key=secret;
    intent.payload.initial_notification={mode:InitialOutbox.VERSION,owner_target:ownerTargetId(env),context_json:raw,context_hash:digest};
    initialExpected={requestId:intent.payload.request_id,contextHash:digest,
      ownerTarget:ownerTargetId(env),customer:intent.payload.customer_contact};
  }
  const result=await appsScriptCall(intent.payload,env,fetchImpl);
  const canonicalResult=Intake.canonicalResult(result);
  if(!canonicalResult.ok){
    const err=new Error(canonicalResult.code);
    err.code=canonicalResult.code;
    throw err;
  }
  if(initialExpected){
    const data=result&&result.data||result||{};
    if(canonicalResult.idempotent_replay!==true)
      throw Object.assign(new Error('Initial outbox replay fence missing'),{code:'LINE_INITIAL_OUTBOX_READBACK_REQUIRED'});
    InitialOutbox.validateEnvelope(data.initial_outbox,{...initialExpected,bookingId:canonicalResult.booking_id});
    canonicalResult.initial_outbox=data.initial_outbox;
  }
  return Object.assign({status:'PENDING_CREATED',request_id:intent.payload.request_id},canonicalResult);
}
function sigFor(decision,bookingId,secret){
  return crypto.createHmac('sha256',secret)
    .update([VERSION,decision,bookingId].join('|'),'utf8')
    .digest('base64url')
    .slice(0,24);
}
function decisionData(decision,bookingId,env=process.env,requestId=''){
  const d=decision==='approve'?'approve':decision==='reject'?'reject':'';
  const bid=text(bookingId), secret=approvalSecret(env);
  if(!d||!bid||!secret) throw Object.assign(new Error('approval data incomplete'),{code:'LINE_APPROVAL_DATA_INCOMPLETE'});
  const target=TestTarget.configuration(env);
  if(target.enabled){
    if(!/^line:[a-f0-9]{48}$/.test(requestId)||bid.length>128||/[|\r\n]/.test(bid))
      throw Object.assign(new Error('Test approval provenance required'),{code:'LINE_APPROVAL_TEST_PROVENANCE_REQUIRED'});
    return ['kkt1',d,bid,requestId,TestTarget.signature(['postback',d,bid,requestId],target)].join('|');
  }
  return ['kkb1',d,bid,sigFor(d,bid,secret)].join('|');
}
function parseDecisionData(value,env=process.env){
  const parts=text(value).split('|');
  const target=TestTarget.configuration(env);
  if(target.enabled){
    if(parts.length!==5||parts[0]!=='kkt1')return null;
    const [,decision,bookingId,requestId,sig]=parts;
    if(!['approve','reject'].includes(decision)||!bookingId||bookingId.length>128
      ||!/^line:[a-f0-9]{48}$/.test(requestId)||!/^[A-Za-z0-9_-]{24}$/.test(sig))return null;
    const expected=TestTarget.signature(['postback',decision,bookingId,requestId],target);
    if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))return null;
    return {decision,booking_id:bookingId,request_id:requestId};
  }
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
  const approve=decisionData('approve',bookingId,env,text(ctx.request_id));
  const reject=decisionData('reject',bookingId,env,text(ctx.request_id));
  const eventName=text(ctx.event_name)||'-';
  const date=text(ctx.event_date)||'-';
  const packageName=text(ctx.package_name)||'-';
  const price=text(ctx.price_display)||'-';
  const customer=text(ctx.nickname)||'-';
  const phone=text(ctx.phone);
  const contactLabel=phone?'โทร  '+phone:'ติดต่อทาง LINE · ไม่ระบุเบอร์โทรศัพท์';
  const pickup=text(ctx.pickup_time)||'-';
  const version=TermsEvidence.VERSION;
  const lineAck=text(ctx.terms_status)==='LINE_MESSAGE_CONFIRMED' && text(ctx.terms_version)===version;
  const identityAck=text(ctx.terms_status)==='VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED' && text(ctx.terms_version)===version;
  const termsLabel=identityAck?'✅ ยอมรับเงื่อนไขแล้ว (ยืนยัน LINE User ID จากหลักฐานหลังบ้าน · '+version+')':
    lineAck?'✅ พบข้อความยอมรับเงื่อนไขใน LINE ('+version+')':
    '⚠️ ยังไม่พบข้อความยอมรับเงื่อนไข — ขอคำยืนยันทาง LINE ก่อนอนุมัติ';
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
        {type:'text',text:contactLabel,size:'sm',wrap:true},
        {type:'text',text:'เวลารับ  '+pickup,size:'sm',wrap:true},
        {type:'text',text:termsLabel,size:'xs',wrap:true,color:(lineAck||identityAck)?'#18794E':'#B45309'}
      ]},
      footer:{type:'box',layout:'horizontal',spacing:'sm',contents:[
        {type:'button',style:'primary',action:{type:'postback',label:'Confirm',data:approve,displayText:'Confirm '+bookingId}},
        {type:'button',style:'secondary',action:{type:'postback',label:'Reject',data:reject,displayText:'Reject '+bookingId}}
      ]}
    }
  };
}
async function sendLine(url,body,token,fetchImpl=fetch){
  let r;
  try{
    r=await Deadline.fetchWithDeadline(fetchImpl,url,{
      method:'POST',
      headers:{Authorization:'Bearer '+text(token),'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
  }catch(_){
    // Network/TLS/provider errors can also embed request or customer content.
    const err=new Error('LINE send transport failed');
    err.code='LINE_SEND_TRANSPORT_FAILED';
    throw err;
  }
  if(!r.ok){
    // Provider response text can reflect private recipient/message details.
    // Keep a fixed diagnostic and HTTP status; do not log upstream body.
    const err=new Error('LINE send failed');
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
  if(TestTarget.configuration(env).enabled)
    throw Object.assign(new Error('Test initial durable delivery required'),{code:'LINE_BOOKING_TEST_DURABLE_REQUIRED'});
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
  const admission=TestAdmission.configuration(env);
  TestAdmission.assertOwnerAllowed(env,admission);
  if(!TestAdmission.isEventAllowed(event,admission)) return {handled:false};
  const target=TestTarget.configuration(env);
  if(!TestTarget.isEventAllowed(event,target))return {handled:false};
  fetchImpl=TestTarget.guardFetch(fetchImpl,target);
  if(!event||event.type!=='postback'||!event.postback) return {handled:false};
  TestTarget.assertDurable(env,target);
  const parsed=parseDecisionData(event.postback.data,env);
  if(!parsed) return target.enabled?{handled:true,status:'TEST_POSTBACK_DENIED'}:{handled:false};
  const actor=text(event.source&&event.source.userId);
  if(!ownerUserId(env)||actor!==ownerUserId(env)){
    return {handled:true,status:'UNAUTHORIZED_OWNER',booking_id:parsed.booking_id};
  }
  const decision=parsed.decision;
  // Verify the canonical writer's feature flag and private outbox schema
  // BEFORE deciding a booking. A half-deployed migration must never commit
  // the decision and then discover that notification durability is absent.
  if(enabled(env.KK_LINE_OWNER_OUTBOX_V1_ENABLED)){
    if(!/^[A-Za-z0-9_-]{32,128}$/.test(text(env.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET))){
      const err=new Error('Owner outbox dispatch credential unavailable');
      err.code='LINE_OWNER_OUTBOX_DISPATCH_NOT_READY';
      throw err;
    }
    const readiness=await appsScriptCall({
      action:'lineOwnerOutboxReadiness',
      outbox_dispatch_key:text(env.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET)
    },env,fetchImpl);
    const proof=readiness&&readiness.data||readiness||{};
    if(proof.ready!==true||proof.outbox_mode!==DurableOutbox.VERSION||proof.columns!==11){
      const err=new Error('Canonical LINE owner outbox readiness not verified');
      err.code='LINE_OWNER_OUTBOX_PREFLIGHT_FAILED';
      throw err;
    }
  }
  const result=await appsScriptCall({
    action:'decideLineBookingPending',
    booking_id:parsed.booking_id,
    decision,
    ...(enabled(env.KK_LINE_OWNER_OUTBOX_V1_ENABLED) ? {
      outbox_dispatch_key:text(env.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET)
    } : {})
  },env,fetchImpl);
  const data=result&&result.data||result||{};
  // The canonical writer must confirm the same booking we authorized.
  // A mismatched response must never trigger a customer notification.
  if(text(data.booking_id)!==parsed.booking_id){
    const err=new Error('Owner decision booking identity readback mismatch');
    err.code='LINE_OWNER_DECISION_BOOKING_ID_MISMATCH';
    throw err;
  }
  if(data.terms_confirmation_required===true){
    if(decision!=='approve' || text(data.booking_status)!=='pending' ||
       data.idempotent_replay!==true){
      throw Object.assign(new Error('Native consent wait readback mismatch'),
        {code:'LINE_NATIVE_CONSENT_READBACK_FAILED'});
    }
    if(event.replyToken){
      await replyMessage(event.replyToken,{
        type:'text',text:'⏳ ยังยืนยันการจองไม่ได้ ลูกค้าต้องกดยอมรับเงื่อนไขใน LINE ก่อน กรุณาลอง Confirm อีกครั้งหลังลูกค้ายืนยันค่ะ'
      },env,fetchImpl);
    }
    return {handled:true,status:'WAITING_CUSTOMER_CONSENT',booking_id:parsed.booking_id,
      customer_notifications:0,owner_notifications:0};
  }
  // Current locked Apps Script writer returns the requested decision in
  // readback. A conflicting value blocks sends even if status looks plausible.
  // Missing value remains compatible with older deployment contracts.
  if(data.decision!==undefined&&text(data.decision)!==decision){
    const err=new Error('Owner decision readback mismatch');
    err.code='LINE_OWNER_DECISION_READBACK_MISMATCH';
    throw err;
  }
  const expected=decision==='approve'?'confirmed':'cancelled';
  if(text(data.booking_status).toLowerCase()!==expected){
    const err=new Error('Owner decision readback mismatch');
    err.code='LINE_OWNER_DECISION_READBACK_MISMATCH';
    throw err;
  }
  // Missing/stringified replay evidence must never authorize another LINE send.
  if(typeof data.idempotent_replay!=='boolean'){
    const err=new Error('Canonical replay status not verified');
    err.code='LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED';
    throw err;
  }
  // Feature-gated migration: when the canonical writer has an outbox,
  // only its one-time durable claim can authorize LINE provider traffic.
  // If the server is enabled before the writer, missing evidence fails closed.
  // If the writer is enabled first, its idempotent_replay=true prevents this
  // legacy branch from sending without an outbox claim.
  if(enabled(env.KK_LINE_OWNER_OUTBOX_V1_ENABLED)){
    return DurableOutbox.deliverDecision({
      data, bookingId:parsed.booking_id, decision,
      customerMessage:customerDecisionMessage(decision,parsed.booking_id)
    },{
      appsScriptCall:p=>appsScriptCall(p,env,fetchImpl),
      lineToken:env.LINE_CHANNEL_ACCESS_TOKEN,
      dispatchSecret:text(env.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET),
      fetchImpl,
      replyOwner:event.replyToken?()=>
        replyMessage(event.replyToken,ownerDecisionMessage(decision,parsed.booking_id),env,fetchImpl):null
    });
  }
  // Canonical decision replay is not a receipt for customer LINE delivery.
  if(data.idempotent_replay===true){
    return {handled:true,status:'ALREADY_APPLIED',booking_id:parsed.booking_id,
      decision_status:expected.toUpperCase(),idempotent_replay:true,
      customer_notifications:0,owner_notifications:0,
      requires_manual_delivery_review:true};
  }
  const customerUserId=text(data.customer_contact);
  if(!LineIdentity.isUserId(customerUserId)){
    const err=new Error('Canonical LINE customer contact missing after owner decision');
    err.code='LINE_CUSTOMER_CONTACT_READBACK_REQUIRED';
    throw err;
  }
  // Customer delivery must finish before telling the owner the notification was sent.
  // This does not make the flow exactly-once: durable outbox/receipt is still required
  // to recover a committed decision after provider failure.
  await pushMessage(customerUserId,customerDecisionMessage(decision,parsed.booking_id),env,fetchImpl);
  if(event.replyToken){
    await replyMessage(event.replyToken,ownerDecisionMessage(decision,parsed.booking_id),env,fetchImpl);
  }
  return {handled:true,status:expected.toUpperCase(),booking_id:parsed.booking_id,idempotent_replay:Boolean(data.idempotent_replay)};
}

module.exports={
  VERSION,automationReadiness,ownerUserId,ownerTargetId,approvalSecret,
  appsScriptCall,createPendingBooking,decisionData,parseDecisionData,
  ownerApprovalMessage,notifyOwner,processOwnerPostback,
  customerDecisionMessage,ownerDecisionMessage,pushMessage,replyMessage
};
