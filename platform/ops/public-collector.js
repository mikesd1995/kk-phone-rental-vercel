'use strict';

// Public observations only. The host supplies identities; source text cannot select a destination.
const {createHash} = require('node:crypto');
const C = require('../contracts');
const VERSION = 'kk-public-observation-v1';
const MAX_BYTES = 512 * 1024;
const MAX_ROWS = 10000;
const MAX_SELECTED_ROWS = 512;
const EVENT_ID = /^EVT-[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/;
const SOURCES = Object.freeze({
  web_ready: Object.freeze({
    url:'https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK',
    headers:Object.freeze(['event_id','event_name','event_date_text','venue','poster_image_url','event_note','available_phone_count','available_lens_count','booking_status_for_web','action_for_web','line_message_template'])
  }),
  web_packages: Object.freeze({
    url:'https://kk-phone-rental.vercel.app/api/kk-data?sheet=09_Web_Packages&range=A4%3AN',
    headers:Object.freeze(['package_id','event_id','package_type','model_group','model_display','lens_group','lens_display','price','available_count','package_status','sort_order','web_note','raw_available_count','use_case'])
  })
});

function csv(text) {
  C.requireThat(text.length > 0 && !text.includes('\0'), 'PUBLIC_CSV_INVALID');
  if (text[0] === '\uFEFF') text = text.slice(1);
  const rows = []; let row = []; let value = ''; let state = 'START'; let pending = false;
  const field = () => { row.push(value); value = ''; state = 'START'; };
  const record = () => { field(); rows.push(row); row = []; pending = false; C.requireThat(rows.length <= MAX_ROWS, 'PUBLIC_TOO_MANY_ROWS'); };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]; pending = true;
    if (state === 'QUOTED') {
      if (ch === '"') { if (text[i+1] === '"') { value += '"'; i++; } else state = 'CLOSED'; }
      else value += ch;
      continue;
    }
    if (ch === ',') { field(); continue; }
    if (ch === '\n') { record(); continue; }
    if (ch === '\r') { C.requireThat(text[i+1] === '\n', 'PUBLIC_CSV_INVALID'); i++; record(); continue; }
    C.requireThat(state !== 'CLOSED', 'PUBLIC_CSV_INVALID');
    if (ch === '"') { C.requireThat(state === 'START', 'PUBLIC_CSV_INVALID'); state = 'QUOTED'; }
    else { state = 'UNQUOTED'; value += ch; }
  }
  C.requireThat(state !== 'QUOTED', 'PUBLIC_CSV_INVALID');
  if (pending || row.length || value.length) record();
  return rows;
}

function eventDate(value) {
  let normalized = value;
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (local) normalized = local[3] + '-' + local[2] + '-' + local[1];
  C.requireThat(/^\d{4}-\d{2}-\d{2}$/.test(normalized), 'PUBLIC_EVENT_DATE_INVALID');
  const parsed = new Date(normalized + 'T00:00:00.000Z');
  C.requireThat(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === normalized, 'PUBLIC_EVENT_DATE_INVALID');
  return normalized;
}

function parseObservations(body, key, eventIds) {
  const table = csv(body); const header = table.shift(); const expected = SOURCES[key].headers;
  C.requireThat(header && header.length === expected.length && header.every((x,i) => x === expected[i]), 'PUBLIC_HEADER_MISMATCH');
  const data = table.filter(row => row.some(cell => cell !== ''));
  C.requireThat(data.length > 0, 'PUBLIC_SOURCE_EMPTY');
  const selected = new Set(eventIds); const rows = []; const findings = [];
  for (const row of data) {
    C.requireThat(row.length === header.length, 'PUBLIC_CSV_WIDTH_INVALID');
    const id = row[key === 'web_ready' ? 0 : 1];
    C.requireThat(EVENT_ID.test(id), 'PUBLIC_EVENT_ID_INVALID');
    if (!selected.has(id)) continue;
    C.requireThat(rows.length < MAX_SELECTED_ROWS, 'PUBLIC_SELECTED_ROWS_EXCEEDED');
    if (key === 'web_ready') {
      const rawVisibility = row[9].toUpperCase();
      const visibility = ['SHOW','SHOW_FULL','HIDE'].includes(rawVisibility) ? rawVisibility : 'UNKNOWN';
      if (visibility === 'UNKNOWN') findings.push({code:'PUBLIC_VISIBILITY_UNKNOWN',event_id:id});
      rows.push({event_id:id,event_date:eventDate(row[2]),visibility});
    } else {
      C.requireThat(/^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/.test(row[0]), 'PUBLIC_PACKAGE_ID_INVALID');
      rows.push({event_id:id,package_id:row[0]});
    }
  }
  const missing = eventIds.filter(id => !rows.some(row => row.event_id === id));
  for (const id of missing) findings.push({code:'PUBLIC_SELECTED_EVENT_MISSING',event_id:id});
  const identityField = key === 'web_ready' ? 'event_id' : 'package_id';
  const counts = new Map();
  for (const row of rows) counts.set(row[identityField],(counts.get(row[identityField]) || 0)+1);
  for (const [id,count] of counts) if (count > 1) findings.push({code:key === 'web_ready' ? 'PUBLIC_EVENT_IDENTITY_COLLISION' : 'PUBLIC_PACKAGE_IDENTITY_COLLISION',[identityField]:id,count});
  return {rows,missing_event_ids:missing,findings};
}

