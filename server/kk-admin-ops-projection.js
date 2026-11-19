'use strict';

// The Operations Dashboard must never receive the raw Admin snapshot. Project
// onto an explicit allowlist here, on the authenticated server, not in the UI.
const crypto = require('node:crypto');
const VERSION = 'kk-admin-ops-projection-v1';
const REQUIRED = ['events', 'web_ready', 'web_packages', 'bookings'];
const MAX_ROWS = 20000;
const MAX_TEXT = 2000;

function clean(value, max = 180) {
  return String(value === undefined || value === null ? '' : value).slice(0, Math.min(max, MAX_TEXT));
}
function numeric(value) {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'string' ? value.replace(/,/g, '') : value;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function select(row, keys) {
  const safe = {};
  for (const [field, type] of Object.entries(keys)) {
    if (type === 'string') safe[field] = clean(row[field], field.includes('poster') ? 1200 : 220);
    else if (type === 'numeric') safe[field] = numeric(row[field]);
    else if (type === 'boolean') safe[field] = row[field] === true || clean(row[field], 5).toLowerCase() === 'true';
  }
  return safe;
}
function requireRows(data, name) {
  const rows = data[name];
  if (!Array.isArray(rows)) throw new Error('OPS_INCOMPLETE_' + name.toUpperCase());
  if (rows.length > MAX_ROWS) throw new Error('OPS_ROWS_EXCEEDED_' + name.toUpperCase());
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('OPS_INVALID_ROW_' + name.toUpperCase());
  }
  return rows;
}
function project(snapshot, randomBytes = crypto.randomBytes) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.ok === false) {
    throw new Error('OPS_SOURCE_REJECTED');
  }
  const data = snapshot.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('OPS_SOURCE_MISSING');
  for (const name of REQUIRED) requireRows(data, name);
  if (data.visibility_locks !== undefined) requireRows(data, 'visibility_locks');

  // A per-response random HMAC key preserves duplicate-booking detection inside
  // this one response, without emitting real booking IDs or stable linkable hashes.
  const nonce = randomBytes(32);
  if (!Buffer.isBuffer(nonce) || nonce.length !== 32) throw new Error('OPS_NONCE_UNAVAILABLE');
  const opaqueId = value => {
    const raw = clean(value, 250);
    return raw ? crypto.createHmac('sha256', nonce).update(raw).digest('hex') : '';
  };

  const safe = {
    projection_version: VERSION,
    generated_at: clean(data.generated_at, 80),
    snapshot_source: clean(data.snapshot_source, 160),
    fallback_reader: clean(data.fallback_reader, 120),
    events: data.events.map(row => select(row, {
      event_id: 'string', event_name: 'string', event_date: 'string', venue: 'string',
      poster_url: 'string', status: 'string', active_on_web: 'boolean'
    })),
    web_ready: data.web_ready.map(row => select(row, {
      event_id: 'string', event_name: 'string', event_date: 'string', event_date_text: 'string',
      venue: 'string', poster_image_url: 'string', available_phone_count: 'numeric',
      available_lens_count: 'numeric', action_for_web: 'string'
    })),
    web_packages: data.web_packages.map(row => select(row, {
      package_id: 'string', event_id: 'string', package_type: 'string',
      price: 'numeric', available_count: 'numeric', package_status: 'string'
    })),
    bookings: data.bookings.map(row => ({
      event_id: clean(row.event_id, 220),
      booking_status: clean(row.booking_status, 80),
      booking_id: opaqueId(row.booking_id)
    }))
  };
  if (Array.isArray(data.visibility_locks)) {
    safe.visibility_locks = data.visibility_locks.map(row => select(row, {
      event_id: 'string', lock_state: 'string'
    }));
  }
  return {ok: true, data: safe};
}

module.exports = {VERSION, project, _test: {clean, numeric, requireRows}};
