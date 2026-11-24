'use strict';

// Standalone, read-only GAS Web App for an OWNER-ONLY SYNTHETIC staging Sheet.
// Deploy only as a NEW container-bound project created from the staging workbook.
// NEVER paste into the canonical production apps-script/Code.gs project.
// No booking writer, no outbox mutation, no LINE calls and no doGet endpoint.
const KK_STAGING_PRIVATE_READER_VERSION_ = 'KK_STAGING_PRIVATE_READER_V1';
const KK_STAGING_SENTINEL_ = 'KK LINE SYNTHETIC STAGING — NOT CANONICAL';
const KK_STAGING_README_ = '_STAGING_README';

const KK_STAGING_PRIVATE_ALLOWLIST_ = Object.freeze({
  '08_Web_Ready': Object.freeze({
    range: 'A4:K',
    columns: 11,
    headers: ['event_id','event_name','event_date_text','venue','poster_image_url',
      'event_note','available_phone_count','available_lens_count','booking_status_for_web',
      'action_for_web','line_message_template']
  }),
  '09_Web_Packages': Object.freeze({
    range: 'A4:N',
    columns: 14,
    headers: ['package_id','event_id','package_type','model_group','model_display',
      'lens_group','lens_display','price','available_count','package_status','sort_order',
      'web_note','raw_available_count','use_case']
  })
});

function kkStagingJson_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function kkStagingIsValidKey_(supplied, props) {
  const configured = String(props.getProperty('KK_CORE_PRIVATE_READ_KEY') || '');
  const admin = String(props.getProperty('KK_ADMIN_API_KEY') || '');
  if (!/^[A-Za-z0-9_-]{32,}$/.test(configured) ||
      configured !== configured.trim() ||
      configured === admin || typeof supplied !== 'string') return false;
  // No shortcut on the first mismatching character.
  let difference = configured.length ^ supplied.length;
  for (let i = 0; i < configured.length; i++)
    difference |= configured.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  return difference === 0;
}

// The active parent is available in the bound script EDITOR, not in a
// deployed Web App. The owner must attest the bound Sheet once while disabled.
// Script properties are owner-controlled configuration, not caller evidence.
// See https://developers.google.com/apps-script/guides/bound#special_methods
function kkStagingExpectedId_(props) {
  const id = String(props.getProperty('KK_STAGING_SHEET_ID') || '').trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(id)) throw new Error('STAGING_ID_INVALID');
  return id;
}

function kkStagingScriptId_() {
  const id = String(ScriptApp.getScriptId() || '').trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(id)) throw new Error('STAGING_SCRIPT_ID_INVALID');
  return id;
}

function kkStagingAssertPrivateWorkbook_(workbook, expectedId) {
  if (!workbook || workbook.getId() !== expectedId)
    throw new Error('STAGING_WRONG_WORKBOOK');
  const file = DriveApp.getFileById(expectedId);
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      file.getViewers().length > 0 || file.getEditors().length > 0)
    throw new Error('STAGING_ACL_NOT_OWNER_ONLY');
  const readme = workbook.getSheetByName(KK_STAGING_README_);
  if (!readme ||
      readme.getRange('A1').getDisplayValue() !== KK_STAGING_SENTINEL_ ||
      readme.getRange('B2').getDisplayValue() !==
        'OWNER-PRIVATE SANDBOX; NO PRODUCTION CONNECTIVITY')
    throw new Error('STAGING_SENTINEL_MISSING');
}

// Run explicitly in the NEW container-bound staging editor, while disabled.
// Only records the owner-verified binding in this script's own properties.
// There is no HTTP route to call this function and no Sheet mutation.
function kkStagingBindFromEditor() {
  const props = PropertiesService.getScriptProperties();
  if (String(props.getProperty('KK_STAGING_PRIVATE_READ_ENABLED') || '') !== '0')
    throw new Error('STAGING_BIND_REQUIRES_DISABLED');
  const expectedId = kkStagingExpectedId_(props);
  const scriptId = kkStagingScriptId_();
  kkStagingAssertPrivateWorkbook_(SpreadsheetApp.getActiveSpreadsheet(), expectedId);
  const binding = scriptId + ':' + expectedId;
  const existing = String(props.getProperty('KK_STAGING_VERIFIED_BINDING') || '');
  if (existing && existing !== binding) throw new Error('STAGING_BINDING_CONFLICT');
  props.setProperty('KK_STAGING_VERIFIED_BINDING', binding);
  return {ok:true,version:KK_STAGING_PRIVATE_READER_VERSION_,binding_verified:true};
}

