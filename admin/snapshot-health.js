(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.KKSnapshotHealth = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const VERSION = 'admin-snapshot-resilience-2';
  const BACKEND = 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX';
  const KEYS = ['events','bookings','current_bookings','assets'];
  const ID_FIELDS = {events:'event_id', bookings:'booking_id', current_bookings:'booking_id', assets:'asset_id'};
  const COLLAPSE_KEYS = ['events','bookings','assets'];
  const COLLAPSE_MIN_PREVIOUS = 8;
  const COLLAPSE_RATIO = 0.35;
  const status = value => String(value || '').trim().toLowerCase();
  const workflowOpen = b => ['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(status(b.booking_status));

  function identityProblems(key, rows){
    const idField = ID_FIELDS[key];
    if(!idField || !Array.isArray(rows)) return [];
    const seen = new Set();
    const duplicate = new Set();
    let missing = 0;
    for(const row of rows){
      const id = String(row && row[idField] || '').trim();
      if(!id){ missing++; continue; }
      if(seen.has(id)) duplicate.add(id);
      else seen.add(id);
    }
    const issues = [];
    if(missing) issues.push(key + ': ' + missing + ' rows missing ' + idField);
    if(duplicate.size) issues.push(key + ': duplicate ' + idField + ' ' + Array.from(duplicate).slice(0,3).join(', ') + (duplicate.size > 3 ? '…' : ''));
    return issues;
  }

  function collapseSignals(data, previous){
    if(!previous) return [];
    const out = [];
    for(const key of COLLAPSE_KEYS){
      const before = Array.isArray(previous[key]) ? previous[key].length : 0;
      const after = data && Array.isArray(data[key]) ? data[key].length : 0;
      if(before >= COLLAPSE_MIN_PREVIOUS && after > 0 && (after / before) <= COLLAPSE_RATIO){
        out.push({key, before, after});
      }
    }
    return out;
  }

  function assess(data, previous){
    const counts = {}, issues = [], warnings = [];
    for(const key of KEYS){
      const rows = data && data[key];
      counts[key] = Array.isArray(rows) ? rows.length : null;
      if(!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object' || Array.isArray(r))){
        issues.push(key + ': missing or invalid array');
        continue;
      }
      issues.push(...identityProblems(key, rows));
      if(key !== 'current_bookings' && counts[key] === 0 && previous && Array.isArray(previous[key]) && previous[key].length){
        issues.push(key + ': unexpectedly fell to zero');
      }
    }

    if(!issues.length){
      if(data.events.length === 0 && (data.bookings.length || (Array.isArray(data.web_ready) && data.web_ready.length))){
        issues.push('events: zero despite booking/public-feed evidence');
      }

      const collapses = collapseSignals(data, previous);
      if(collapses.length >= 2){
        issues.push('correlated snapshot count collapse: ' + collapses.map(x=>x.key + ' ' + x.before + '→' + x.after).join(', '));
      } else if(collapses.length === 1){
        const x = collapses[0];
        warnings.push(x.key + ': count dropped sharply ' + x.before + '→' + x.after + '; verify archive/read path');
      }

      const active = data.bookings.filter(workflowOpen);
      const currentIds = new Set(data.current_bookings.map(b=>String(b.booking_id)));
      const bookingIds = new Set(data.bookings.map(b=>String(b.booking_id)));
      if(active.some(b=>!currentIds.has(String(b.booking_id)))){
        warnings.push('current_bookings incomplete; Overview derives open work from bookings');
      }
      if(data.current_bookings.some(b=>!bookingIds.has(String(b.booking_id)))){
        warnings.push('current_bookings contains booking_id not present in bookings');
      }
      if(data.assets.length === 0 && data.bookings.some(b=>workflowOpen(b) && (b.phone_asset_id || b.lens_asset_id))){
        issues.push('assets: zero despite active asset assignments');
      }
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
  return {VERSION, BACKEND, KEYS, ID_FIELDS, assess, workflowOpen, bangkokDay, currentBookings, todayBookings};
});
