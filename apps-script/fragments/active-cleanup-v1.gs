// Offline candidate only. HEAD timers and versioned web creators are separate deployments.
// A property is an activation interlock, NOT evidence that writer coordination was proven.
function kkActiveProps_() { return PropertiesService.getDocumentProperties(); }
function kkActiveAssertNoPending_() {
  if (kkActiveProps_().getProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1')) throw new Error('CLEANUP_PENDING_RECONCILIATION');
}
function kkActiveGate_() {
  let receipt;
  try { receipt = JSON.parse(kkActiveProps_().getProperty('KK_ACTIVE_CLEANUP_RELEASE_V1') || 'null'); } catch (_) {}
  if (!receipt || receipt.schema !== 'KK_ACTIVE_CLEANUP_RELEASE_V1' || receipt.creators_version !== 'KK_IMMUTABLE_CREATOR_V1' || receipt.external_writers_fenced !== true || receipt.owner_release_approved !== true) {
    throw new Error('CLEANUP_ACTIVATION_REQUIRED');
  }
}
function kkActiveTyped_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (!isFinite(v.getTime())) throw new Error('CLEANUP_DATE_INVALID');
    return {date: v.getTime()};
  }
  if (Array.isArray(v)) return v.map(kkActiveTyped_);
  if (v && typeof v === 'object') { const o={}; Object.keys(v).forEach(k=>{o[k]=kkActiveTyped_(v[k]);}); return o; }
  if (typeof v === 'number' && !isFinite(v)) throw new Error('CLEANUP_VALUE_INVALID');
  if (!['string','number','boolean'].includes(typeof v) && v !== null) throw new Error('CLEANUP_VALUE_INVALID');
  return v;
}
function kkActiveUntyped_(v) {
  if (Array.isArray(v)) return v.map(kkActiveUntyped_);
  if (v && typeof v === 'object') {
    if (Object.keys(v).length === 1 && typeof v.date === 'number') return new Date(v.date);
    const o={}; Object.keys(v).forEach(k=>{o[k]=kkActiveUntyped_(v[k]);}); return o;
  }
  return v;
}
function kkActiveEqual_(a,b) { return JSON.stringify(kkActiveTyped_(a)) === JSON.stringify(kkActiveTyped_(b)); }
function kkActiveBlank_(row) { return row.every(v=>v === '' || v === null); }
function kkActiveDate_(v) {
  if (v === '' || v === null) return null;
  if (typeof v !== 'string' && Object.prototype.toString.call(v) !== '[object Date]') throw new Error('CLEANUP_DATE_INVALID');
  if (typeof v === 'string' && !/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}(T.*)?)$/.test(v.trim())) throw new Error('CLEANUP_DATE_INVALID');
  try {
    const d=kkDateObj_(v); if (!isFinite(d.getTime())) throw new Error();
    // Reject ISO calendar rollover (e.g. February 30), which Date itself normalizes.
    if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const p=v.slice(0,10).split('-').map(Number),calendar=new Date(p[0],p[1]-1,p[2]);
      if(calendar.getFullYear()!==p[0]||calendar.getMonth()!==p[1]-1||calendar.getDate()!==p[2])throw new Error();
    }
    return d;
  } catch (_) { throw new Error('CLEANUP_DATE_INVALID'); }
}
function kkActiveCreatedAt_(value) {
  // Validation-only boundary for the verified legacy booking timestamp format.
  // Raw source/archive values stay unchanged; event dates still use kkActiveDate_.
  const text=typeof value==='string'?value.trim():'';
  const match=/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(text);
  if(!match)return kkActiveDate_(value);
  const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]);
  if(month<1||month>12||day<1||day>31||hour>23||minute>59)throw new Error('CLEANUP_DATE_INVALID');
  const iso=match[3]+'-'+match[2]+'-'+match[1],calendar=new Date(iso+'T00:00:00Z');
  if(!isFinite(calendar.getTime())||calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)throw new Error('CLEANUP_DATE_INVALID');
  const stamp=new Date(iso+'T'+match[4]+':'+match[5]+':00+07:00');
  if(!isFinite(stamp.getTime()))throw new Error('CLEANUP_DATE_INVALID');
  return stamp;
}
function kkActiveRead_(name,start,width) {
  const sh=kkSheet_(name), count=Math.max(0,sh.getLastRow()-start+1);
  return count ? sh.getRange(start,1,count,width).getValues() : [];
}
function kkActiveRow_(name,row,width) { return kkSheet_(name).getRange(row,1,1,width).getValues()[0]; }
function kkActiveNoFormula_(name,row,width) {
  if (kkSheet_(name).getRange(row,1,1,width).getFormulas()[0].some(Boolean)) throw new Error('CLEANUP_FORMULA_CONFLICT');
}
function kkActiveDigest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function kkActiveJournalValidate_(j) {
  const pairs={}; pairs[KK.bookings]=[KK.bookingArchive,20,26,20]; pairs[KK.overrides]=[KK.overrideArchive,7,9,7]; pairs[KK.events]=[KK.eventArchive,9,11,8];
  if (!j || j.version !== 1 || !['archive','create'].includes(j.kind) || !Number.isInteger(j.row) || j.row<5 || !Array.isArray(j.before)) throw new Error('CLEANUP_JOURNAL_INVALID');
  if (j.kind === 'create') {
    if (j.source !== KK.bookings || j.before.length !==20 || !Array.isArray(j.after) || j.after.length!==20 || !kkActiveBlank_(j.before) || !/^BK-/.test(j.after[0]) || !Array.isArray(j.beforeFormulas) || j.beforeFormulas.length!==20 || j.beforeFormulas.slice(1).some(Boolean)) throw new Error('CLEANUP_JOURNAL_INVALID');
    return;
  }
  const p=pairs[j.source];
  if (!p || j.archive!==p[0] || j.before.length!==p[1] || j.clearWidth!==p[3] || !Array.isArray(j.copy) || j.copy.length!==p[2] || !Number.isInteger(j.destination) || j.destination<2 || !kkActiveEqual_(j.copy.slice(j.source===KK.bookings?6:2),j.before)) throw new Error('CLEANUP_JOURNAL_INVALID');
  if(!j.eventContext||!Number.isInteger(j.eventContext.row)||j.eventContext.row<5||!Array.isArray(j.eventContext.before)||j.eventContext.before.length!==8||!j.eventContext.before[0])throw new Error('CLEANUP_JOURNAL_INVALID');
  if (j.stats && (j.source!==KK.bookings || !Number.isInteger(j.stats.row) || j.stats.row<2 || !Array.isArray(j.stats.before) || !Array.isArray(j.stats.after) || j.stats.before.length!==10 || j.stats.after.length!==10 || !Number.isInteger(j.stats.after[4]) || j.stats.after[4]<Number(j.stats.before[4]||0))) throw new Error('CLEANUP_JOURNAL_INVALID');
}
function kkActiveJournalRead_() {
  const raw=kkActiveProps_().getProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1'); if (!raw) return null;
  try {
    if (unescape(encodeURIComponent(raw)).length>8000) throw new Error();
    const envelope=JSON.parse(raw);
    if (typeof envelope.payload!=='string' || envelope.digest!==kkActiveDigest_(envelope.payload)) throw new Error();
    const j=kkActiveUntyped_(JSON.parse(envelope.payload)); kkActiveJournalValidate_(j); return j;
  } catch (_) { throw new Error('CLEANUP_JOURNAL_INVALID'); }
}
function kkActiveJournalSave_(j) {
  kkActiveAssertNoPending_(); kkActiveJournalValidate_(j);
  const payload=JSON.stringify(kkActiveTyped_(j)), raw=JSON.stringify({payload:payload,digest:kkActiveDigest_(payload)});
  if (unescape(encodeURIComponent(raw)).length>8000) throw new Error('CLEANUP_JOURNAL_OVERSIZE');
  kkActiveProps_().setProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1',raw);
  if (kkActiveProps_().getProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1')!==raw) throw new Error('CLEANUP_JOURNAL_READBACK');
}
function kkActiveSetExact_(name,row,before,after) {
  const current=kkActiveRow_(name,row,after.length);
  kkActiveNoFormula_(name,row,after.length);
  if (kkActiveEqual_(current,after)) return;
  if (!kkActiveEqual_(current,before)) throw new Error('CLEANUP_DESTINATION_CHANGED');
  kkSheet_(name).getRange(row,1,1,after.length).setValues([after]); SpreadsheetApp.flush();
  if (!kkActiveEqual_(kkActiveRow_(name,row,after.length),after)) throw new Error('CLEANUP_EXACT_READBACK_FAILED');
}
function kkActiveResume_(j) {
  kkActiveJournalValidate_(j);
  if (j.kind==='create') {
    const range=kkSheet_(j.source).getRange(j.row,1,1,20),current=range.getValues()[0],formulas=range.getFormulas()[0];
    if(!kkActiveEqual_(current,j.after) || formulas.some(Boolean)) {
      if(!kkActiveEqual_(current,j.before)||!kkActiveEqual_(formulas,j.beforeFormulas))throw new Error('CLEANUP_SOURCE_CHANGED');
      range.setValues([j.after]);SpreadsheetApp.flush();
      if(!kkActiveEqual_(range.getValues()[0],j.after)||range.getFormulas()[0].some(Boolean))throw new Error('CLEANUP_EXACT_READBACK_FAILED');
    }
  } else {
    kkActiveEventContext_(j);
    const cleared=j.before.map((v,i)=>i<j.clearWidth?'':v), current=kkActiveRow_(j.source,j.row,j.before.length);
    const sameSource=(a,b)=>kkActiveEqual_(a.slice(0,j.clearWidth),b.slice(0,j.clearWidth));
    // Event column I is derived; only A:H is owned by this transaction.
    if (!sameSource(current,j.before) && !sameSource(current,cleared)) throw new Error('CLEANUP_SOURCE_CHANGED');
    kkActiveNoFormula_(j.source,j.row,j.clearWidth);
    // A cleared source is only accepted with its exact committed archive already present.
    if (sameSource(current,cleared) && !kkActiveEqual_(kkActiveRow_(j.archive,j.destination,j.copy.length),j.copy)) throw new Error('CLEANUP_ARCHIVE_MISSING');
    kkActiveSetExact_(j.archive,j.destination,Array(j.copy.length).fill(''),j.copy);
    if (j.stats) kkActiveSetExact_(KK.customerStats,j.stats.row,j.stats.before,j.stats.after);
    kkActiveArchiveReadback_(j);
    kkActiveEventContext_(j);
    const fresh=kkActiveRow_(j.source,j.row,j.before.length);
    if (!sameSource(fresh,cleared)) {
      if (!sameSource(fresh,j.before)) throw new Error('CLEANUP_SOURCE_CHANGED');
      kkActiveNoFormula_(j.source,j.row,j.clearWidth);
      kkSheet_(j.source).getRange(j.row,1,1,j.clearWidth).clearContent(); SpreadsheetApp.flush();
    }
    if (!sameSource(kkActiveRow_(j.source,j.row,j.before.length),cleared)) throw new Error('CLEANUP_CLEAR_READBACK_FAILED');
    kkActiveArchiveReadback_(j);
  }
  kkActiveProps_().deleteProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1');
  if (kkActiveProps_().getProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1')) throw new Error('CLEANUP_JOURNAL_DELETE_READBACK');
}
function kkActiveArchiveReadback_(j) {
  if(!kkActiveEqual_(kkActiveRow_(j.archive,j.destination,j.copy.length),j.copy))throw new Error('CLEANUP_ARCHIVE_READBACK_FAILED');
  if(j.stats&&!kkActiveEqual_(kkActiveRow_(KK.customerStats,j.stats.row,10),j.stats.after))throw new Error('CLEANUP_STATS_READBACK_FAILED');
}
function kkActiveEventContext_(j) {
  const context=j.eventContext,current=kkActiveRow_(KK.events,context.row,8);
  const ownEventAlreadyCleared=j.source===KK.events&&j.row===context.row&&kkActiveBlank_(current)&&kkActiveEqual_(kkActiveRow_(j.archive,j.destination,j.copy.length),j.copy);
  if(!ownEventAlreadyCleared&&!kkActiveEqual_(current,context.before))throw new Error('CLEANUP_EVENT_CONTEXT_CHANGED');
  const expectedId=j.source===KK.bookings?j.before[3]:j.before[0];
  if(context.before[0]!==expectedId)throw new Error('CLEANUP_EVENT_CONTEXT_CHANGED');
  if(j.source!==KK.bookings&&kkActiveRead_(KK.bookings,5,20).some(r=>String(r[3])===String(expectedId)))throw new Error('CLEANUP_EVENT_DEPENDENCY_CHANGED');
  if(j.source===KK.events&&kkActiveRead_(KK.overrides,5,7).some(r=>String(r[0])===String(expectedId)))throw new Error('CLEANUP_EVENT_DEPENDENCY_CHANGED');
}
function kkActiveSchemas_() {
  const b=kkActiveRow_(KK.bookings,4,20),e=kkActiveRow_(KK.events,4,9),o=kkActiveRow_(KK.overrides,4,7);
  const liveB='booking_id created_at booking_status event_id customer_name customer_contact customer_phone channel package_type phone_asset_id lens_asset_id pickup_time return_time payment_status amount_received return_status file_transfer_status drive_link damage_fee staff_note'.split(' ');
  const liveE='event_id event_name event_date venue poster_image_url event_status active_on_web event_note data_health'.split(' ');
  const liveO='event_id template_id override_price active_override override_note sort_order_override use_case_override'.split(' ');
  if (!kkActiveEqual_(b,liveB)||!kkActiveEqual_(e,liveE)||!kkActiveEqual_(o,liveO)) throw new Error('CLEANUP_SCHEMA_MISMATCH');
  const expected={}; expected[KK.bookingArchive]=['archived_at','source_row','event_name','event_date','venue','customer_key'].concat(b); expected[KK.eventArchive]=['archived_at','source_row'].concat(e); expected[KK.overrideArchive]=['archived_at','source_row'].concat(o); expected[KK.customerStats]=['customer_key','customer_name','customer_contact','customer_phone','rental_count','first_rental_date','last_rental_date','last_event_name','last_booking_status','updated_at'];
  Object.keys(expected).forEach(name=>{ if(!kkActiveEqual_(kkActiveRow_(name,1,expected[name].length),expected[name])) throw new Error('CLEANUP_SCHEMA_MISMATCH'); });
}
function kkActivePreflight_() {
  kkActiveSchemas_();
  const data={bookings:kkActiveRead_(KK.bookings,5,20),events:kkActiveRead_(KK.events,5,9),overrides:kkActiveRead_(KK.overrides,5,7),archive:kkActiveRead_(KK.bookingArchive,2,26),stats:kkActiveRead_(KK.customerStats,2,10)};
  function unique(rows,column) { const ids={}; rows.forEach(r=>{const id=String(r[column]||'').trim();if(id){if(ids[id])throw new Error('CLEANUP_DUPLICATE_ID');ids[id]=true;}}); }
  unique(data.bookings,0);unique(data.events,0);unique(data.archive,6);unique(data.stats,0);
  data.events.forEach(r=>{if(r[2])kkActiveDate_(r[2]);}); data.bookings.forEach(r=>{if(r[1])kkActiveCreatedAt_(r[1]);});
  data.archive.forEach(r=>{if(!kkActiveBlank_(r)){if(!r[6]||!r[9])throw new Error('CLEANUP_ARCHIVE_ID_INVALID');kkActiveDate_(r[0]);kkActiveDate_(r[3]);kkActiveCreatedAt_(r[7]);}});
  data.stats.forEach(r=>{if(!kkActiveBlank_(r)){if(!r[0]||!Number.isInteger(Number(r[4]))||Number(r[4])<0)throw new Error('CLEANUP_STATS_INVALID');kkActiveDate_(r[5]);kkActiveDate_(r[6]);}});
  [KK.bookingArchive,KK.eventArchive,KK.overrideArchive,KK.customerStats].forEach(name=>{const n=kkSheet_(name).getLastRow();if(n>1){const width=name===KK.bookingArchive?26:name===KK.eventArchive?11:name===KK.overrideArchive?9:10;if(kkSheet_(name).getRange(2,1,n-1,width).getFormulas().some(r=>r.some(Boolean)))throw new Error('CLEANUP_FORMULA_CONFLICT');}});
  kkActiveRead_(KK.eventArchive,2,11).forEach(r=>{if(r[0])kkActiveDate_(r[0]);if(r[4])kkActiveDate_(r[4]);});
  kkActiveRead_(KK.overrideArchive,2,9).forEach(r=>{if(r[0])kkActiveDate_(r[0]);});
  return data;
}
function kkActiveStatPlan_(copy,archive,stats) {
  if (!['picked_up','returned','uploaded','completed'].includes(String(copy[8]).toLowerCase())) return null;
  const key=copy[5]; if(!key) throw new Error('CLEANUP_CUSTOMER_KEY_REQUIRED');
  const prior=archive.filter(r=>r[5]===key && ['picked_up','returned','uploaded','completed'].includes(String(r[8]).toLowerCase()));
  const index=stats.findIndex(r=>r[0]===key), before=index<0?Array(10).fill(''):stats[index];
  const dates=prior.map(r=>kkActiveDate_(r[3]));
  if(dates.some(d=>!d) || Number(before[4]||0)!==prior.length)throw new Error('CLEANUP_STATS_BASELINE_MISMATCH');
  if(prior.length && (!before[5]||!before[6]||kkActiveDate_(before[5]).getTime()!==Math.min.apply(null,dates.map(Number))||kkActiveDate_(before[6]).getTime()!==Math.max.apply(null,dates.map(Number))))throw new Error('CLEANUP_STATS_BASELINE_MISMATCH');
  const all=prior.concat([copy]).sort((a,b)=>kkActiveDate_(a[3])-kkActiveDate_(b[3])),last=all[all.length-1];
  return {row:index<0?Math.max(kkSheet_(KK.customerStats).getLastRow()+1,2):index+2,before:before,after:[key,copy[10],copy[11],copy[12],all.length,kkActiveDate_(all[0][3]),kkActiveDate_(last[3]),last[2],last[8],copy[0]]};
}
// Bounded port of the canonical main allocator: event date and three-digit sequence.
function kkBookingIdValues_() {
  const ids=[];
  kkActiveRead_(KK.bookings,5,1).forEach(r=>{const id=String(r[0]||'').trim();if(id)ids.push(id);});
  kkActiveRead_(KK.bookingArchive,2,26).forEach(r=>{const id=String(r[6]||'').trim();if(id)ids.push(id);});
  return ids;
}
function kkGenerateUniqueBookingId_(eventDate) {
  if(!kkActiveDate_(eventDate))throw new Error('BOOKING_EVENT_DATE_REQUIRED');
  const prefix='BK-'+kkDateKey_(eventDate)+'-',used={};let maxSeq=0;
  kkBookingIdValues_().forEach(id=>{
    used[id]=true;
    if(id.indexOf(prefix)!==0)return;
    const suffix=id.slice(prefix.length);
    if(/^\d+$/.test(suffix)){
      const value=Number(suffix);if(!Number.isSafeInteger(value)||value>Number.MAX_SAFE_INTEGER-10000)throw new Error('BOOKING_ID_SEQUENCE_INVALID');
      maxSeq=Math.max(maxSeq,value);
    }
  });
  for(let seq=maxSeq+1;seq<maxSeq+10000;seq++){const id=prefix+String(seq).padStart(3,'0');if(!used[id])return id;}
  throw new Error('BOOKING_ID_CAPACITY');
}
function kkActiveCreateBookingRow_(payload,eventDate) {
  // Caller holds the same document lock as cleanup for validation, asset selection and commit.
  kkActiveAssertNoPending_(); if(!Array.isArray(payload)||payload.length!==19)throw new Error('BOOKING_PAYLOAD_INVALID');
  const rows=kkActiveRead_(KK.bookings,5,20),id=kkGenerateUniqueBookingId_(eventDate);
  let row=rows.findIndex((r,i)=>kkActiveBlank_(r)&&!kkSheet_(KK.bookings).getRange(i+5,1,1,20).getFormulas()[0].slice(1).some(Boolean)); row=row<0?Math.max(kkSheet_(KK.bookings).getLastRow()+1,5):row+5;
  if(row>kkSheet_(KK.bookings).getMaxRows())throw new Error('BOOKING_ROW_CAPACITY');
  const before=kkActiveRow_(KK.bookings,row,20); if(!kkActiveBlank_(before))throw new Error('BOOKING_ROW_CHANGED');
  const beforeFormulas=kkSheet_(KK.bookings).getRange(row,1,1,20).getFormulas()[0];
  if(beforeFormulas.slice(1).some(Boolean))throw new Error('CLEANUP_FORMULA_CONFLICT');
  const j={version:1,kind:'create',source:KK.bookings,row:row,before:before,beforeFormulas:beforeFormulas,after:[id].concat(payload)};
  kkActiveJournalSave_(j);kkActiveResume_(j);return {row_number:row,booking_id:id};
}
function kkRecoverPendingBookingCreation() {
  // Explicit owner reconciliation, usable before archival activation. Never creates a booking.
  const lock=kkAcquireDocumentLock_('write operation',12000);
  try {
    const j=kkActiveJournalRead_();if(!j||j.kind!=='create')throw new Error('BOOKING_CREATE_RECONCILIATION_REQUIRED');
    kkActivePreflight_();
    const range=kkSheet_(j.source).getRange(j.row,1,1,20),current=range.getValues()[0],formulas=range.getFormulas()[0];
    let status;
    if(kkActiveEqual_(current,j.after)&&!formulas.some(Boolean))status='EXISTING_CREATE_CONFIRMED';
    else if(kkActiveEqual_(current,j.before)&&kkActiveEqual_(formulas,j.beforeFormulas))status='CREATE_NOT_COMMITTED';
    else throw new Error('CLEANUP_SOURCE_CHANGED');
    kkActiveProps_().deleteProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1');
    if(kkActiveProps_().getProperty('KK_ACTIVE_CLEANUP_JOURNAL_V1'))throw new Error('CLEANUP_JOURNAL_DELETE_READBACK');
    return {status:status,booking_id:j.after[0],row_number:j.row};
  } finally {lock.releaseLock();}
}
function kkActiveValidatePending_(j,data) {
  if(!j.stats)return;
  const archive=data.archive.filter((r,i)=>i+2!==j.destination || !kkActiveEqual_(r,j.copy));
  const stats=data.stats.map((r,i)=>i+2===j.stats.row?j.stats.before:r);
  const expected=kkActiveStatPlan_(j.copy,archive,stats);
  if(!expected||!kkActiveEqual_(expected.before,j.stats.before)||!kkActiveEqual_(expected.after,j.stats.after))throw new Error('CLEANUP_STATS_BASELINE_MISMATCH');
}
function kkCleanupOldData30Days_() {
  const lock=kkAcquireDocumentLock_('write operation',12000);
  try {
    kkActiveGate_(); const pending=kkActiveJournalRead_();
    if(pending){
      if(pending.kind==='create')throw new Error('BOOKING_CREATE_RECONCILIATION_REQUIRED');
      const recoveryData=kkActivePreflight_();kkActiveValidatePending_(pending,recoveryData);kkActiveResume_(pending);
    }
    const data=kkActivePreflight_(), threshold=new Date();threshold.setDate(threshold.getDate()-30);threshold.setHours(0,0,0,0);
    const events={},blocked={},eligible=[];
    data.events.forEach((r,i)=>{if(r[0])events[String(r[0])]={row:i+5,values:r,date:kkActiveDate_(r[2])};});
    data.bookings.forEach((r,i)=>{
      if(kkActiveBlank_(r))return;
      const id=String(r[3]||''),ev=events[id],status=String(r[2]||'').toLowerCase(),formula=kkSheet_(KK.bookings).getRange(i+5,1,1,20).getFormulas()[0].some(Boolean);
      const terminal=status==='completed'||((status==='cancelled'||status==='no_show')&&Number(r[14]||0)===0&&Number(r[18]||0)===0&&r[13]==='unpaid');
      if(!r[0]||!r[1]||!r[4]||!ev||!ev.date||!terminal||formula||!Number.isFinite(Number(r[14]||0))||Number(r[14]||0)<0||!Number.isFinite(Number(r[18]||0))||Number(r[18]||0)<0){if(id)blocked[id]=true;return;}
      if(ev.date>=threshold){blocked[id]=true;return;}
      if(data.archive.some(a=>a[6]===r[0])){blocked[id]=true;return;}
      const copy=[new Date(),i+5,ev.values[1],ev.values[2],ev.values[3],kkCustomerKey_(r[4],r[5],r[6])].concat(r);
      // Validate every affected customer's historical baseline before the first write.
      kkActiveStatPlan_(copy,data.archive,data.stats);
      eligible.push({version:1,kind:'archive',source:KK.bookings,archive:KK.bookingArchive,row:i+5,before:r,copy:copy,clearWidth:20,eventContext:{row:ev.row,before:ev.values.slice(0,8)}});
    });
    const result={archived_bookings:0,archived_events:0,archived_overrides:0,customer_stats_updated:0,threshold_date:kkApiDate_(threshold),recovered_transaction:pending?{kind:pending.kind,source:pending.source,row:pending.row}:null};
    function commit(j){j.destination=Math.max(kkSheet_(j.archive).getLastRow()+1,2);kkActiveJournalSave_(j);kkActiveResume_(j);}
    eligible.forEach(j=>{j.stats=kkActiveStatPlan_(j.copy,kkActiveRead_(KK.bookingArchive,2,26),kkActiveRead_(KK.customerStats,2,10));commit(j);result.archived_bookings++;if(j.stats)result.customer_stats_updated++;});
    // Keep any event with a surviving booking, including unclassified/financially ambiguous rows.
    kkActiveRead_(KK.bookings,5,20).forEach(r=>{if(r[3])blocked[String(r[3])]=true;});
    Object.keys(events).forEach(id=>{
      const ev=events[id];if(blocked[id]||!ev.date||ev.date>=threshold)return;
      if(kkActiveRead_(KK.eventArchive,2,11).some(r=>String(r[2])===id))return;
      const overrides=data.overrides.map((r,i)=>({r:r,row:i+5})).filter(x=>String(x.r[0])===id);
      // Check formulas before any dependent override is removed.
      if(kkSheet_(KK.events).getRange(ev.row,1,1,8).getFormulas()[0].some(Boolean)||overrides.some(x=>kkSheet_(KK.overrides).getRange(x.row,1,1,7).getFormulas()[0].some(Boolean)))return;
      overrides.forEach(x=>{commit({version:1,kind:'archive',source:KK.overrides,archive:KK.overrideArchive,row:x.row,before:x.r,copy:[new Date(),x.row].concat(x.r),clearWidth:7,eventContext:{row:ev.row,before:ev.values.slice(0,8)}});result.archived_overrides++;});
      // Event deletion happens last, after all dependent records have verified copies.
      const current=kkActiveRow_(KK.events,ev.row,9);
      if(!kkActiveEqual_(current.slice(0,8),ev.values.slice(0,8)))throw new Error('CLEANUP_SOURCE_CHANGED');
      commit({version:1,kind:'archive',source:KK.events,archive:KK.eventArchive,row:ev.row,before:current,copy:[new Date(),ev.row].concat(current),clearWidth:8,eventContext:{row:ev.row,before:current.slice(0,8)}});result.archived_events++;
    });
    return result;
  } finally {lock.releaseLock();}
}
