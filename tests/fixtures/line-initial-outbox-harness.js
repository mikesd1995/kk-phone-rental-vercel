'use strict';
// Local VM only: canonical candidate code, synthetic Sheets/properties, no I/O.

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../../apps-script/Code.gs'),'utf8');
const VERSION='KK_LINE_INITIAL_OUTBOX_V1';
const OWNER='U'+'a'.repeat(32),CUSTOMER='U'+'c'.repeat(32);
const SECRET='synthetic_initial_dispatch_secret_20261114';
const BID='BK-SYNTHETIC-INITIAL-1',RID='line:'+'d'.repeat(48);
const KIND='OWNER_APPROVAL_PUSH',REPLY='CUSTOMER_PENDING_REPLY';
const HEADERS=['outbox_id','booking_id','kind','state','claim_key','provider_message_id','provider_request_id','recipient','request_id','context_json','context_hash','message_hash','updated_at','created_at'];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const context={version:VERSION,event_name:'Synthetic Event',event_date:'18/11/2026',venue:'Synthetic Hall',poster_image_url:'',package_name:'Phone',price_display:'790 บาท',nickname:'Synthetic Customer',phone:'',pickup_time:'16:00',terms_status:'NOT_CONFIRMED',terms_version:''};
const RAW=JSON.stringify(context),HASH=sha(RAW);
const payload=()=>({request_id:RID,event_id:'EVT-SYNTHETIC',template_id:'TPL-PHONE',customer_name:context.nickname,customer_contact:CUSTOMER,customer_phone:'',pickup_time:'16:00',booking_note:'Synthetic request',initial_dispatch_key:SECRET,initial_notification:{mode:VERSION,owner_target:OWNER,context_json:RAW,context_hash:HASH}});
const claim=(kind=KIND,overrides={})=>({booking_id:BID,request_id:RID,kind,outbox_id:'LINE_INITIAL_V1_'+sha(kind+':'+BID).slice(0,48),context_hash:HASH,message_hash:'e'.repeat(64),claim_key:'23ce4567-e89b-42d3-a456-426614174002',initial_dispatch_key:SECRET,...overrides});
function harness(options={}){
 let lock=false,flushes=0,crash=0,allocations=0,writes=0;
 const stored={KK_LINE_INITIAL_OUTBOX_V1_ENABLED:options.enabled===false?'false':'true',KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:SECRET,KK_LINE_INITIAL_OUTBOX_OWNER_TARGET:OWNER,KK_ADMIN_API_KEY:'distinct-admin-key',KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'distinct_owner_dispatch_secret_20261114',...options.properties};
 function sheet(rows){return {rows,getLastRow(){return this.rows.length;},getRange(row,col,h,w){return {getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>rows[row-1+i]?.[col-1+j]??'')),setValues:values=>{assert.equal(lock,true,'all canonical mutations require existing DocumentLock');writes++;for(let i=0;i<h;i++){if(!rows[row+i-1])rows[row+i-1]=[];for(let j=0;j<w;j++)rows[row+i-1][col+j-1]=values[i][j];}}};}};}
 const bookings=sheet(Array.from({length:4},()=>Array(20).fill(''))),ledger=sheet([options.header||HEADERS]);
 const ctx={Date,JSON,Number,String,Object,Array,RegExp,Error,
  KK:{bookings:'00_Master_Booking'},KK_ADMIN_VERSION:'synthetic',
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>stored[k]||'',setProperty:(k,v)=>{assert.equal(lock,true);stored[k]=v;}})},
  Utilities:{DigestAlgorithm:{SHA_256:'SHA256'},Charset:{UTF_8:'UTF8'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest())},
  kkCanonicalWorkbook_:()=>({getId:()=> 'synthetic-private-core-id'}),
  SpreadsheetApp:{flush(){flushes++;if(crash===flushes)throw Error('SYNTHETIC_CRASH');}},
  kkAcquireDocumentLock_(){assert.equal(lock,false,'lock must not nest');lock=true;return {releaseLock(){lock=false;}};},
  kkSheet_:name=>{if(name==='00_Master_Booking')return bookings;if(name==='20_Line_Initial_Outbox'&&!options.noLedger)return ledger;throw Error('SYNTHETIC_MISSING_SHEET');},
  kkFindBookingRow_:(_,id)=>{const i=bookings.rows.findIndex(r=>r[0]===id);if(i<4)throw Error('SYNTHETIC_BOOKING_MISSING');return i+1;},
  kkBookingRequestIdFromNote_:v=>(String(v).match(/\[KK_REQ:([A-Za-z0-9._:-]{8,128})\]/)||[])[1]||'',
  kkBookingNoteWithRequest_:(n,r)=>n+' [KK_REQ:'+r+']',
  kkNormalizeTemplateIdForEvent_:(_,t)=>t,
  kkGetEventById_:()=>({event_date:'2026-11-18',status:'open',active:true}),
  kkGetPackageByTemplateId_:()=>({package_type:'phone_only',model_group:'SYNTHETIC_PHONE',lens_group:'NONE',active:true}),
  kkIsPastEventDate_:()=>false,kkAssertWebPackageBookable_(){return {package_type:'phone_only',model_group:'SYNTHETIC_PHONE',lens_group:'NONE',price:790,available_count:1,...options.webPackage};},
  kkFirstEmptyRow_(){allocations++;return 5;},kkGenerateUniqueBookingId_:()=>BID
 };
 vm.createContext(ctx);
 // Real source helpers (not a second implementation of identity/quote logic).
 for(const name of ['kkBookingTemplateIdFromNote_','kkBookingQuotedPriceFromNote_','kkBookingNoteWithTemplate_','kkBookingNoteForUpdate_','kkBookingBindingMatches_','kkLineVerifiedQuote_']){
  const a=source.indexOf('function '+name+'('), b=source.indexOf('\nfunction ',a+1);
  assert.ok(a>=0&&b>a);
  vm.runInContext(source.slice(a,b),ctx,{filename:name+'.gs'});
 }
 const start=source.indexOf('function kkLineBookingRequestKey_');
 const end=source.indexOf('const KK_LINE_OWNER_OUTBOX_VERSION_',start);
 vm.runInContext(source.slice(start,end),ctx,{filename:'InitialOutboxCandidate.gs'});
 return {ctx,stored,bookings,ledger,create:p=>ctx.kkApiCreateLineBookingPending_(p||payload()),claim:p=>ctx.kkApiClaimLineBookingInitialDelivery_(p||claim()),settle:p=>ctx.kkApiSettleLineBookingInitialDelivery_(p),ready:p=>ctx.kkApiLineInitialOutboxReadiness_(p||{initial_dispatch_key:SECRET}),crashAt:n=>{crash=n;},stats:()=>({flushes,allocations,writes}),seedLegacy(){const p=payload();const row=Array(20).fill('');Object.assign(row,{0:BID,2:'pending',3:p.event_id,4:p.customer_name,5:CUSTOMER,7:'LINE',11:'16:00',13:'unpaid',14:0,19:'[KK_REQ:'+RID+']'});bookings.rows.push(row);stored[ctx.kkLineBookingRequestKey_(RID)]=JSON.stringify({status:'OK',request_id:RID,booking_id:BID,row_number:5,event_id:p.event_id,template_id:p.template_id});}};
}

module.exports={harness,payload,claim,source,sha,VERSION,OWNER,CUSTOMER,SECRET,BID,RID,KIND,REPLY,HEADERS,context,RAW,HASH};