function kkStagingOpenPrivateWorkbook_(props, requestedId) {
  if (String(props.getProperty('KK_STAGING_PRIVATE_READ_ENABLED') || '') !== '1')
    throw new Error('STAGING_DISABLED');
  const expectedId = kkStagingExpectedId_(props);
  if (requestedId !== expectedId ||
      props.getProperty('KK_STAGING_VERIFIED_BINDING') !==
        kkStagingScriptId_() + ':' + expectedId)
    throw new Error('STAGING_BINDING_REQUIRED');

  // In a /exec request there is no active spreadsheet. Open only the pinned
  // owner-attested ID, never a caller-selected workbook. Recheck ACL and
  // sentinel on every read, including after revocation or fixture changes.
  const workbook = SpreadsheetApp.openById(expectedId);
  kkStagingAssertPrivateWorkbook_(workbook, expectedId);
  return workbook;
}

// Synthetic-only invariant. An accidental paste of real Core rows into an
// otherwise private staging file must NEVER become an unauthenticated feed.
function kkStagingAssertSyntheticRows_(sheet, values) {
  const eventId = /^EVT-[0-9]{8}-SYNTHETIC-[A-Za-z0-9_-]{1,80}$/;
  const packageId = /^PKG-STAGING-[A-Za-z0-9_-]{1,80}$/;
  // This is a frozen, PUBLIC-SAFE artificial dataset, not a generic PII reader.
  // Synthetic IDs alone are insufficient: a real name/contact could be pasted
  // into the note/template columns without changing the ID. All free-text
  // values MUST equal the explicitly fabricated fixture contract.
  const eventFixtures = {
    'EVT-20261218-SYNTHETIC-01': ['STAGING MOCK EVENT ALPHA', '18/12/2026', 'show'],
    'EVT-20261219-SYNTHETIC-02': ['STAGING MOCK EVENT BETA', '19/12/2026', 'hide']
  };
  const packageFixtures = {
    'PKG-STAGING-01': ['VIVO_X300_PRO', 'phone_only', 'NONE', 'vivo X300 Pro', ''],
    'PKG-STAGING-02': ['VIVO_X300_PRO', 'phone_lens_bundle', 'ZEISS_2_35X', 'vivo X300 Pro', '200 mm'],
    'PKG-STAGING-03': ['VIVO_X500_PRO_MAX', 'phone_only', 'NONE', 'vivo X500 Pro Max', ''],
    'PKG-STAGING-04': ['VIVO_X500_PRO_MAX', 'phone_lens_bundle', 'ZEISS_2_35X', 'vivo X500 Pro Max', '200 mm'],
    'PKG-STAGING-05': ['VIVO_X500_PRO_MAX', 'phone_lens_bundle', 'ZEISS_400MM', 'vivo X500 Pro Max', '400 mm']
  };
  function boundedStock(value) {
    return /^(0|[1-9]|10)$/.test(value);
  }
  const observed = Object.create(null);
  let accepted = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function(cell) { return !cell.trim(); })) continue;
    const identity = String(row[0] || '');
    if (!identity || observed[identity]) throw new Error('STAGING_DUPLICATE_OR_EMPTY_ID');
    observed[identity] = true;
    if (sheet === '08_Web_Ready') {
      const expected = eventFixtures[identity];
      if (!eventId.test(identity) || !expected ||
          row[1] !== expected[0] || row[2] !== expected[1] ||
          row[3] !== 'SANDBOX TEST HALL' || row[4] !== '' ||
          row[5] !== 'SYNTHETIC ONLY — NOT REAL' ||
          !boundedStock(row[6]) || !boundedStock(row[7]) ||
          !['เปิดจอง','เต็ม'].includes(row[8]) ||
          row[9] !== expected[2] || row[10] !== 'SYNTHETIC — DO NOT SEND')
        throw new Error('STAGING_EVENT_CONTENT_NOT_SYNTHETIC');
    } else {
      const expected = packageFixtures[identity];
      if (!packageId.test(identity) || !expected ||
          row[1] !== 'EVT-20261218-SYNTHETIC-01' ||
          row[2] !== expected[1] || row[3] !== expected[0] ||
          row[4] !== expected[3] || row[5] !== expected[2] ||
          row[6] !== expected[4] ||
          !/^(0|[1-9][0-9]{0,3})$/.test(row[7]) ||
          !boundedStock(row[8]) ||
          !['available','full','hidden'].includes(row[9]) ||
          row[10] !== identity.slice(-2).replace(/^0/, '') ||
          row[11] !== 'SYNTHETIC PRICES — NOT LIVE' ||
          !boundedStock(row[12]) || row[13] !== 'TEST ONLY')
        throw new Error('STAGING_PACKAGE_CONTENT_NOT_SYNTHETIC');
    }
    accepted++;
  }
  if (accepted === 0) throw new Error('STAGING_NO_SYNTHETIC_ROWS');
}

