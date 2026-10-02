(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./operations-engine.js'));
  else root.KKReservationGuard=factory(root.KKOperationsEngine);
})(typeof globalThis!=='undefined'?globalThis:this,function(Ops){
  'use strict';
  const VERSION='admin-p1-reservation-guard-2';
  const DEFAULT_END_HOUR=6;
  const text=v=>String(v==null?'':v).trim();
  const lower=v=>text(v).toLowerCase();

  function timeMinutes(v){
    if(v==null||v==='') return null;
    const s=text(v);
    let m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if(!m) m=s.match(/T(\d{2}):(\d{2})(?::\d{2})?/);
    if(!m) return null;
    const h=Number(m[1]),min=Number(m[2]);
    return h>=0&&h<=23&&min>=0&&min<=59?h*60+min:null;
  }

  function dayStartMs(day){ return Date.parse(day+'T00:00:00+07:00'); }

  function assetRentable(a){
    if(!a||lower(a.status)!=='available') return false;
    for(const key of ['rentable','rentable_now','rentable_setting']){
      if(a[key]===undefined||a[key]===null||text(a[key])==='') continue;
      return a[key]===true||['true','1','yes','y'].includes(lower(a[key]));
    }
    return true;
  }

  function reservationWindow(b,opts={}){
    const day=Ops.dateKey(b&&b.event_date);
    if(!day) return null;
    const startMin=timeMinutes(b&&b.pickup_time);
    const returnMin=timeMinutes(b&&b.return_time);
    const fallbackHour=Number.isFinite(Number(opts.defaultEndHour))?Math.max(0,Math.min(23,Number(opts.defaultEndHour))):DEFAULT_END_HOUR;
    const start=dayStartMs(day)+(startMin===null?0:startMin)*60000;
    let end,mode='explicit',openEnded=false;
    if(returnMin!==null){
      end=dayStartMs(day)+((startMin!==null&&returnMin<=startMin)?86400000:0)+returnMin*60000;
      if(end<=start) end=start+60000;
    }else if(lower(b&&b.booking_status)==='picked_up'){
      end=Date.parse('2099-12-31T23:59:00+07:00');
      mode='picked-up-open-ended'; openEnded=true;
    }else{
      end=dayStartMs(day)+86400000+fallbackHour*3600000;
      mode='fallback-next-day-'+String(fallbackHour).padStart(2,'0')+':00';
    }
    return {start_ms:start,end_ms:end,start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),source_day:day,mode,open_ended:openEnded};
  }

  function overlaps(a,b){ return !!(a&&b&&a.start_ms<b.end_ms&&b.start_ms<a.end_ms); }
  function sameBooking(a,b){
    const aid=text(a&&a.booking_id), bid=text(b&&b.booking_id);
    if(aid||bid) return !!aid&&!!bid&&aid===bid;
    const ar=Number(a&&a.row_number||0),br=Number(b&&b.row_number||0);
    return ar>0&&br>0&&ar===br;
  }

  function inventory(data){
    const all=(data&&data.assets||[]).filter(assetRentable);
    return {all,phones:all.filter(a=>lower(a.asset_type)==='phone'),lenses:all.filter(a=>lower(a.asset_type)==='lens')};
  }

  function preflight(data,b,opts={}){
    const errors=[],warnings=[];
    if(!b||!Ops.reserves(b)) return {ok:true,errors,warnings,window:reservationWindow(b,opts),overlapping_booking_ids:[],availability:null};
    const window=reservationWindow(b,opts);
    const type=lower(b.package_type);
    if(!window) errors.push({code:'MISSING_EVENT_DATE',message:'Booking ไม่มี event_date สำหรับ reservation window'});
    if(!['phone_only','lens_only','phone_lens_bundle'].includes(type)) errors.push({code:'UNKNOWN_PACKAGE_TYPE',message:'ไม่สามารถระบุ package_type สำหรับ collision preflight'});
    if(window&&window.mode!=='explicit') warnings.push({code:'RESERVATION_WINDOW_FALLBACK',message:'ไม่มี return_time จึงใช้ '+window.mode});
    if(errors.length) return {ok:false,errors,warnings,window,overlapping_booking_ids:[],availability:null};

    const active=(data&&data.bookings||[]).filter(x=>Ops.reserves(x)&&!sameBooking(x,b));
    const overlapping=active.filter(x=>overlaps(window,reservationWindow(x,opts)));
    const inv=inventory(data);
    let phoneDemand=Ops.needsPhone(type)?1:0,lensDemand=Ops.needsLens(type)?1:0;
    overlapping.forEach(x=>{ if(Ops.needsPhone(x.package_type))phoneDemand++; if(Ops.needsLens(x.package_type))lensDemand++; });
    if(phoneDemand>inv.phones.length) errors.push({code:'PHONE_CAPACITY_EXCEEDED',message:`Phone demand ${phoneDemand} เกิน capacity ${inv.phones.length} ใน reservation window`});
    if(lensDemand>inv.lenses.length) errors.push({code:'LENS_CAPACITY_EXCEEDED',message:`Lens demand ${lensDemand} เกิน capacity ${inv.lenses.length} ใน reservation window`});

    const byId=new Map((data&&data.assets||[]).map(a=>[text(a.asset_id),a]));
    for(const c of [{kind:'phone',needed:Ops.needsPhone(type),id:text(b.phone_asset_id)},{kind:'lens',needed:Ops.needsLens(type),id:text(b.lens_asset_id)}]){
      if(!c.needed) continue;
      if(!c.id){ warnings.push({code:c.kind.toUpperCase()+'_AUTO_ASSIGN',message:`${c.kind} ยังไม่ระบุ Asset; backend ต้อง auto-assign ภายใน capacity`}); continue; }
      const asset=byId.get(c.id);
      if(!asset){ errors.push({code:'UNKNOWN_ASSET',message:`ไม่พบ Asset ${c.id}`}); continue; }
      if(lower(asset.asset_type)!==c.kind) errors.push({code:'WRONG_ASSET_TYPE',message:`${c.id} ไม่ใช่ ${c.kind}`});
      if(!assetRentable(asset)) errors.push({code:'ASSET_NOT_RENTABLE',message:`${c.id} ไม่พร้อมปล่อยเช่า`});
      const conflicts=overlapping.filter(x=>text(x[c.kind+'_asset_id'])===c.id);
      if(conflicts.length) errors.push({code:'ASSET_WINDOW_COLLISION',message:`${c.id} ชนกับ ${conflicts.map(x=>text(x.booking_id)||('row '+text(x.row_number))).join(', ')}`});
    }

    return {ok:errors.length===0,errors,warnings,window,overlapping_booking_ids:overlapping.map(x=>text(x.booking_id)||('row '+text(x.row_number))),availability:{phone_total:inv.phones.length,phone_demand:phoneDemand,phone_free:Math.max(0,inv.phones.length-phoneDemand),lens_total:inv.lenses.length,lens_demand:lensDemand,lens_free:Math.max(0,inv.lenses.length-lensDemand)}};
  }

  return {VERSION,DEFAULT_END_HOUR,timeMinutes,assetRentable,reservationWindow,overlaps,preflight};
});