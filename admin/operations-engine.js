(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.KKOperationsEngine=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='admin-p1-operations-1';
  const RESERVING_STATUSES=new Set(['pending','confirmed','prepared','picked_up']);
  const CLOSED_STATUSES=new Set(['cancelled','completed','no_show']);

  const text=v=>String(v==null?'':v).trim();
  const lower=v=>text(v).toLowerCase();
  const truthy=v=>v===true||['true','1','yes','y'].includes(lower(v));

  function dateKey(v){
    if(v==null||v==='') return '';
    if(v instanceof Date&&!Number.isNaN(v.getTime())){
      return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
    }
    if(typeof v==='number'&&Number.isFinite(v)){
      const ms=Math.round((v-25569)*86400000);
      const d=new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    }
    const s=text(v);
    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
    m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(m){ let y=Number(m[3]); if(y>2500)y-=543; return `${y}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`; }
    if(/^\d+(?:\.\d+)?$/.test(s)) return dateKey(Number(s));
    const d=new Date(s);
    return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function needsPhone(type){ return ['phone_only','phone_lens_bundle'].includes(lower(type)); }
  function needsLens(type){ return ['lens_only','phone_lens_bundle'].includes(lower(type)); }
  function reserves(b){ return RESERVING_STATUSES.has(lower(b&&b.booking_status)); }

  function rentableAssets(assets){
    return (assets||[]).filter(a=>{
      const status=lower(a&&a.status);
      const rentable=(a&&a.rentable_now!==undefined&&a.rentable_now!==null&&text(a.rentable_now)!=='')?truthy(a.rentable_now):status==='available';
      return status==='available'&&rentable;
    });
  }

  function inventory(assets){
    const rows=rentableAssets(assets);
    return {
      phones:rows.filter(a=>lower(a.asset_type)==='phone'),
      lenses:rows.filter(a=>lower(a.asset_type)==='lens'),
      all:rows
    };
  }

  function activeBookingsForDate(bookings,day){
    return (bookings||[]).filter(b=>reserves(b)&&dateKey(b.event_date)===day);
  }

  function availabilityForDate(data,day){
    const inv=inventory(data&&data.assets);
    const bookings=activeBookingsForDate(data&&data.bookings,day);
    let phoneDemand=0,lensDemand=0,phoneAssigned=0,lensAssigned=0;
    for(const b of bookings){
      if(needsPhone(b.package_type)){ phoneDemand++; if(text(b.phone_asset_id))phoneAssigned++; }
      if(needsLens(b.package_type)){ lensDemand++; if(text(b.lens_asset_id))lensAssigned++; }
    }
    const phoneFree=Math.max(0,inv.phones.length-phoneDemand);
    const lensFree=Math.max(0,inv.lenses.length-lensDemand);
    return {
      date:day,
      booking_count:bookings.length,
      phone_total:inv.phones.length,
      phone_demand:phoneDemand,
      phone_free:phoneFree,
      lens_total:inv.lenses.length,
      lens_demand:lensDemand,
      lens_free:lensFree,
      bundle_free:Math.min(phoneFree,lensFree),
      phone_unassigned:Math.max(0,phoneDemand-phoneAssigned),
      lens_unassigned:Math.max(0,lensDemand-lensAssigned),
      overbooked:phoneDemand>inv.phones.length||lensDemand>inv.lenses.length
    };
  }

  function calendar(data,opts={}){
    const events=new Map((data&&data.events||[]).map(e=>[text(e.event_id),e]));
    const from=opts.from||'';
    const to=opts.to||'';
    const rows=[];
    for(const b of (data&&data.bookings||[])){
      const day=dateKey(b.event_date);
      if(!day||CLOSED_STATUSES.has(lower(b.booking_status))) continue;
      if(from&&day<from) continue;
      if(to&&day>to) continue;
      const event=events.get(text(b.event_id))||{};
      rows.push({
        date:day,
        booking_id:text(b.booking_id),
        status:lower(b.booking_status),
        event_id:text(b.event_id),
        event_name:text(b.event_name)||text(event.event_name)||text(b.event_id),
        customer_name:text(b.customer_name),
        package_type:lower(b.package_type),
        pickup_time:text(b.pickup_time),
        return_time:text(b.return_time),
        phone_asset_id:text(b.phone_asset_id),
        lens_asset_id:text(b.lens_asset_id),
        payment_status:lower(b.payment_status)
      });
    }
    rows.sort((a,b)=>a.date.localeCompare(b.date)||a.pickup_time.localeCompare(b.pickup_time)||a.booking_id.localeCompare(b.booking_id));
    return rows;
  }

  function collisions(data){
    const inv=inventory(data&&data.assets);
    const assetById=new Map((data&&data.assets||[]).map(a=>[text(a.asset_id),a]));
    const grouped=new Map();
    const issues=[];
    for(const b of (data&&data.bookings||[])){
      if(!reserves(b)) continue;
      const day=dateKey(b.event_date);
      if(!day) continue;
      const bid=text(b.booking_id)||'(no booking id)';
      const checks=[
        {kind:'phone',needed:needsPhone(b.package_type),id:text(b.phone_asset_id)},
        {kind:'lens',needed:needsLens(b.package_type),id:text(b.lens_asset_id)}
      ];
      for(const c of checks){
        if(!c.needed) continue;
        if(!c.id){
          issues.push({severity:'warning',code:`${c.kind.toUpperCase()}_UNASSIGNED`,date:day,asset_id:'',booking_ids:[bid],message:`${bid} ต้องใช้ ${c.kind} แต่ยังไม่ได้ assign asset`});
          continue;
        }
        const asset=assetById.get(c.id);
        if(!asset){
          issues.push({severity:'error',code:'UNKNOWN_ASSET',date:day,asset_id:c.id,booking_ids:[bid],message:`${bid} อ้างถึง asset ${c.id} ที่ไม่มีใน Asset Register`});
        }else{
          if(lower(asset.asset_type)!==c.kind) issues.push({severity:'error',code:'WRONG_ASSET_TYPE',date:day,asset_id:c.id,booking_ids:[bid],message:`${bid} ใช้ ${c.id} แต่ประเภทไม่ใช่ ${c.kind}`});
          const rentable=inv.all.some(a=>text(a.asset_id)===c.id);
          if(!rentable) issues.push({severity:'error',code:'ASSET_NOT_RENTABLE',date:day,asset_id:c.id,booking_ids:[bid],message:`${bid} ใช้ ${c.id} ที่ไม่อยู่ใน rentable inventory`});
        }
        const key=`${day}|${c.id}`;
        if(!grouped.has(key)) grouped.set(key,[]);
        grouped.get(key).push(bid);
      }
    }
    for(const [key,bids] of grouped){
      if(bids.length<2) continue;
      const [day,assetId]=key.split('|');
      issues.push({severity:'error',code:'ASSET_DOUBLE_BOOKED',date:day,asset_id:assetId,booking_ids:bids,message:`${assetId} ถูก assign ซ้ำ ${bids.length} booking ในวันเดียวกัน`});
    }
    const days=[...new Set((data&&data.bookings||[]).filter(reserves).map(b=>dateKey(b.event_date)).filter(Boolean))];
    for(const day of days){
      const a=availabilityForDate(data,day);
      if(a.phone_demand>a.phone_total) issues.push({severity:'error',code:'PHONE_CAPACITY_EXCEEDED',date:day,asset_id:'',booking_ids:[],message:`Phone demand ${a.phone_demand} เกิน capacity ${a.phone_total}`});
      if(a.lens_demand>a.lens_total) issues.push({severity:'error',code:'LENS_CAPACITY_EXCEEDED',date:day,asset_id:'',booking_ids:[],message:`Lens demand ${a.lens_demand} เกิน capacity ${a.lens_total}`});
    }
    issues.sort((a,b)=>a.date.localeCompare(b.date)||a.severity.localeCompare(b.severity)||a.code.localeCompare(b.code));
    return issues;
  }

  function availabilityMatrix(data,opts={}){
    const dates=new Set();
    for(const b of (data&&data.bookings||[])){
      const d=dateKey(b.event_date); if(d)dates.add(d);
    }
    for(const e of (data&&data.events||[])){
      const d=dateKey(e.event_date); if(d)dates.add(d);
    }
    const from=opts.from||''; const to=opts.to||'';
    return [...dates].filter(d=>(!from||d>=from)&&(!to||d<=to)).sort().map(d=>availabilityForDate(data,d));
  }

  return {VERSION,RESERVING_STATUSES,dateKey,needsPhone,needsLens,reserves,rentableAssets,inventory,activeBookingsForDate,availabilityForDate,availabilityMatrix,calendar,collisions};
});