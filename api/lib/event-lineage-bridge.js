'use strict';

const crypto = require('crypto');

const MAPPING_VERSION = 'tracker-core-lineage-v1';

function requiredText(value, field){
  const text = String(value == null ? '' : value).trim();
  if(!text) throw new Error(field + ' is required');
  return text;
}

function normalizeEventDate(value){
  const raw = requiredText(value, 'event_date');
  let year; let month; let day;
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m){
    year = Number(m[1]); month = Number(m[2]); day = Number(m[3]);
  }else{
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(!m) throw new Error('event_date must be YYYY-MM-DD or DD/MM/YYYY');
    day = Number(m[1]); month = Number(m[2]); year = Number(m[3]);
    if(year >= 2400) year -= 543;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if(d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day){
    throw new Error('event_date is invalid');
  }
  return [String(year).padStart(4,'0'), String(month).padStart(2,'0'), String(day).padStart(2,'0')].join('-');
}

function assertFamilyId(value){
  const id = requiredText(value, 'event_family_id');
  if(!id.startsWith('FAM|')) throw new Error('event_family_id must start with FAM|');
  return id;
}

function assertTrackerShowId(value){
  const id = requiredText(value, 'tracker_show_id');
  if(!(id.startsWith('SHOW|') || id.startsWith('SHOWSET|'))){
    throw new Error('tracker_show_id must start with SHOW| or SHOWSET|');
  }
  return id;
}

function assertCoreEventId(value){
  const id = requiredText(value, 'core_event_id');
  if(!id.startsWith('EVT-')) throw new Error('core_event_id must start with EVT-');
  return id;
}

function showInstanceId(trackerShowId, eventDate){
  const showId = assertTrackerShowId(trackerShowId);
  const date = normalizeEventDate(eventDate);
  // SHOWSET is a multi-day grouping, so it is unsafe as a one-to-one mapping
  // key by itself. Date-scope it into an immutable show instance.
  return showId.startsWith('SHOWSET|') ? `${showId}|DATE|${date}` : showId;
}

function coreEventDate(coreEventId){
  const id = assertCoreEventId(coreEventId);
  const m = id.match(/^EVT-(\d{4})(\d{2})(\d{2})(?:-|$)/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function stableLineageKey({eventFamilyId, showInstance, eventDate, coreEventId}){
  return crypto.createHash('sha256')
    .update([MAPPING_VERSION,eventFamilyId,showInstance,eventDate,coreEventId].join('\n'))
    .digest('hex');
}

function buildLineageRecord(input){
  const eventFamilyId = assertFamilyId(input && input.event_family_id);
  const trackerShowId = assertTrackerShowId(input && input.tracker_show_id);
  const eventDate = normalizeEventDate(input && input.event_date);
  const coreEventId = assertCoreEventId(input && input.core_event_id);
  const showInstance = showInstanceId(trackerShowId, eventDate);
  const idDate = coreEventDate(coreEventId);
  if(idDate && idDate !== eventDate){
    throw new Error(`core_event_id date ${idDate} does not match event_date ${eventDate}`);
  }
  const ticketLifecycle = String((input && input.ticket_lifecycle) || '').trim() || null;
  const rentalLifecycle = String((input && input.rental_lifecycle) || '').trim() || null;
  const record = {
    mapping_version: MAPPING_VERSION,
    event_family_id: eventFamilyId,
    tracker_show_id: trackerShowId,
    show_instance_id: showInstance,
    event_date: eventDate,
    core_event_id: coreEventId,
    // Ticket and rental lifecycle are deliberately independent. SOLD_OUT on a
    // ticket surface must never implicitly close rental inventory/availability.
    ticket_lifecycle: ticketLifecycle,
    rental_lifecycle: rentalLifecycle,
    mapping_status: 'EXPLICIT'
  };
  record.lineage_key = stableLineageKey({
    eventFamilyId,
    showInstance,
    eventDate,
    coreEventId
  });
  return record;
}

function validateLineageSet(inputRows){
  const rows = (inputRows || []).map(buildLineageRecord);
  const byShow = new Map();
  const byCore = new Map();
  const byKey = new Set();
  for(const row of rows){
    if(byKey.has(row.lineage_key)) throw new Error(`duplicate lineage record: ${row.lineage_key}`);
    byKey.add(row.lineage_key);

    const showKey = row.show_instance_id;
    if(byShow.has(showKey) && byShow.get(showKey) !== row.core_event_id){
      throw new Error(`show instance maps to multiple Core events: ${showKey}`);
    }
    byShow.set(showKey,row.core_event_id);

    if(byCore.has(row.core_event_id) && byCore.get(row.core_event_id) !== showKey){
      throw new Error(`Core event maps to multiple Tracker show instances: ${row.core_event_id}`);
    }
    byCore.set(row.core_event_id,showKey);
  }
  return rows;
}

function resolveCoreEventId(inputRows, query){
  const eventFamilyId = assertFamilyId(query && query.event_family_id);
  const showId = assertTrackerShowId(query && query.tracker_show_id);
  const date = normalizeEventDate(query && query.event_date);
  const instance = showInstanceId(showId,date);
  const matches = validateLineageSet(inputRows).filter(row =>
    row.event_family_id === eventFamilyId && row.show_instance_id === instance && row.event_date === date
  );
  if(matches.length > 1) throw new Error('ambiguous lineage mapping');
  return matches.length === 1 ? matches[0].core_event_id : null;
}

module.exports = {
  MAPPING_VERSION,
  normalizeEventDate,
  showInstanceId,
  coreEventDate,
  buildLineageRecord,
  validateLineageSet,
  resolveCoreEventId
};
