(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.KKMasterBookingOverlay=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='master-booking-overlay-1';
  const text=v=>String(v==null?'':v).trim();

  function parseCsv(raw){
    const s=String(raw||'').replace(/^\uFEFF/,'');
    const rows=[]; let row=[],cell='',quoted=false;
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(quoted){
        if(ch==='"'&&s[i+1]==='"'){ cell+='"'; i++; }
        else if(ch==='"') quoted=false;
        else cell+=ch;
      }else if(ch==='"') quoted=true;
      else if(ch===','){ row.push(cell); cell=''; }
      else if(ch==='\n'){ row.push(cell.replace(/\r$/,'')); rows.push(row); row=[]; cell=''; }
      else cell+=ch;
    }
    if(cell!==''||row.length){ row.push(cell.replace(/\r$/,'')); rows.push(row); }
    return rows;
  }

  function rowsFromCsv(raw){
    const matrix=parseCsv(raw);
    if(!matrix.length) throw new Error('Master Booking overlay returned empty CSV');
    const headers=matrix[0].map(h=>text(h).toLowerCase());
    const bid=headers.indexOf('booking_id');
    const ret=headers.indexOf('return_time');
    if(bid<0||ret<0) throw new Error('Master Booking overlay header must include booking_id and return_time');
    const seen=new Set();
    const rows=[];
    for(const r of matrix.slice(1)){
      const bookingId=text(r[bid]);
      if(!bookingId) continue;
      if(seen.has(bookingId)) throw new Error('Duplicate booking_id in Master Booking overlay: '+bookingId);
      seen.add(bookingId);
      rows.push({booking_id:bookingId,return_time:text(r[ret])});
    }
    return rows;
  }

  function apply(snapshot,rows){
    const byId=new Map((rows||[]).map(r=>[text(r.booking_id),r]));
    const missing=[]; let matched=0,explicit=0;
    const mergeList=list=>(list||[]).map(b=>{
      const id=text(b&&b.booking_id);
      const source=id&&byId.get(id);
      if(!source){ if(id)missing.push(id); return Object.assign({},b); }
      matched++;
      const returnTime=text(source.return_time);
      if(returnTime) explicit++;
      return Object.assign({},b,{return_time:returnTime,return_time_source:'00_Master_Booking!M'});
    });
    const bookings=mergeList(snapshot&&snapshot.bookings);
    const currentBookings=(snapshot&&snapshot.current_bookings||[]).map(b=>{
      const id=text(b&&b.booking_id),source=id&&byId.get(id);
      return source?Object.assign({},b,{return_time:text(source.return_time),return_time_source:'00_Master_Booking!M'}):Object.assign({},b);
    });
    return {
      snapshot:Object.assign({},snapshot,{bookings,current_bookings:currentBookings}),
      stats:{overlay_version:VERSION,rows:(rows||[]).length,matched_bookings:matched,explicit_return_times:explicit,missing_booking_ids:[...new Set(missing)]}
    };
  }

  return {VERSION,parseCsv,rowsFromCsv,apply};
});