function kkStagingRead_(payload, props) {
  if (!payload || payload.action !== 'privateCoreRead' ||
      !kkStagingIsValidKey_(payload.readKey, props))
    throw new Error('STAGING_AUTH_DENIED');

  const workbook = kkStagingOpenPrivateWorkbook_(props, payload.coreSheetId);
  if (payload.coreSheetId !== workbook.getId())
    throw new Error('STAGING_SOURCE_MISMATCH');
  const schema = Object.prototype.hasOwnProperty.call(
    KK_STAGING_PRIVATE_ALLOWLIST_, payload.sheet)
      ? KK_STAGING_PRIVATE_ALLOWLIST_[payload.sheet] : null;
  if (!schema || payload.range !== schema.range)
    throw new Error('STAGING_RANGE_DENIED');

  const source = workbook.getSheetByName(payload.sheet);
  if (!source) throw new Error('STAGING_TAB_MISSING');
  const last = source.getLastRow();
  if (!Number.isSafeInteger(last) || last < 5 || last > 250)
    throw new Error('STAGING_ROW_LIMIT');

  const lastColumn = schema.range === 'A4:K' ? 'K' : 'N';
  const values = source.getRange('A4:' + lastColumn + last).getDisplayValues();
  if (!Array.isArray(values) || values.length !== last - 3 ||
      values.some(row => !Array.isArray(row) || row.length !== schema.columns ||
        row.some(value => typeof value !== 'string')))
    throw new Error('STAGING_VALUES_INVALID');
  const actualHeaders = values[0].map(value => value.trim().toLowerCase());
  if (JSON.stringify(actualHeaders) !== JSON.stringify(schema.headers))
    throw new Error('STAGING_HEADER_MISMATCH');
  kkStagingAssertSyntheticRows_(payload.sheet, values);

  return {ok:true,data:{spreadsheet_id:workbook.getId(),sheet:payload.sheet,
    range:payload.range,values:values}};
}

function doPost(event) {
  try {
    const raw = event && event.postData &&
      typeof event.postData.contents === 'string' ? event.postData.contents : '';
    if (!raw || raw.length > 2048) throw new Error('STAGING_REQUEST_INVALID');
    const payload = JSON.parse(raw);
    const props = PropertiesService.getScriptProperties();
    return kkStagingJson_(kkStagingRead_(payload, props));
  } catch (_) {
    // Never echo credentials, workbook IDs, payloads, caller names or stack traces.
    return kkStagingJson_({ok:false,error_code:'STAGING_PRIVATE_READ_DENIED'});
  }
}
