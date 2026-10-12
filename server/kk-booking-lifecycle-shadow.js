'use strict';
const VERSION='KK_BOOKING_LIFECYCLE_SHADOW_V1';
const ACTIVE=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
const RETURN_OK=new Set(['returned','received','verified','confirmed','complete','completed','ok','pass']);
// Upload alone is NOT delivery: customer must receive the Drive link before closure.
const TRANSFER_OK=new Set(['sent','delivered','confirmed']);
const norm=x=>String(x==null?'':x).trim().toLowerCase();
function amount(x){
 const s=String(x==null?'':x).replace(/,/g,'').trim();
 if(!s)return 0;
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function validDrive(link){
 const s=String(link||'').trim();
 if(!s || /[\s\\]/.test(s))return false;
 try{
  const u=new URL(s),host=u.hostname.toLowerCase(),path=u.pathname;
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
  const id='[A-Za-z0-9_-]{10,}';
  if(host==='drive.google.com'){
   return new RegExp('^/(?:file/d/|drive/(?:u/[0-9]+/)?folders/)'+id+'(?:/|$)').test(path) ||
     (path==='/open' && new RegExp('^'+id+'$').test(u.searchParams.get('id')||''));
  }
  if(host==='docs.google.com'){
   return new RegExp('^/(?:document|spreadsheets|presentation)/d/'+id+'(?:/|$)').test(path);
  }
  return false;
 }catch(_){return false;}
}
function evidence(row={}){
 const received=amount(row.amount_received),quote=amount(row.package_price);
 const paid=norm(row.payment_status)==='paid'&&received!==null&&quote!==null&&
  received>0&&quote>0&&received>=quote;
 const returned=RETURN_OK.has(norm(row.return_status));
 const uploaded=TRANSFER_OK.has(norm(row.file_transfer_status));
 const drive=validDrive(row.drive_link);
 return {receipt:paid,returned,uploaded,drive_link:drive,missing:[
  ...(paid?[]:['HANDOVER_RECEIPT_UNVERIFIED']),
  ...(returned?[]:['DEVICE_RETURN_UNVERIFIED']),
  ...(uploaded?[]:['DRIVE_UPLOAD_UNVERIFIED']),
  ...(drive?[]:['CUSTOMER_DRIVE_LINK_UNVERIFIED'])]};
}
function checkCompletionTransition(previous={},requested={}){
 const prior=norm(previous.booking_status),next=norm(requested.booking_status||prior);
 if(next!=='completed')return {ok:true,stage:'NOT_COMPLETING',shadow_only:true,production_writes:0};
 if(prior==='completed')return {ok:true,stage:'ALREADY_COMPLETED_NO_TRANSITION',shadow_only:true,production_writes:0};
 const errors=[...(prior==='uploaded'?[]:['COMPLETION_REQUIRES_UPLOADED_STATE']),...evidence(previous).missing];
 return {ok:errors.length===0,stage:errors.length?'HOLD_CLOSURE_EVIDENCE':'READY_FOR_GOVERNED_WRITER',
  errors,shadow_only:true,production_writes:0};
}
function audit(rows){
 if(!Array.isArray(rows))throw Error('BOOKING_ROWS_REQUIRED');
 const status_mix={},counts={completed:0,active:0,excluded:0,blank:0},
  issues={historical_completed_missing_evidence:0,confirmed_unpaid_with_amount_field:0,
   cancelled_paid_refund_review:0,active_paid_before_handover:0,invalid_amount_field:0,missing_booking_id:0,
   active_missing_package_price:0},
  totals={actual_completed_by_status:0,future_active_quote:0,forecast_by_status:0,verified_completed_receipt:0};
 for(const r of rows){
  if(!r||typeof r!=='object')continue;
  const st=norm(r.booking_status);
  if(!String(r.booking_id||'').trim()){if(st)issues.missing_booking_id++;continue;}
  status_mix[st]=(status_mix[st]||0)+1;
  const parsed=amount(r.amount_received);
  if(parsed===null)issues.invalid_amount_field++;
  const n=parsed||0;
  if(st==='completed'){
   counts.completed++;totals.actual_completed_by_status+=n;
   if(evidence(r).missing.length)issues.historical_completed_missing_evidence++;
   else totals.verified_completed_receipt+=n;
  }else if(ACTIVE.has(st)){
   counts.active++;
   // Future is the AGREED booking package quote (Master column X), never
   // the cash-receipt field O: KK collects zero deposit before handover.
   const quoted=amount(r.package_price);
   if(quoted===null || quoted<=0)issues.active_missing_package_price++;
   else totals.future_active_quote+=quoted;
   if(st==='confirmed'&&norm(r.payment_status)==='unpaid'&&n>0)issues.confirmed_unpaid_with_amount_field++;
   if(norm(r.payment_status)==='paid'&&['pending','confirmed','prepared'].includes(st))issues.active_paid_before_handover++;
  }else if(!st){counts.blank++;}
  else{counts.excluded++;if(st==='cancelled'&&norm(r.payment_status)==='paid')issues.cancelled_paid_refund_review++;}
 }
 totals.forecast_by_status=totals.actual_completed_by_status+totals.future_active_quote;
 return {version:VERSION,status:Object.values(issues).some(x=>x>0)?
  'READ_ONLY_HISTORICAL_EVIDENCE_GAPS':'READ_ONLY_AUDIT',
  status_mix,counts,issues,totals,
  policy:{no_deposit:true,cash_at_handover:true,actual:'completed only',future:'active only',
   excluded:['cancelled','no_show','blank','unknown'],amount_field_not_cash_proof:true,future_source:'canonical package_price (Master column X), not amount_received'},
  safety:{read_only:true,production_writes:0,booking_writes:0,
   historical_reclassification_authorized:false,server_completion_guard_wired:false}};
}
module.exports={VERSION,amount,validDrive,evidence,checkCompletionTransition,audit};