async function sourceObservation(key, {eventIds,clock,fetchImpl,timeoutMs}) {
  const source = SOURCES[key]; const controller = new AbortController(); let reader; let timer;
  const result = {availability:'UNAVAILABLE',source_ref:source.url,observed_at:clock(),response_sha256:null,byte_length:null,rows:[],missing_event_ids:[],findings:[],error_code:null};
  const timeout = new Promise((_,reject) => {
    timer = setTimeout(() => { controller.abort(); if (reader) Promise.resolve(reader.cancel()).catch(()=>{}); const error = new Error('PUBLIC_TIMEOUT'); error.code = 'PUBLIC_TIMEOUT'; reject(error); },timeoutMs);
  });
  try {
    const operation = (async () => {
      const response = await fetchImpl(source.url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'text/csv'},signal:controller.signal});
      C.requireThat(!controller.signal.aborted, 'PUBLIC_TIMEOUT');
      C.requireThat(response && !response.redirected && (!response.url || response.url === source.url), 'PUBLIC_REDIRECT_DENIED');
      C.requireThat(response.status === 200, 'PUBLIC_HTTP_UNAVAILABLE');
      C.requireThat(/^text\/csv(?:\s*;|\s*$)/i.test(response.headers.get('content-type') || ''), 'PUBLIC_CONTENT_TYPE_INVALID');
      const declared = response.headers.get('content-length');
      C.requireThat(declared === null || /^\d+$/.test(declared) && Number(declared) <= MAX_BYTES, 'PUBLIC_BODY_TOO_LARGE');
      C.requireThat(response.body && typeof response.body.getReader === 'function', 'PUBLIC_STREAM_REQUIRED');
      reader = response.body.getReader(); const chunks = []; let bytes = 0;
      while (true) {
        const {done,value} = await reader.read(); C.requireThat(!controller.signal.aborted, 'PUBLIC_TIMEOUT'); if (done) break;
        C.requireThat(value instanceof Uint8Array, 'PUBLIC_STREAM_INVALID');
        bytes += value.byteLength; C.requireThat(bytes <= MAX_BYTES, 'PUBLIC_BODY_TOO_LARGE'); chunks.push(Buffer.from(value));
      }
      const raw = Buffer.concat(chunks); result.byte_length = bytes;
      result.response_sha256 = createHash('sha256').update(raw).digest('hex');
      let body; try { body = new TextDecoder('utf-8',{fatal:true}).decode(raw); } catch { C.fail('PUBLIC_ENCODING_INVALID'); }
      const observations = parseObservations(body,key,eventIds);
      return {...observations,availability:observations.missing_event_ids.length ? 'PARTIAL' : 'AVAILABLE'};
    })();
    Object.assign(result,await Promise.race([operation,timeout]));
  } catch (error) {
    const allowed = new Set(['PUBLIC_TIMEOUT','PUBLIC_REDIRECT_DENIED','PUBLIC_HTTP_UNAVAILABLE','PUBLIC_CONTENT_TYPE_INVALID','PUBLIC_BODY_TOO_LARGE','PUBLIC_STREAM_REQUIRED','PUBLIC_STREAM_INVALID','PUBLIC_ENCODING_INVALID','PUBLIC_CSV_INVALID','PUBLIC_TOO_MANY_ROWS','PUBLIC_HEADER_MISMATCH','PUBLIC_SOURCE_EMPTY','PUBLIC_CSV_WIDTH_INVALID','PUBLIC_EVENT_ID_INVALID','PUBLIC_SELECTED_ROWS_EXCEEDED','PUBLIC_EVENT_DATE_INVALID','PUBLIC_PACKAGE_ID_INVALID']);
    result.error_code = allowed.has(error?.code) ? error.code : 'PUBLIC_FETCH_UNAVAILABLE';
    result.rows = []; result.missing_event_ids = []; result.findings = [];
  } finally {
    clearTimeout(timer); controller.abort(); if (reader) Promise.resolve(reader.cancel()).catch(()=>{});
  }
  result.observed_at = clock();
  // A late, misbehaving injected transport cannot mutate the returned timeout observation.
  return {...result};
}

async function collectPublic({eventIds,now = () => new Date().toISOString(),fetchImpl = globalThis.fetch,timeoutMs = 15000} = {}) {
  C.requireThat(Array.isArray(eventIds) && eventIds.length > 0 && eventIds.length <= 128 && eventIds.every(id => typeof id === 'string' && EVENT_ID.test(id)) && new Set(eventIds).size === eventIds.length, 'PUBLIC_SELECTION_INVALID');
  C.requireThat(typeof fetchImpl === 'function' && Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 15000, 'PUBLIC_CONFIG_INVALID');
  const clock = () => C.utc(typeof now === 'function' ? now() : now); clock();
  const identities = [...eventIds];
  const entries = await Promise.all(Object.keys(SOURCES).map(async key => [key,await sourceObservation(key,{eventIds:identities,clock,fetchImpl,timeoutMs})]));
  const surfaces = Object.fromEntries(entries); const values = Object.values(surfaces);
  const availability = values.every(s => s.availability === 'AVAILABLE') ? 'AVAILABLE' : values.every(s => s.availability === 'UNAVAILABLE') ? 'UNAVAILABLE' : 'PARTIAL';
  return {schema_version:VERSION,observed_at:clock(),scope:{kind:'EXPLICIT_EVENT_IDS',event_ids:identities},availability,
    status:availability !== 'AVAILABLE' ? 'UNKNOWN' : values.some(s => s.findings.length) ? 'ATTENTION_REQUIRED' : 'OBSERVED',
    coverage:'SELECTED_PUBLIC_IDS_ONLY',authoritative:false,execution_authorized:false,full_system_verified:false,production_writes:0,request_attempts:2,surfaces,
    acceptance:{core_authority:'NOT_EVALUATED',pricing:'NOT_EVALUATED',booking_capacity:'NOT_EVALUATED',provider_delivery:'NOT_EVALUATED',rental_lifecycle:'NOT_EVALUATED'}};
}

module.exports = {collectPublic,VERSION};
