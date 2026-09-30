'use strict';

const DirectWriter=require('./admin-direct-writer.js');
const Phase1=require('./admin-direct-writer-phase1.js');

const VERSION='line-booking-direct-writer-phase2-v1';
const BOOKING_SHEET='00_Master_Booking';
const AUDIT_SHEET='15_Admin_Audit_Log';
const START_ROW=5;

function text(v){return String(v===undefined||v===null?'':v).trim();}
function enabled(env=process.env){return ['1','true','yes','on'].includes(text(env.KK_LINE_BOOKING_DIRECT_WRITER_PHASE2_ENABLED).toLowerCase());}
function validRequestId(v){return /^line:[a-f0-9]{48}$/.test(text(v));}

function assertIntent(payload){
  if(!enabled(payload&&payload.__env||process.env)) throw Object.assign(new Error('LINE booking Phase 2 writer is disabled'),{code:'LINE_BOOKING_PHASE2_DISABLED'});
  if(!payload||payload.action!=='createBooking') throw Object.assign(new Error('createBooking required'),{code:'LINE_BOOKING_ACTION_REQUIRED'});
  if(!validRequestId(payload.request_id)) throw Object.assign(new Error('deterministic LINE request_id required'),{code:'LINE_BOOKING_REQUEST_ID_REQUIRED'});
  if(text(payload.booking_status)!=='pending'||text(payload.payment_status)!=='unpaid'||text(payload.contact_channel)!=='LINE'){
    throw Object.assign(new Error('LINE intake must be pending/unpaid/LINE'),{code:'LINE_BOOKING_STATE_INVALID'});
  }
  if(!text(payload.event_id)||!text(payload.template_id)||!text(payload.customer_name)||!text(payload.customer_phone)){
    throw Object.assign(new Error('canonical event/package and customer identity required'),{code:'LINE_BOOKING_FIELDS_REQUIRED'});
  }
  if(text(payload.phone_asset_id)||text(payload.lens_asset_id)){
    throw Object.assign(new Error('pending LINE intake must not assign assets'),{code:'LINE_BOOKING_PENDING_ASSET_FORBIDDEN'});
  }
  return true;
}

function firstWritableRow(rows){
  const list=Array.isArray(rows)?rows:[];
  for(let i=0;i<list.length;i++){
    const r=list[i]||[];
    const a=text(r[0]), eventId=text(r[3]);
    const bToT=r.slice(1,20).some(v=>text(v)!=='');
    if(!eventId&&!bToT) return START_ROW+i;
    // Formula-only A rows are writable; generated booking_id is preserved.
    if(a&&!eventId&&!bToT) return START_ROW+i;
  }
  return START_ROW+list.length;
}

function bookingValues(payload,now=new Date()){
  return [
    now.toISOString(), 'pending', text(payload.event_id), text(payload.customer_name),
    text(payload.customer_contact), text(payload.customer_phone), 'LINE',
    text(payload.package_type), '', '', text(payload.pickup_time), '',
    'unpaid', 0, '', '', '', 0, text(payload.booking_note)
  ];
}

function buildPlan(payload,data,now=new Date()){
  assertIntent(payload);
  const row=firstWritableRow(data&&data.bookings);
  const values=bookingValues(payload,now);
  return {
    action:'createBooking',request_id:text(payload.request_id),row_number:row,
    mutations:[{sheet:BOOKING_SHEET,row,column:2,values}],
    // A:T readback is required because A is the canonical generated booking_id.
    canonical_readback:{range:`${BOOKING_SHEET}!A${row}:T${row}`},
    audit:{sheet:AUDIT_SHEET}
  };
}

function canonicalBooking(row,rowNumber){
  const r=Array.isArray(row)?row:[];
  const booking_id=text(r[0]);
  if(!booking_id) throw Object.assign(new Error('canonical booking_id readback required'),{code:'LINE_BOOKING_ID_READBACK_REQUIRED'});
  if(text(r[2])!=='pending') throw Object.assign(new Error('booking status readback mismatch'),{code:'LINE_BOOKING_READBACK_MISMATCH'});
  if(text(r[9])||text(r[10])) throw Object.assign(new Error('pending booking unexpectedly has assets'),{code:'LINE_BOOKING_PENDING_ASSET_READBACK'});
  return {booking_id,row_number:Number(rowNumber),booking_status:'pending'};
}

function requestBatch(plan,sheetMap,now=new Date()){
  const bookingId=Number(sheetMap[BOOKING_SHEET]),auditId=Number(sheetMap[AUDIT_SHEET]);
  if(!Number.isInteger(bookingId)||!Number.isInteger(auditId)) throw Object.assign(new Error('sheet metadata missing'),{code:'LINE_BOOKING_SHEET_METADATA_MISSING'});
  const write=Phase1.updateCellsRequest(bookingId,plan.row_number,2,plan.mutations[0].values);
  const audit=Phase1.appendAuditRequest(auditId,Phase1.auditRow('createBooking',{row_number:plan.row_number},plan.request_id,now));
  return [write,audit];
}

async function tryExecute(payload,options={}){
  const env=options.env||process.env;
  payload=Object.assign({},payload,{__env:env});
  assertIntent(payload);
  DirectWriter.requireActivated(env);
  const token=await (options.tokenProvider||DirectWriter.getAccessToken)({env,fetchImpl:options.fetchImpl||global.fetch});
  const findAudit=options.findAuditRequest||Phase1.findAuditRequest;
  const prior=await findAudit(payload.request_id,{token,fetchImpl:options.fetchImpl||global.fetch,env});
  if(prior&&prior.status==='OK'&&prior.action==='createBooking'&&prior.result&&prior.result.booking_id){
    return {handled:true,status:200,idempotent_replay:true,body:{ok:true,data:Object.assign({},prior.result,{idempotent_replay:true}),no_legacy_fallback:true}};
  }
  const load=options.loadBookings;
  if(typeof load!=='function') throw Object.assign(new Error('booking model loader required'),{code:'LINE_BOOKING_MODEL_LOADER_REQUIRED'});
  const data=await load({token,env,fetchImpl:options.fetchImpl||global.fetch});
  const plan=buildPlan(payload,data,options.now||new Date());
  const map=await (options.sheetMap||Phase1.sheetMap)({token,env,fetchImpl:options.fetchImpl||global.fetch});
  const requests=requestBatch(plan,map,options.now||new Date());
  let mutationCommitted=false;
  try{
    await (options.executeBatch||Phase1.executeBatch)(requests,{token,env,fetchImpl:options.fetchImpl||global.fetch});
    mutationCommitted=true;
    const rows=await options.readCanonical(plan.canonical_readback.range,{token,env,fetchImpl:options.fetchImpl||global.fetch});
    const result=canonicalBooking(rows&&rows[0],plan.row_number);
    await (options.verifyAudit||Phase1.verifyAudit)(payload.request_id,{token,env,fetchImpl:options.fetchImpl||global.fetch});
    return {handled:true,status:200,body:{ok:true,data:Object.assign({},result,{request_id:payload.request_id}),no_legacy_fallback:true}};
  }catch(err){
    if(mutationCommitted) err.mutation_committed=true;
    err.no_legacy_fallback=true;
    throw err;
  }
}

module.exports={VERSION,BOOKING_SHEET,AUDIT_SHEET,enabled,validRequestId,assertIntent,firstWritableRow,bookingValues,buildPlan,canonicalBooking,requestBatch,tryExecute};
