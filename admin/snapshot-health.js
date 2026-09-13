(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.KKSnapshotHealth = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const VERSION = 'admin-snapshot-resilience-1';
  const BACKEND = 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX';
  const KEYS = ['events','bookings','current_bookings','assets'];
  const status = value => String(value || '').trim().toLowerCase();
  const workflowOpen = b => ['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(status(b.booking_status));
  function assess(data, previous){
    const counts = {}, issues = [], warnings = [];
    for(const key of KEYS){
      const rows = data && data[key];
      counts[key] = Array.isArray(rows) ? rows.length : null;
      if(!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object' || Array.isArray(r))) issues.push(key + ': missing or invalid array');
      if(key !== 'current_bookings' && counts[key] === 0 && previous && Array.isArray(previous[key]) && previous[key].length) issues.push(key + ': unexpectedly fell to zero');
    }
    if(!issues.length){
      if(data.events.length === 0 && (data.bookings.length || (Array.isArray(data.web_ready) && data.web_ready.length))) issues.push('events: zero despite booking/public-feed evidence');
      const active = data.bookings.filter(workflowOpen);
      const ids = new Set(data.current_bookings.map(b=>String(b.booking_id)));
      if(active.some(b=>!ids.has(String(b.booking_id)))) warnings.push('current_bookings incomplete; Overview derives open work from bookings');
      if(data.assets.length === 0 && data.bookings.some(b=>workflowOpen(b) && (b.phone_asset_id || b.lens_asset_id))) issues.push('assets: zero despite active asset assignments');
      if(KEYS.every(k=>counts[k]===0)) warnings.push('All snapshot counts are zero; no independent evidence confirms an empty system');
    }
    return {ok:issues.length===0, counts, issues, warnings};
  }
  function bangkokDay(now){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now || new Date());
  }
  function currentBookings(data){ return data.bookings.filter(workflowOpen); }
  function todayBookings(data, day){
    return currentBookings(data).filter(b=>String(b.event_date || '').slice(0,10)===(day || bangkokDay()))
      .sort((a,b)=>String(a.pickup_time||'').localeCompare(String(b.pickup_time||'')));
  }
  return {VERSION, BACKEND, KEYS, assess, workflowOpen, bangkokDay, currentBookings, todayBookings};
});
