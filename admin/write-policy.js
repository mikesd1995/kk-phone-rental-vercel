(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.KKAdminWritePolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const TRANSIENT_CODES=new Set(['WRITE_HEALTH_TIMEOUT','WRITE_HEALTH_ERROR']);
  const TRANSIENT_ATTEMPT_ACTIONS=new Set([
    'createBooking','updateBooking','createEvent','updateEvent','createPackage','updatePackage',
    'upsertEventOverride','bulkSetEventPackageVisibility','addAssets','updateAsset','deleteAsset','uploadPoster'
  ]);

  function text(v){return String(v===undefined||v===null?'':v).trim();}
  function lower(v){return text(v).toLowerCase();}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}

  function writeHealthCode(snapshot){
    const h=snapshot&&snapshot.write_path_health||{};
    return text(h.error_code||h.probe_error_code);
  }

  function transientWriteHealth(snapshot){
    const h=snapshot&&snapshot.write_path_health||{};
    if(h.skipped===true||h.checked===false) return false;
    return snapshot&&snapshot.legacy_write_attempt_allowed===true || TRANSIENT_CODES.has(writeHealthCode(snapshot));
  }

  function admission(snapshot,directAvailable,action){
    if(directAvailable) return {allowed:true,mode:'direct'};
    if(!snapshot) return {allowed:false,mode:'blocked-no-snapshot'};
    if(snapshot.degraded_read_only!==true) return {allowed:true,mode:'verified'};
    const a=text(action);
    const transientAllowed=a==='__status__'||TRANSIENT_ATTEMPT_ACTIONS.has(a);
    if(transientAllowed&&transientWriteHealth(snapshot)) return {allowed:true,mode:'transient-attempt'};
    return {allowed:false,mode:'blocked'};
  }

  function same(a,b){return text(a)===text(b);}
  function sameLower(a,b){return lower(a)===lower(b);}
  function sameNum(a,b){return num(a)===num(b);}

  function bookingByRow(snapshot,row){
    const wanted=text(row);
    return ((snapshot&&snapshot.bookings)||[]).find(b=>text(b&&b.row_number)===wanted)||null;
  }
  function bookingById(snapshot,id){
    const wanted=text(id);
    return ((snapshot&&snapshot.bookings)||[]).find(b=>text(b&&b.booking_id)===wanted)||null;
  }

  function packageTypeForTemplate(snapshot,templateId){
    const wanted=text(templateId);
    const p=((snapshot&&snapshot.packages)||[]).find(x=>text(x&&x.template_id)===wanted);
    return p?text(p.package_type):'';
  }

  function verifyBookingFields(row,payload,packageType){
    if(!row) return false;
    const checks=[];
    if(payload.event_id!==undefined&&payload.event_id!=='') checks.push(same(row.event_id,payload.event_id));
    if(payload.booking_status!==undefined&&payload.booking_status!=='') checks.push(sameLower(row.booking_status,payload.booking_status));
    if(payload.customer_name!==undefined&&payload.customer_name!=='') checks.push(same(row.customer_name,payload.customer_name));
    if(payload.customer_contact!==undefined) checks.push(same(row.customer_contact,payload.customer_contact));
    if(payload.customer_phone!==undefined) checks.push(same(row.customer_phone,payload.customer_phone));
    if(payload.contact_channel!==undefined&&payload.contact_channel!=='') checks.push(sameLower(row.contact_channel,payload.contact_channel));
    if(payload.payment_status!==undefined&&payload.payment_status!=='') checks.push(sameLower(row.payment_status,payload.payment_status));
    if(payload.amount_received!==undefined&&payload.amount_received!=='') checks.push(sameNum(row.amount_received,payload.amount_received));
    if(payload.pickup_time!==undefined) checks.push(same(row.pickup_time,payload.pickup_time));
    if(payload.phone_asset_id!==undefined) checks.push(same(row.phone_asset_id,payload.phone_asset_id));
    if(payload.lens_asset_id!==undefined) checks.push(same(row.lens_asset_id,payload.lens_asset_id));
    if(payload.booking_note!==undefined) checks.push(same(row.note,payload.booking_note));
    if(packageType) checks.push(sameLower(row.package_type,packageType));
    return checks.length>0&&checks.every(Boolean);
  }

  function verifyBookingMutation(action,payload,response,before,after){
    const p=payload||{},r=response||{};
    const rowNumbersReliable=!!(after&&after.booking_row_number_reliable===true);
    if(action==='updateBooking'){
      const stableId=text(p.booking_id||r.booking_id);
      const row=stableId
        ? bookingById(after,stableId)
        : (rowNumbersReliable?bookingByRow(after,p.row_number):null);
      if(!row) return {status:'not-committed',reason:stableId?'booking-id-missing':'booking-identity-missing'};
      return verifyBookingFields(row,p,'')
        ? {status:'committed',reason:stableId?'booking-id-exact-readback':'booking-row-exact-readback',row_number:row.row_number,booking_id:row.booking_id||''}
        : {status:'not-committed',reason:'booking-readback-mismatch',row_number:row.row_number,booking_id:row.booking_id||''};
    }
    if(action==='createBooking'){
      const packageType=packageTypeForTemplate(before,p.template_id);
      const stableId=text(r.booking_id);
      if(stableId){
        const row=bookingById(after,stableId);
        return row&&verifyBookingFields(row,p,packageType)
          ? {status:'committed',reason:'created-id-exact-readback',row_number:row.row_number,booking_id:row.booking_id||''}
          : {status:'not-committed',reason:'created-id-missing-or-mismatch'};
      }
      // GViz can collapse physical blank rows, so a newly inserted booking may
      // renumber several logical rows. Compare stable IDs, not row positions.
      const beforeIds=new Set(((before&&before.bookings)||[]).map(b=>text(b&&b.booking_id)).filter(Boolean));
      let candidates=((after&&after.bookings)||[]).filter(b=>{
        const id=text(b&&b.booking_id);
        return id&&!beforeIds.has(id)&&verifyBookingFields(b,p,packageType);
      });
      // Legacy snapshots without booking IDs may use a physical row only when
      // the source explicitly guarantees row-number reliability.
      if(!candidates.length&&rowNumbersReliable&&r.row_number){
        const row=bookingByRow(after,r.row_number);
        if(row&&verifyBookingFields(row,p,packageType)) candidates=[row];
      }
      if(candidates.length===1) return {status:'committed',reason:'single-new-booking-id-match',row_number:candidates[0].row_number,booking_id:candidates[0].booking_id||''};
      if(candidates.length>1) return {status:'ambiguous',reason:'multiple-new-booking-matches',matches:candidates.length};
      return {status:'not-committed',reason:'no-new-booking-match'};
    }
    return {status:'unsupported',reason:'action-not-supported'};
  }

  return {TRANSIENT_CODES,TRANSIENT_ATTEMPT_ACTIONS,writeHealthCode,transientWriteHealth,admission,verifyBookingMutation};
});
