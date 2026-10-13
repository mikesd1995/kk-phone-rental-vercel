/**
 * KK Phone Rental Backend v16.7.0_CRM_PRO_PHASE3_6_17_OVERRIDE_SAVE_ISOLATION_FIX
 * Phase 1 recovery-stable baseline + audited booking/override guards + dynamic range optimization
 * Keep in sync with backend sheets: Dashboard K31:K42, Web Packages A4:N, use_case_override in 04_Event_Overrides!G.
 */
const KK_ADMIN_VERSION = 'v16.7.0_CRM_PRO_PHASE3_9_5_13_FULL_BACKEND_AUDIT';
const KK_PHASE1_DIRECT_FALLBACK_DISABLED = false;

const KK = {
  dashboard: '00_Admin_Dashboard',
  events: '01_Events',
  assets: '02_Assets',
  packages: '03_Packages',
  overrides: '04_Event_Overrides',
  accessories: '06_Accessory_Stock',
  webReady: '08_Web_Ready',
  webPackages: '09_Web_Packages',
  bookings: '00_Master_Booking',
  health: '10_Admin_Health_Check',
  modelMaster: 'Model_Master',
  customerStats: '11_Customer_Stats',
  bookingArchive: '12_Booking_Archive',
  eventArchive: '13_Event_Archive',
  overrideArchive: '14_Event_Override_Archive',
  adminAuditLog: '15_Admin_Audit_Log',
  adminErrorLog: '16_Admin_Error_Log',
  visibilityLocks: '18_Event_Visibility_Locks'
};

const KK_NAMED_RANGES = [
  { name: 'KK_EVENT_CREATE_INPUTS', sheet: KK.dashboard, a1: 'B6:B13' },
  { name: 'KK_EVENT_CREATED_ID', sheet: KK.dashboard, a1: 'B13' },
  { name: 'KK_EVENT_PACKAGE_ROWS', sheet: KK.dashboard, a1: 'A17:I46' },
  { name: 'KK_ADD_ASSET_INPUTS', sheet: KK.dashboard, a1: 'K6:K11' },
  { name: 'KK_ACCESSORY_INPUT_ROWS', sheet: KK.dashboard, a1: 'J16:N26' },
  { name: 'KK_QUICK_BOOKING_INPUTS', sheet: KK.dashboard, a1: 'K31:K42' },
  { name: 'KK_QUICK_BOOKING_ASSIGNED_ASSETS', sheet: KK.dashboard, a1: 'K38:K39' }
];

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('KK Admin')
      .addItem('Setup/Repair Named Ranges', 'kkSetupNamedRanges')
      .addItem('Phase 1: Create/Repair Log Sheets', 'kkEnsurePhase1Sheets')
      .addItem('Phase 1: Show Version Health', 'kkShowPhase1Health')
      .addSeparator()
      .addItem('1) Create Event from Dashboard', 'kkCreateEventFromDashboard')
      .addItem('2) Add Assets from Dashboard', 'kkAddAssetsFromDashboard')
      .addItem('3) Update Accessory Stock', 'kkUpdateAccessoryStockFromDashboard')
      .addItem('4) Add Quick Booking', 'kkAddQuickBookingFromDashboard')
      .addSeparator()
      .addItem('Convert Event Drive Image URLs', 'kkConvertEventDriveUrls')
      .addItem('Repair Lens Stock (ZEISS/G1 only)', 'kkRepairLensCompatibilityPatch')
      .addItem('Run Basic Health Check', 'kkRunBasicHealthCheck')
      .addSeparator()
      .addItem('CRM: Generate Admin API Key', 'kkGenerateAdminApiKey')
      .addItem('CRM: Set Poster Folder ID', 'kkSetPosterFolderId')
      .addItem('CRM: Authorize Drive Access', 'kkAuthorizeDriveAccess')
      .addItem('CRM: Show Setup Info', 'kkShowAdminCrmSetupInfo')
      .addSeparator()
      .addItem('CRM: Run 30-day Archive Cleanup', 'kkCleanupOldData30Days')
      .addItem('CRM: Install Daily Cleanup Trigger', 'kkInstallDailyCleanupTrigger')
      .addToUi();
  } catch (err) {
    Logger.log('onOpen skipped because Spreadsheet UI is not available in this context: ' + (err && err.message ? err.message : err));
  }
}

function kkSafeAlert_(message) {
  const text = String(message || '');
  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (err) {
    Logger.log(text);
  }
}

function kkSafeStringify_(value, maxLen) {
  const limit = maxLen || 1500;
  try {
    const clean = JSON.parse(JSON.stringify(value || {}, function(key, val) {
      if (key === 'apiKey') return '[redacted]';
      if (key === 'base64') return '[base64 omitted]';
      if (typeof val === 'string' && val.length > 300) return val.slice(0, 300) + '…';
      return val;
    }));
    const text = JSON.stringify(clean);
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  } catch (err) {
    return String(value || '').slice(0, limit);
  }
}

function kkEnsurePhase1Sheets() {
  kkEnsureCrmArchiveSheets_();
  kkEnsureAdminLogSheets_();
  kkSafeAlert_('Phase 1 sheets are ready:\n- ' + KK.adminAuditLog + '\n- ' + KK.adminErrorLog);
}

function kkEnsureAdminLogSheets_() {
  kkEnsureSheetWithHeaders_(KK.adminAuditLog, [
    'timestamp','version','action','status','duration_ms','summary','event_id','booking_id','row_number','admin_source'
  ]);
  kkEnsureSheetWithHeaders_(KK.adminErrorLog, [
    'timestamp','version','action','error_message','duration_ms','payload_summary','stack','admin_source'
  ]);
  kkEnsureSheetWithHeaders_(KK.visibilityLocks, [
    'lock_id','event_id','event_name','event_date','venue','identity_key','lock_state','lock_reason',
    'first_locked_at','last_changed_at','changed_by','explicit_reopen_required','source_evidence','notes'
  ]);
  return true;
}

// PERFORMANCE FIX: O(1) Append instead of slow appendRow()
function kkAppendRowSafe_(sheetName, row) {
  try {
    kkEnsureAdminLogSheets_();
    const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
    const targetRow = Math.max(sh.getLastRow() + 1, 2);
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } catch (logErr) {
    Logger.log('Could not write to ' + sheetName + ': ' + (logErr && logErr.message ? logErr.message : logErr));
  }
}

function kkAuditLog_(action, payload, result, startedAt) {
  const duration = startedAt ? (Date.now() - startedAt) : '';
  kkAppendRowSafe_(KK.adminAuditLog, [
    new Date(),
    KK_ADMIN_VERSION,
    action || '',
    'OK',
    duration,
    kkSafeStringify_(result, 800),
    result && result.event_id ? result.event_id : (payload && payload.event_id ? payload.event_id : ''),
    result && result.booking_id ? result.booking_id : '',
    result && result.row_number ? result.row_number : '',
    payload && payload.proxyVersion ? payload.proxyVersion : ''
  ]);
}

function kkErrorLog_(action, payload, err, startedAt) {
  const duration = startedAt ? (Date.now() - startedAt) : '';
  kkAppendRowSafe_(KK.adminErrorLog, [
    new Date(),
    KK_ADMIN_VERSION,
    action || '',
    err && err.message ? err.message : String(err),
    duration,
    kkSafeStringify_(payload, 1000),
    err && err.stack ? String(err.stack).slice(0, 1500) : '',
    payload && payload.proxyVersion ? payload.proxyVersion : ''
  ]);
}

function kkSheetExists_(name) {
  return !!SpreadsheetApp.getActive().getSheetByName(name);
}

function kkProjectAuthorityDiagnostics_() {
  const timezone = String(Session.getScriptTimeZone() || '').trim();
  const triggers = ScriptApp.getProjectTriggers().map(function(trigger) {
    return {
      handler_function: String(trigger.getHandlerFunction() || ''),
      event_type: String(trigger.getEventType() || ''),
      trigger_source: String(trigger.getTriggerSource() || '')
    };
  });
  const cleanup = triggers.filter(function(trigger) {
    return trigger.handler_function === 'kkCleanupOldData30DaysAuto';
  });
  return {
    project_timezone: timezone,
    installed_trigger_count: triggers.length,
    installed_triggers: triggers,
    cleanup_trigger_present: cleanup.length > 0,
    cleanup_trigger_count: cleanup.length,
    cleanup_trigger_handler: 'kkCleanupOldData30DaysAuto',
    cleanup_trigger_schedule: 'UNVERIFIED_BY_TRIGGER_API'
  };
}

function kkPhase1Diagnostics_(payload) {
  const props = PropertiesService.getScriptProperties();
  const frontendSheetId = payload && payload.frontendSheetId ? String(payload.frontendSheetId).trim() : '';
  const spreadsheetId = SpreadsheetApp.getActive().getId();
  const authority = kkProjectAuthorityDiagnostics_();
  return {
    admin_api_version: KK_ADMIN_VERSION,
    spreadsheet_id: spreadsheetId,
    frontend_sheet_id: frontendSheetId,
    frontend_backend_same_sheet: !!frontendSheetId && frontendSheetId === spreadsheetId,
    admin_api_key_set: !!String(props.getProperty('KK_ADMIN_API_KEY') || '').trim(),
    poster_folder_id_set: !!String(props.getProperty('KK_POSTER_FOLDER_ID') || '').trim(),
    audit_log_sheet_exists: kkSheetExists_(KK.adminAuditLog),
    error_log_sheet_exists: kkSheetExists_(KK.adminErrorLog),
    log_sheets_ready: kkSheetExists_(KK.adminAuditLog) && kkSheetExists_(KK.adminErrorLog),
    direct_fallback_disabled: KK_PHASE1_DIRECT_FALLBACK_DISABLED,
    project_timezone: authority.project_timezone,
    installed_trigger_count: authority.installed_trigger_count,
    installed_triggers: authority.installed_triggers,
    cleanup_trigger_present: authority.cleanup_trigger_present,
    cleanup_trigger_count: authority.cleanup_trigger_count,
    cleanup_trigger_handler: authority.cleanup_trigger_handler,
    cleanup_trigger_schedule: authority.cleanup_trigger_schedule,
    generated_at: kkApiDateTime_(new Date())
  };
}

function kkShowPhase1Health() {
  kkEnsureAdminLogSheets_();
  const d = kkPhase1Diagnostics_({});
  kkSafeAlert_(
    'KK Phone Rental Phase 1 Health\n\n' +
    'Version: ' + d.admin_api_version + '\n' +
    'Spreadsheet ID: ' + d.spreadsheet_id + '\n' +
    'API key set: ' + d.admin_api_key_set + '\n' +
    'Poster folder set: ' + d.poster_folder_id_set + '\n' +
    'Audit log exists: ' + d.audit_log_sheet_exists + '\n' +
    'Error log exists: ' + d.error_log_sheet_exists + '\n' +
    'Project timezone: ' + d.project_timezone + '\n' +
    'Installed triggers: ' + d.installed_trigger_count + '\n' +
    'Cleanup trigger present: ' + d.cleanup_trigger_present
  );
}

function kkSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name);
  return sh;
}

// PERFORMANCE FIX: Helpers for Dynamic Ranging
function kkGetDynamicRange_(sheetName, startRow, startCol, numCols) {
  const sh = kkSheet_(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < startRow) return null;
  return sh.getRange(startRow, startCol, lastRow - startRow + 1, numCols);
}

function kkGetValues_(sheetName, startRow, startCol, numCols) {
  // Read only through the last row containing visible data in the first few
  // requested columns. Formula-driven sheets can have formulas copied thousands
  // of rows downward; Sheet.getLastRow() then reports those rows even when the
  // formulas display "". Scanning up to three leading columns also avoids
  // dropping a newly written row while its generated ID cell is still blank.
  const sh = kkSheet_(sheetName);
  const physicalLastRow = sh.getLastRow();
  if (physicalLastRow < startRow) return [];

  const scanCount = physicalLastRow - startRow + 1;
  const scanCols = Math.min(Math.max(Number(numCols || 1), 1), 3);
  const keyValues = sh.getRange(startRow, startCol, scanCount, scanCols).getDisplayValues();
  let lastDataOffset = -1;
  for (let i = keyValues.length - 1; i >= 0; i--) {
    const hasVisibleData = keyValues[i].some(value => String(value || '').trim() !== '');
    if (hasVisibleData) {
      lastDataOffset = i;
      break;
    }
  }
  if (lastDataOffset < 0) return [];
  return sh.getRange(startRow, startCol, lastDataOffset + 1, numCols).getValues();
}

function kkSetupNamedRanges() {
  const ss = SpreadsheetApp.getActive();
  KK_NAMED_RANGES.forEach(cfg => {
    ss.getNamedRanges()
      .filter(nr => nr.getName() === cfg.name)
      .forEach(nr => nr.remove());
    ss.setNamedRange(cfg.name, kkSheet_(cfg.sheet).getRange(cfg.a1));
  });
  kkEnsureCrmArchiveSheets_();
  kkEnsureAdminLogSheets_();
  kkSafeAlert_('Named ranges have been created/repaired: ' + KK_NAMED_RANGES.length + '\nArchive/customer/log sheets checked.');
}

function kkRange_(name, sheetName, fallbackA1) {
  const ss = SpreadsheetApp.getActive();
  const named = ss.getRangeByName(name);
  if (named) return named;
  return kkSheet_(sheetName).getRange(fallbackA1);
}

function kkBlank_(value) {
  return value === '' || value === null || typeof value === 'undefined';
}

function kkRowBlank_(row) {
  return row.every(kkBlank_);
}

// PERFORMANCE FIX: Optimized Empty Rows Scanner (No O(MaxRows) scanning)
function kkEmptyRows_(sheetName, keyCol, startRow, writeStartCol, writeColCount, needed) {
  const sh = kkSheet_(sheetName);
  const last = Math.max(sh.getLastRow(), startRow - 1);
  const rows = [];
  const neededRows = Math.max(Number(needed || 1), 1);

  if (last >= startRow) {
    const scanRows = last - startRow + 1;
    const keyValues = sh.getRange(startRow, keyCol, scanRows, 1).getValues();
    const guardValues = sh.getRange(startRow, writeStartCol, scanRows, writeColCount).getValues();
    for (let i = 0; i < scanRows && rows.length < neededRows; i++) {
      if (kkBlank_(keyValues[i][0]) && kkRowBlank_(guardValues[i])) rows.push(startRow + i);
    }
  }

  let next = Math.max(last + 1, startRow);
  const missing = neededRows - rows.length;
  if (missing > 0) {
    const maxRows = sh.getMaxRows();
    const requiredLastRow = next + missing - 1;
    if (requiredLastRow > maxRows) {
      sh.insertRowsAfter(maxRows, requiredLastRow - maxRows);
    }
    for (let i = 0; i < missing; i++) rows.push(next + i);
  }
  return rows;
}

function kkFirstEmptyRow_(sheetName, keyCol, startRow, writeStartCol, writeColCount) {
  return kkEmptyRows_(sheetName, keyCol, startRow, writeStartCol || keyCol, writeColCount || 1, 1)[0];
}

function kkSlug_(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 28) || 'EVENT';
}

function kkDateObj_(value) {
  if (value instanceof Date) return value;
  const raw = String(value == null ? '' : value).trim();
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const d = dmy
    ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    : new Date(value);
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + value);
  return d;
}

function kkDateKey_(dateValue) {
  return Utilities.formatDate(kkDateObj_(dateValue), Session.getScriptTimeZone(), 'yyyyMMdd');
}

function kkSameDate_(a, b) {
  if (!a || !b) return false;
  return kkDateKey_(a) === kkDateKey_(b);
}

function kkNormalizeVisibilityText_(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.,/\\()[\]{}:;'"\`<>“”‘’]+/g, '');
}

function kkVisibilityIdentityKey_(eventName, eventDate, venue) {
  const name = kkNormalizeVisibilityText_(eventName);
  const date = eventDate ? Utilities.formatDate(kkDateObj_(eventDate), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
  const place = kkNormalizeVisibilityText_(venue);
  return name && date ? [name, date, place].join('|') : '';
}

function kkVisibilityLockRows_() {
  if (!kkSheetExists_(KK.visibilityLocks)) return [];
  return kkGetValues_(KK.visibilityLocks, 2, 1, 14);
}

function kkVisibilityLockObject_(row, rowNumber) {
  const r = row || [];
  return {
    row_number: Number(rowNumber || 0),
    lock_id: String(r[0] || '').trim(),
    event_id: String(r[1] || '').trim(),
    event_name: String(r[2] || '').trim(),
    event_date: r[3] || '',
    venue: String(r[4] || '').trim(),
    identity_key: String(r[5] || '').trim(),
    lock_state: String(r[6] || '').trim().toUpperCase(),
    lock_reason: String(r[7] || '').trim(),
    first_locked_at: r[8] || '',
    last_changed_at: r[9] || '',
    changed_by: String(r[10] || '').trim(),
    explicit_reopen_required: kkIsTrue_(r[11]),
    source_evidence: String(r[12] || '').trim(),
    notes: String(r[13] || '').trim()
  };
}

function kkFindVisibilityHistory_(eventId, eventName, eventDate, venue) {
  const eid = String(eventId || '').trim();
  const identity = kkVisibilityIdentityKey_(eventName, eventDate, venue);
  const rows = kkVisibilityLockRows_();
  let identityFallback = null;
  for (let i = 0; i < rows.length; i++) {
    const obj = kkVisibilityLockObject_(rows[i], i + 2);
    if (eid && obj.event_id === eid) return obj;
    const rowIdentity = obj.identity_key || kkVisibilityIdentityKey_(obj.event_name, obj.event_date, obj.venue);
    if (identity && rowIdentity === identity && !identityFallback) identityFallback = obj;
  }
  return identityFallback;
}

function kkAssertCreateEventHistoryAllowed_(eventName, eventDate, venue) {
  const history = kkFindVisibilityHistory_('', eventName, eventDate, venue);
  if (!history) return true;
  if (history.lock_state === 'LOCKED') {
    throw new Error('EVENT_VISIBILITY_TOMBSTONE_LOCKED: owner-hidden historical event cannot be recreated automatically');
  }
  throw new Error('EVENT_HISTORY_RECREATE_PROHIBITED: historical Core event must be reconciled instead of recreated');
}

function kkUpsertVisibilityLock_(eventId, eventName, eventDate, venue, state, payload) {
  kkEnsureAdminLogSheets_();
  const wantedState = String(state || '').trim().toUpperCase();
  if (!['LOCKED','REOPENED','SEEN_CORE'].includes(wantedState)) throw new Error('Invalid visibility lock state: ' + wantedState);
  const existing = kkFindVisibilityHistory_(eventId, eventName, eventDate, venue);
  const sh = kkSheet_(KK.visibilityLocks);
  const now = new Date();
  const row = existing && existing.row_number ? existing.row_number : kkFirstEmptyRow_(KK.visibilityLocks, 1, 2, 1, 14);
  const input = payload || {};
  const reason = String(input.visibility_lock_reason || (existing && existing.lock_reason) || (wantedState === 'LOCKED' ? 'OWNER_HIDE_VIA_ADMIN' : 'HISTORICAL_OWNER_HIDE')).trim();
  const firstLockedAt = existing && existing.first_locked_at ? existing.first_locked_at : (wantedState === 'LOCKED' ? now : '');
  const changedBy = String(input.visibility_changed_by || (wantedState === 'REOPENED' ? 'OWNER_EXPLICIT_REOPEN' : (wantedState === 'LOCKED' ? 'OWNER_EXPLICIT_HIDE' : 'SYSTEM_HISTORY_BACKFILL'))).trim();
  const sourceEvidence = String(input.visibility_source_evidence || input.request_id || (existing && existing.source_evidence) || '').trim();
  const note = wantedState === 'LOCKED'
    ? 'Persistent owner tombstone; storefront formulas fail closed even if Core visibility is overwritten.'
    : (wantedState === 'REOPENED'
      ? 'Historical owner tombstone explicitly reopened; history retained to prevent silent recreation.'
      : 'Historical Core identity retained to prevent automatic recreation after row removal.');
  sh.getRange(row, 1, 1, 14).setValues([[
    (existing && existing.lock_id) || ('LOCK|' + String(eventId || '').trim()),
    String(eventId || '').trim(),
    String(eventName || '').trim(),
    kkDateObj_(eventDate),
    String(venue || '').trim(),
    kkVisibilityIdentityKey_(eventName, eventDate, venue),
    wantedState,
    reason,
    firstLockedAt,
    now,
    changedBy,
    wantedState === 'LOCKED',
    sourceEvidence,
    note
  ]]);
  return { row_number: row, lock_state: wantedState };
}

function kkGenerateUniqueEventId_(eventName, eventDate) {
  const base = `EVT-${kkDateKey_(eventDate)}-${kkSlug_(eventName)}`;
  const events = kkGetValues_(KK.events, 5, 1, 1).flat().filter(String);
  if (!events.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const id = `${base}-${i}`;
    if (!events.includes(id)) return id;
  }
  throw new Error('Cannot generate unique event_id');
}

function kkExtractDriveFileId_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{15,})/,
    /[?&]id=([a-zA-Z0-9_-]{15,})/,
    /\/thumbnail\?id=([a-zA-Z0-9_-]{15,})/,
    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,
    /lh[3-6]\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,
    /uc\?export=(?:view|download)&id=([a-zA-Z0-9_-]{15,})/
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return m[1];
  }
  if (!/^https?:\/\//i.test(s) && /^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return '';
}

function kkDrivePermissionApiSetAnyone_(fileId) {
  const id = String(fileId || '').trim();
  if (!id) throw new Error('Missing Drive file ID');
  const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
    '/permissions?supportsAllDrives=true&sendNotificationEmail=false';
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ role: 'reader', type: 'anyone' }),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if ((code >= 200 && code < 300) || code === 409) return { ok: true, status: code, method: 'Drive API' };
  const body = String(resp.getContentText() || '').slice(0, 500);
  throw new Error('Drive API HTTP ' + code + (body ? ': ' + body : ''));
}

function kkEnsureDriveFilePublic_(fileId, options) {
  const id = String(fileId || '').trim();
  if (!id) return { file_id: '', view_url: '', public_checked: false, sharing_warning: '' };
  const errors = [];
  let viewUrl = '';

  try {
    const file = DriveApp.getFileById(id);
    viewUrl = file.getUrl();
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return {
        file_id: id,
        view_url: viewUrl,
        public_checked: true,
        sharing_warning: ''
      };
    } catch (shareErr) {
      errors.push('DriveApp.setSharing: ' + (shareErr && shareErr.message ? shareErr.message : String(shareErr)));
    }
  } catch (fileErr) {
    errors.push('DriveApp.getFileById: ' + (fileErr && fileErr.message ? fileErr.message : String(fileErr)));
  }

  try {
    kkDrivePermissionApiSetAnyone_(id);
    if (!viewUrl) {
      try { viewUrl = DriveApp.getFileById(id).getUrl(); } catch (ignore) {}
    }
    return {
      file_id: id,
      view_url: viewUrl,
      public_checked: true,
      sharing_warning: ''
    };
  } catch (apiErr) {
    errors.push('Drive API permissions.create: ' + (apiErr && apiErr.message ? apiErr.message : String(apiErr)));
  }

  return {
    file_id: id,
    view_url: viewUrl,
    public_checked: false,
    sharing_warning: 'Poster URL was saved, but Apps Script could not change Drive sharing automatically. Details: ' + errors.join(' | ')
  };
}

function kkNormalizePoster_(url, options) {
  const opts = options || {};
  const s = String(url || '').trim();
  if (!s) return { url: '', drive_file_id: '', view_url: '', public_checked: false };
  if (/drive\.google\.com\/(drive\/u\/\d+\/)?folders\//i.test(s) || /drive\.google\.com\/drive\/folders\//i.test(s)) {
    throw new Error('Poster URL must be a Google Drive FILE link, not a folder link.');
  }

  const id = kkExtractDriveFileId_(s);
  if (id) {
    const publicInfo = opts.ensurePublic ? kkEnsureDriveFilePublic_(id, { strict: opts.strictPublic === true }) : { file_id: id, view_url: '', public_checked: false, sharing_warning: '' };
    return {
      url: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200',
      drive_file_id: id,
      view_url: publicInfo.view_url || '',
      public_checked: !!publicInfo.public_checked,
      sharing_warning: publicInfo.sharing_warning || ''
    };
  }

  if (/drive\.google\.com/i.test(s)) {
    throw new Error('Cannot read Google Drive file ID from Poster URL.');
  }

  if (!/^https?:\/\//i.test(s)) {
    throw new Error('Poster URL must be a Google Drive file link, Drive file ID, or direct http(s) image URL.');
  }

  return { url: s, drive_file_id: '', view_url: s, public_checked: false };
}

function kkDriveThumbnail_(url) {
  return kkNormalizePoster_(url, { ensurePublic: false }).url;
}

function kkPosterForWrite_(url, options) {
  const opts = options || {};
  return kkNormalizePoster_(url, { ensurePublic: true, strictPublic: opts.strictPublic === true });
}

function kkExtractDriveFolderId_(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const folderMatch = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return s.replace(/[^a-zA-Z0-9_-]/g, '');
}

function kkIsTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1' || String(v).toLowerCase() === 'yes';
}

function kkActiveHold_(status) {
  return ['pending', 'confirmed', 'prepared', 'picked_up'].includes(String(status || '').toLowerCase());
}

function kkAssetIsRentableAvailable_(statusValue, rentableValue) {
  const status = String(statusValue || '').toLowerCase().trim();
  const rentableBlank = kkBlank_(rentableValue);
  const rentable = rentableBlank ? status === 'available' : kkIsTrue_(rentableValue);
  return status === 'available' && rentable;
}

// Phase 3.6.10: G2 was removed from the production asset database.
// Keep only ZEISS_2_35X / G1 as compatible lens aliases for the public Vivo X300 Pro + Lens package.
// Do NOT recreate a G2 row in Model_Master and do NOT count deleted G2 assets in public stock.
const KK_LENS_COMPAT_PATCH_VERSION = 'v16.7.0_PHASE3_9_5_11_SAME_DAY_INVENTORY_20260928';
const KK_COMPATIBLE_ZEISS_LENS_GROUPS = ['ZEISS_2_35X', 'G1'];

function kkIsRetiredG2LensGroup_(modelGroup) {
  const normalized = String(modelGroup || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return normalized === 'G2';
}

function kkLensGroupAliases_(modelGroup) {
  const raw = String(modelGroup || '').trim();
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (['ZEISS235X', 'ZEISS235', 'ZEISS2350X', 'G1'].includes(normalized)) return KK_COMPATIBLE_ZEISS_LENS_GROUPS.slice();
  return raw ? [raw] : [];
}

function kkAssetModelMatches_(assetType, assetModelGroup, expectedModelGroup) {
  const type = String(assetType || '').toLowerCase().trim();
  const assetModel = String(assetModelGroup || '').trim();
  const expectedModel = String(expectedModelGroup || '').trim();
  if (!expectedModel || expectedModel === 'NONE') return true;
  if (type !== 'lens') return assetModel === expectedModel;
  return kkLensGroupAliases_(expectedModel).includes(assetModel);
}

function kkFormulaLensCriteria_(cellRef) {
  // Strict production stock policy: G2/G_2 is retired from public selling stock.
  // ZEISS_2_35X and G1 are counted together. G2 rows intentionally match nothing.
  return 'IF(REGEXMATCH(UPPER(REGEXREPLACE(' + cellRef + ',"[^A-Za-z0-9]","")),"^G2$"),"__RETIRED_G2_DO_NOT_COUNT__",IF(REGEXMATCH(UPPER(' + cellRef + '),"^(ZEISS_2_35X|G1)$"),{"ZEISS_2_35X","G1"},' + cellRef + '))';
}

function kkFormulaLensAssetCount_(rowNumber) {
  const f = 'F' + rowNumber;
  return `IF(REGEXMATCH(UPPER(REGEXREPLACE(${f},"[^A-Za-z0-9]","")),"^G2$"),0,SUM(COUNTIFS('02_Assets'!$B$5:$B$1000,"lens",'02_Assets'!$C$5:$C$1000,${kkFormulaLensCriteria_(f)},'02_Assets'!$E$5:$E$1000,"available",'02_Assets'!$G$5:$G$1000,TRUE)))`;
}

function kkFormulaActiveBookingCount_(eventIdExpr, packageRegex) {
  // Reserve stock by the date encoded in event_id (EVT-YYYYMMDD-...), not by raw
  // sheet date-cell equality. This makes same-day inventory collision-safe even when
  // one event row contains a native Date and another was imported as dd/mm/yyyy text.
  // Active holds are pending / confirmed / prepared / picked_up.
  const bookingDayKey = `MID('00_Master_Booking'!$D$5:$D$1000,5,8)`;
  const eventDayKey = `MID(${eventIdExpr},5,8)`;
  return `SUMPRODUCT(N(${bookingDayKey}=${eventDayKey}),N(REGEXMATCH(LOWER('00_Master_Booking'!$C$5:$C$1000),"^(pending|confirmed|prepared|picked_up)$")),N(REGEXMATCH(LOWER('00_Master_Booking'!$I$5:$I$1000),"^(${packageRegex})$")))`;
}

function kkFormulaLensBookedCount_(rowNumber) {
  const f = 'F' + rowNumber;
  const booked = kkFormulaActiveBookingCount_(`B${rowNumber}`, 'lens_only|phone_lens_bundle');
  return `IF(REGEXMATCH(UPPER(REGEXREPLACE(${f},"[^A-Za-z0-9]","")),"^G2$"),0,${booked})`;
}

function kkFormulaPhoneRawCount_(rowNumber) {
  const r = rowNumber;
  const booked = kkFormulaActiveBookingCount_(`B${r}`, 'phone_only|phone_lens_bundle');
  return `(COUNTIFS('02_Assets'!$B$5:$B$1000,"phone",'02_Assets'!$C$5:$C$1000,D${r},'02_Assets'!$E$5:$E$1000,"available",'02_Assets'!$G$5:$G$1000,TRUE)-${booked})`;
}

function kkFormulaWebPackageAvailable_(rowNumber, rawMode) {
  const r = rowNumber;
  const phoneRaw = kkFormulaPhoneRawCount_(r);
  const lensRaw = `(${kkFormulaLensAssetCount_(r)}-${kkFormulaLensBookedCount_(r)})`;
  if (rawMode) {
    return `=IF(B${r}="","",IF(C${r}="lens_only",${lensRaw},IF(C${r}="phone_lens_bundle",MIN(${phoneRaw},${lensRaw}),${phoneRaw})))`;
  }
  return `=IF(B${r}="","",IF(C${r}="lens_only",MAX(0,${lensRaw}),IF(C${r}="phone_lens_bundle",MIN(MAX(0,${phoneRaw}),MAX(0,${lensRaw})),MAX(0,${phoneRaw}))))`;
}


function kkWebPackageTemplateFormula_(rowNumber) {
  const r = rowNumber;
  // Phase 3.6.15 price sanity fix:
  // Do NOT infer template_id from row order. Row-order matching breaks as soon as old/hidden
  // packages, retired G2 rows, or regenerated public package rows exist. Use the actual
  // 09_Web_Packages!A package_id instead. Supported shapes:
  //   TPL-XXX
  //   EVT-YYYY-TPL-XXX
  //   EVT-YYYY-<template_id without TPL prefix>
  return `IF(A${r}="","",IFERROR(REGEXEXTRACT(A${r},"(TPL-.+)$"),IF(LEFT(A${r},LEN(B${r}&"-"))=B${r}&"-",RIGHT(A${r},LEN(A${r})-LEN(B${r}&"-")),A${r})))`;
}

function kkWebPackageStandardPriceFormula_(rowNumber) {
  const r = rowNumber;
  const tplExpr = kkWebPackageTemplateFormula_(r);
  return `IF(A${r}="","",IFERROR(VLOOKUP(${tplExpr},'03_Packages'!$A$5:$E$1000,5,FALSE),0))`;
}

function kkWebPackagePriceFormula_(rowNumber, templateId) {
  const r = rowNumber;
  const tplExpr = templateId
    ? `"${String(templateId || '').replace(/"/g, '""')}"`
    : kkWebPackageTemplateFormula_(r);
  const standardExpr = templateId
    ? `IFERROR(VLOOKUP(${tplExpr},'03_Packages'!$A$5:$E$1000,5,FALSE),0)`
    : kkWebPackageStandardPriceFormula_(r);
  // Use FILTER + COUNTIFS to read the latest matching override row. LOOKUP(2,1/(...)) returns #N/A in the live Sheet for valid matches.
  // 1) old SUMIFS formula ignored override price = 0 and could sum duplicate old rows;
  // 2) public 09_Web_Packages did not always recalculate after an override save.
  return `=IF(B${r}="","",IFERROR(INDEX(FILTER('04_Event_Overrides'!$C$5:$C$1000,'04_Event_Overrides'!$A$5:$A$1000=B${r},'04_Event_Overrides'!$B$5:$B$1000=${tplExpr},'04_Event_Overrides'!$C$5:$C$1000<>""),COUNTIFS('04_Event_Overrides'!$A$5:$A$1000,B${r},'04_Event_Overrides'!$B$5:$B$1000,${tplExpr},'04_Event_Overrides'!$C$5:$C$1000,"<>")),${standardExpr}))`;
}

function kkRepairWebPackagePriceFormulas_() {
  const web = kkSheet_(KK.webPackages);
  const startRow = 5;
  const endRow = 1000;
  const rowCount = endRow - startRow + 1;
  const formulas = [];
  for (let row = startRow; row <= endRow; row++) {
    formulas.push([kkWebPackagePriceFormula_(row, '')]);
  }
  web.getRange(startRow, 8, rowCount, 1).setFormulas(formulas); // 09_Web_Packages!H price
  return rowCount;
}

function kkPriceLensCanonical_(lensGroup) {
  const raw = String(lensGroup || '').trim();
  const norm = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (norm === 'ZEISS235X' || norm === 'ZEISS235' || norm === 'G1') return 'ZEISS_2_35X_G1';
  if (norm === 'G2') return '__RETIRED_G2__';
  return raw.toUpperCase();
}

function kkWebPackageRowMatchesTemplate_(webRow, eventId, templateId, targetPackage) {
  const eid = String(eventId || '').trim();
  const tid = String(templateId || '').trim();
  const webPackageId = String(webRow[0] || '').trim();
  const webEventId = String(webRow[1] || '').trim();
  if (!webPackageId || webEventId !== eid) return false;

  const rowTemplateId = kkNormalizeTemplateIdForEvent_(eid, webPackageId);
  if (rowTemplateId === tid || webPackageId === tid) return true;

  // Fallback for older generated rows whose package_id is not the exact template_id.
  // Do not use row order. Match by the real package shape. This keeps override price
  // connected to the visible public package even after G2/G1 cleanup or old rows.
  if (!targetPackage) return false;
  const rowType = String(webRow[2] || '').trim();
  const rowModel = String(webRow[3] || '').trim();
  const rowLens = String(webRow[5] || '').trim();
  const pkgType = String(targetPackage.package_type || '').trim();
  const pkgModel = String(targetPackage.model_group || '').trim();
  const pkgLens = String(targetPackage.lens_group || '').trim();
  return rowType === pkgType && rowModel === pkgModel && kkPriceLensCanonical_(rowLens) === kkPriceLensCanonical_(pkgLens);
}

function kkDirectApplyOverridePriceToWebPackages_(eventId, templateId, overridePrice) {
  const web = kkSheet_(KK.webPackages);
  const eid = String(eventId || '').trim();
  const tid = kkNormalizeTemplateIdForEvent_(eid, templateId);
  const hasPrice = !(overridePrice === '' || overridePrice === null || typeof overridePrice === 'undefined');
  const priceValue = hasPrice ? Number(overridePrice) : '';
  const targetPackage = kkGetPackageByTemplateId_(tid);

  const startRow = 5;
  const rows = kkGetValues_(KK.webPackages, startRow, 1, 14);
  let updated = 0;
  rows.forEach((row, idx) => {
    if (!kkWebPackageRowMatchesTemplate_(row, eid, tid, targetPackage)) return;
    const sheetRow = startRow + idx;
    const priceCell = web.getRange(sheetRow, 8); // 09_Web_Packages!H
    if (hasPrice) {
      // Write the public-facing price directly. This fixes the real issue where
      // 04_Event_Overrides saved correctly but 09_Web_Packages!H did not visibly change.
      priceCell.setValue(priceValue);
    } else {
      priceCell.setFormula(kkWebPackagePriceFormula_(sheetRow, tid));
    }
    updated++;
  });
  SpreadsheetApp.flush();
  return updated;
}

function kkRefreshWebPackagePriceForOverride_(eventId, templateId, overridePrice) {
  // Phase 3.6.17 safety fix:
  // Do NOT repair/reset the full 09_Web_Packages!H column during a single override save.
  // The previous full-column repair rewrote other events back to formula/default price,
  // so saving event A could make event B lose its manually-applied override.
  // Only touch the web-package row(s) for the event/package that was just saved.
  const applied = kkDirectApplyOverridePriceToWebPackages_(eventId, templateId, overridePrice);
  SpreadsheetApp.flush();
  return applied || 0;
}

function kkFormulaBookingPrice_(rowNumber) {
  const r = rowNumber;
  const lensCriteria = kkFormulaLensCriteria_('AM' + r);
  const lensOnly = `MAX(SUMIFS('09_Web_Packages'!$H$5:$H$1000,'09_Web_Packages'!$B$5:$B$1000,D${r},'09_Web_Packages'!$C$5:$C$1000,I${r},'09_Web_Packages'!$F$5:$F$1000,${lensCriteria}))`;
  const bundle = `MAX(SUMIFS('09_Web_Packages'!$H$5:$H$1000,'09_Web_Packages'!$B$5:$B$1000,D${r},'09_Web_Packages'!$C$5:$C$1000,I${r},'09_Web_Packages'!$D$5:$D$1000,AL${r},'09_Web_Packages'!$F$5:$F$1000,${lensCriteria}))`;
  const phoneOnly = `SUMIFS('09_Web_Packages'!$H$5:$H$1000,'09_Web_Packages'!$B$5:$B$1000,D${r},'09_Web_Packages'!$C$5:$C$1000,I${r},'09_Web_Packages'!$D$5:$D$1000,AL${r})`;
  return `=IF(I${r}="","",IF(I${r}="lens_only",IFERROR(${lensOnly},0),IF(I${r}="phone_lens_bundle",IFERROR(${bundle},0),IFERROR(${phoneOnly},0))))`;
}

function kkEnsureZeissLensModelMaster_() {
  // G2 was intentionally removed from production data. This helper only keeps the
  // existing ZEISS/G1 display clean and never inserts G2 back into Model_Master.
  const sh = kkSheet_(KK.modelMaster);
  const rows = kkGetValues_(KK.modelMaster, 5, 1, 5);
  for (let i = 0; i < rows.length; i++) {
    const group = String(rows[i][0] || '').trim();
    if (group === 'ZEISS_2_35X' || group === 'G1') {
      const rowNumber = i + 5;
      const display = String(rows[i][1] || '').trim();
      const type = String(rows[i][2] || '').trim().toLowerCase();
      if (!display || display === group || type !== 'lens') {
        sh.getRange(rowNumber, 2, 1, 2).setValues([['Lens Vivo', 'lens']]);
      }
    }
  }
}

function kkRetireG2AssetsAndPackages_() {
  // Hard guard for the current production setup: public inventory is 2 phones + ZEISS/G1 lenses only.
  // G2/G_2 rows may stay in the sheet for history/admin notes, but they must not affect stock, booking, or public packages.
  let changed = 0;

  const assets = kkSheet_(KK.assets);
  const assetRows = kkGetValues_(KK.assets, 5, 1, 7);
  assetRows.forEach((r, i) => {
    const group = r[2];
    if (!kkIsRetiredG2LensGroup_(group)) return;
    const row = i + 5;
    const status = String(r[4] || '').toLowerCase().trim();
    const rentable = kkBlank_(r[6]) ? '' : kkIsTrue_(r[6]);
    if (status !== 'inactive' || rentable !== false) {
      assets.getRange(row, 5).setValue('inactive');  // status
      assets.getRange(row, 7).setValue(false);       // rentable
      changed++;
    }
  });

  const packages = kkSheet_(KK.packages);
  const pkgRows = kkGetValues_(KK.packages, 5, 1, 10);
  pkgRows.forEach((r, i) => {
    const lensGroup = r[3];
    if (!kkIsRetiredG2LensGroup_(lensGroup)) return;
    const row = i + 5;
    packages.getRange(row, 8).setValue(false); // active
    packages.getRange(row, 9).setValue(false); // bookable if the column exists in this backend layout
    changed++;
  });
  return changed;
}

function kkFormulaWebPackageStatus_(rowNumber) {
  const r = rowNumber;
  const templateExpr = `INDEX('03_Packages'!$A$5:$A,1+MOD(ROW()-5,MAX(1,COUNTA('03_Packages'!$A$5:$A))))`;
  const activePhoneOnly = `SUMPRODUCT(N('00_Master_Booking'!$D$5:$D$1000=B${r}),N(REGEXMATCH(LOWER('00_Master_Booking'!$C$5:$C$1000),"^(pending|confirmed|prepared|picked_up)$")),N(LOWER('00_Master_Booking'!$I$5:$I$1000)="phone_only"))`;
  const lockedById = `COUNTIFS('18_Event_Visibility_Locks'!$B$2:$B,B${r},'18_Event_Visibility_Locks'!$G$2:$G,"LOCKED")>0`;
  const lockedByIdentity = `COUNTIFS('18_Event_Visibility_Locks'!$C$2:$C,IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,2,FALSE),""),'18_Event_Visibility_Locks'!$D$2:$D,IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,3,FALSE),""),'18_Event_Visibility_Locks'!$E$2:$E,IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,4,FALSE),""),'18_Event_Visibility_Locks'!$G$2:$G,"LOCKED")>0`;
  const historicalDifferentId = `COUNTIFS('18_Event_Visibility_Locks'!$C$2:$C,IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,2,FALSE),""),'18_Event_Visibility_Locks'!$D$2:$D,IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,3,FALSE),""),'18_Event_Visibility_Locks'!$E$2:$E,IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,4,FALSE),""),'18_Event_Visibility_Locks'!$B$2:$B,"<>"&B${r})>0`;
  return `=ARRAY_CONSTRAIN(ARRAYFORMULA(IF(B${r}="","",IF(OR(${lockedById},${lockedByIdentity},${historicalDifferentId},IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,9,FALSE),"")<>"OK",IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,6,FALSE),"")<>"open",IFERROR(VLOOKUP(B${r},'01_Events'!$A$5:$I,7,FALSE),FALSE)<>TRUE,INDEX('03_Packages'!$H$5:$H,1+MOD(ROW()-5,MAX(1,COUNTA('03_Packages'!$A$5:$A))))<>TRUE,COUNTIFS('04_Event_Overrides'!$A$5:$A,B${r},'04_Event_Overrides'!$B$5:$B,${templateExpr},'04_Event_Overrides'!$D$5:$D,FALSE)>0,AND(C${r}="lens_only",${activePhoneOnly}=0)),"hidden",IF(I${r}>0,"available","full")))),1,1)`;
}

function kkFormulaWebReadyAction_(rowNumber) {
  const r = rowNumber;
  const lockedById = `COUNTIFS('18_Event_Visibility_Locks'!$B$2:$B,A${r},'18_Event_Visibility_Locks'!$G$2:$G,"LOCKED")>0`;
  const lockedByIdentity = `COUNTIFS('18_Event_Visibility_Locks'!$C$2:$C,B${r},'18_Event_Visibility_Locks'!$D$2:$D,IFERROR(VLOOKUP(A${r},'01_Events'!$A$5:$I,3,FALSE),""),'18_Event_Visibility_Locks'!$E$2:$E,D${r},'18_Event_Visibility_Locks'!$G$2:$G,"LOCKED")>0`;
  const historicalDifferentId = `COUNTIFS('18_Event_Visibility_Locks'!$C$2:$C,B${r},'18_Event_Visibility_Locks'!$D$2:$D,IFERROR(VLOOKUP(A${r},'01_Events'!$A$5:$I,3,FALSE),""),'18_Event_Visibility_Locks'!$E$2:$E,D${r},'18_Event_Visibility_Locks'!$B$2:$B,"<>"&A${r})>0`;
  return `=IF(A${r}="","",IF(OR(${lockedById},${lockedByIdentity},${historicalDifferentId},IFERROR(VLOOKUP(A${r},'01_Events'!$A$5:$I,9,FALSE),"")<>"OK",IFERROR(VLOOKUP(A${r},'01_Events'!$A$5:$I,6,FALSE),"")<>"open",IFERROR(VLOOKUP(A${r},'01_Events'!$A$5:$I,7,FALSE),FALSE)<>TRUE),"hide",IF(MAX(G${r},H${r})>0,"show","show_full")))`;
}

function kkRepairOwnerVisibilityLockFormulas_() {
  const startRow = 5;
  const endRow = 1000;
  const rowCount = endRow - startRow + 1;
  const webReadyAction = [];
  const webPackageStatus = [];
  for (let row = startRow; row <= endRow; row++) {
    webReadyAction.push([kkFormulaWebReadyAction_(row)]);
    webPackageStatus.push([kkFormulaWebPackageStatus_(row)]);
  }
  kkSheet_(KK.webReady).getRange(startRow, 10, rowCount, 1).setFormulas(webReadyAction);
  kkSheet_(KK.webPackages).getRange(startRow, 10, rowCount, 1).setFormulas(webPackageStatus);
  SpreadsheetApp.flush();
  return rowCount;
}

// Storefront policy: standalone lens rental is hidden by default.
// It becomes visible only when the same event has an active phone_only booking,
// meaning at least one physical lens is spare. active_override=FALSE remains a kill switch.
function kkRepairLensCompatibilityFormulas_() {
  const web = kkSheet_(KK.webPackages);
  const booking = kkSheet_(KK.bookings);
  const startRow = 5;
  const endRow = 1000;
  const rowCount = endRow - startRow + 1;
  const avail = [];
  const status = [];
  const raw = [];
  const bookingPrice = [];
  const activeHold = [];
  const phoneHold = [];
  const lensHold = [];
  for (let row = startRow; row <= endRow; row++) {
    avail.push([kkFormulaWebPackageAvailable_(row, false)]);
    status.push([kkFormulaWebPackageStatus_(row)]);
    raw.push([kkFormulaWebPackageAvailable_(row, true)]);
    bookingPrice.push([kkFormulaBookingPrice_(row)]);
    activeHold.push([`=IF(D${row}="","",OR(C${row}="pending",C${row}="confirmed",C${row}="prepared",C${row}="picked_up"))`]);
    phoneHold.push([`=IF(D${row}="","",AND(Z${row}=TRUE,OR(I${row}="phone_only",I${row}="phone_lens_bundle")))`]);
    lensHold.push([`=IF(D${row}="","",AND(Z${row}=TRUE,OR(I${row}="lens_only",I${row}="phone_lens_bundle")))`]);
  }
  // Phase 3.7.1 safety: do NOT rewrite 09_Web_Packages!H during stock/formula repair.
  // H is the public price source and may contain event-specific override values applied by admin.
  // Rewriting it here makes poster/event updates reset prices back to package defaults.
  web.getRange(startRow, 9, rowCount, 1).setFormulas(avail);      // 09_Web_Packages!I available_count
  web.getRange(startRow, 10, rowCount, 1).setFormulas(status);     // 09_Web_Packages!J package_status + lens-only auto guard
  web.getRange(startRow, 13, rowCount, 1).setFormulas(raw);       // 09_Web_Packages!M raw_available_count
  booking.getRange(startRow, 24, rowCount, 1).setFormulas(bookingPrice); // 00_Master_Booking!X package_price
  booking.getRange(startRow, 26, rowCount, 1).setFormulas(activeHold);   // Z active booking hold
  booking.getRange(startRow, 36, rowCount, 1).setFormulas(phoneHold);    // AJ reserves a phone by package
  booking.getRange(startRow, 37, rowCount, 1).setFormulas(lensHold);     // AK reserves a lens by package
}

function kkEnsureLensCompatibilityPatchInstalled_() {
  const props = PropertiesService.getDocumentProperties();
  if (props.getProperty('KK_LENS_COMPAT_PATCH_VERSION') === KK_LENS_COMPAT_PATCH_VERSION) return false;
  const lock = kkTryDocumentLock_('lens compatibility auto repair', 3000);
  if (!lock) return false;
  try {
    if (props.getProperty('KK_LENS_COMPAT_PATCH_VERSION') === KK_LENS_COMPAT_PATCH_VERSION) return false;
    kkEnsureZeissLensModelMaster_();
    kkRetireG2AssetsAndPackages_();
    kkRepairLensCompatibilityFormulas_();
    SpreadsheetApp.flush();
    props.setProperty('KK_LENS_COMPAT_PATCH_VERSION', KK_LENS_COMPAT_PATCH_VERSION);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function kkRepairLensCompatibilityPatch() {
  PropertiesService.getDocumentProperties().deleteProperty('KK_LENS_COMPAT_PATCH_VERSION');
  const installed = kkEnsureLensCompatibilityPatchInstalled_();
  kkSafeAlert_((installed ? 'Repaired' : 'Already current') + ': lens compatibility formulas are ready. Public Web Packages will count only ZEISS_2_35X/G1 lenses. Standalone lens rental stays hidden unless the event has an active phone-only booking. G2/G_2 rows are retired from selling stock. Price formulas use package_id/template_id from 09_Web_Packages!A, not row order.');
}

function kkGetEventById_(eventId) {
  const rows = kkGetValues_(KK.events, 5, 1, 9);
  for (const r of rows) {
    if (String(r[0]).trim() === String(eventId).trim()) {
      return { event_id: r[0], event_name: r[1], event_date: r[2], venue: r[3], status: r[5], active: kkIsTrue_(r[6]), data_health: r[8] };
    }
  }
  throw new Error('Event not found: ' + eventId);
}

function kkGetPackageByTemplateId_(templateId) {
  const rows = kkGetValues_(KK.packages, 5, 1, 10);
  for (const r of rows) {
    if (String(r[0]).trim() === String(templateId).trim()) {
      return { template_id: r[0], model_group: r[1], package_type: r[2], lens_group: r[3], standard_price: r[4], display_name: r[5], active: kkIsTrue_(r[7]), use_case: r[9] || '' };
    }
  }
  throw new Error('Template/package not found: ' + templateId);
}

function kkGetPackageSpecByType_(packageType) {
  const wanted = String(packageType || '').toLowerCase().trim();
  if (!wanted) throw new Error('Booking missing package_type');
  const rows = kkGetValues_(KK.packages, 5, 1, 10);
  let fallback = null;
  for (const r of rows) {
    const type = String(r[2] || '').toLowerCase().trim();
    if (type !== wanted) continue;
    const spec = {
      template_id: r[0],
      model_group: String(r[1] || '').trim(),
      package_type: type,
      lens_group: String(r[3] || '').trim(),
      active: kkIsTrue_(r[7])
    };
    if (spec.active) return spec;
    if (!fallback) fallback = spec;
  }
  if (fallback) return fallback;
  throw new Error('No package master found for package_type: ' + wanted);
}

function kkAssignMissingAssetsForPreparedBooking_(bookingRow, nextStatus, eventDate) {
  const status = String(nextStatus || '').toLowerCase().trim();
  // Pending/confirmed bookings reserve stock by package count. A physical Asset ID is
  // assigned only when admin prepares or hands over the equipment.
  if (!['prepared', 'picked_up'].includes(status)) return bookingRow;

  const next = bookingRow;
  const packageType = String(next[8] || '').toLowerCase().trim();
  const needsPhone = packageType === 'phone_only' || packageType === 'phone_lens_bundle';
  const needsLens = packageType === 'lens_only' || packageType === 'phone_lens_bundle';
  if ((!needsPhone || String(next[9] || '').trim()) && (!needsLens || String(next[10] || '').trim())) return next;

  const spec = kkGetPackageSpecByType_(packageType);
  if (needsPhone && !String(next[9] || '').trim()) {
    next[9] = kkFindAvailableAsset_('phone', spec.model_group, eventDate);
  }
  if (needsLens && !String(next[10] || '').trim()) {
    next[10] = kkFindAvailableAsset_('lens', spec.lens_group, eventDate);
  }
  return next;
}

function kkEventDateMap_() {
  const map = {};
  kkGetValues_(KK.events, 5, 1, 3).forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[2]; });
  return map;
}

function kkAssertEventDateChangeSafe_(eventId, nextEventDate) {
  const eid = String(eventId || '').trim();
  if (!eid || !nextEventDate) return true;
  const currentEvent = kkGetEventById_(eid);
  if (currentEvent && currentEvent.event_date && kkSameDate_(currentEvent.event_date, nextEventDate)) return true;

  const eventDates = kkEventDateMap_();
  const bookings = kkGetValues_(KK.bookings, 5, 1, 20);
  const moving = { phone: {}, lens: {} };

  bookings.forEach(r => {
    const status = String(r[2] || '').toLowerCase().trim();
    if (!kkActiveHold_(status) || String(r[3] || '').trim() !== eid) return;
    const phoneId = String(r[9] || '').trim();
    const lensId = String(r[10] || '').trim();
    if (phoneId) moving.phone[phoneId] = true;
    if (lensId) moving.lens[lensId] = true;
  });
  if (!Object.keys(moving.phone).length && !Object.keys(moving.lens).length) return true;

  bookings.forEach(r => {
    const status = String(r[2] || '').toLowerCase().trim();
    const otherEventId = String(r[3] || '').trim();
    if (!kkActiveHold_(status) || !otherEventId || otherEventId === eid) return;
    const otherDate = eventDates[otherEventId];
    if (!otherDate || !kkSameDate_(otherDate, nextEventDate)) return;
    const phoneId = String(r[9] || '').trim();
    const lensId = String(r[10] || '').trim();
    if (phoneId && moving.phone[phoneId]) {
      throw new Error('EVENT_DATE_ASSET_COLLISION: ' + phoneId + ' is already reserved by ' + otherEventId + ' on ' + kkDateKey_(nextEventDate));
    }
    if (lensId && moving.lens[lensId]) {
      throw new Error('EVENT_DATE_ASSET_COLLISION: ' + lensId + ' is already reserved by ' + otherEventId + ' on ' + kkDateKey_(nextEventDate));
    }
  });
  return true;
}


function kkBookedAssetIdsForDate_(eventDate, excludeRow) {
  const eventDates = kkEventDateMap_();
  const booked = { phone: {}, lens: {} };
  const skipRow = Number(excludeRow || 0);
  const rows = kkGetValues_(KK.bookings, 5, 3, 9);
  rows.forEach((r, i) => {
    const sourceRow = i + 5;
    if (skipRow && sourceRow === skipRow) return;
    const status = r[0];
    const eventId = r[1];
    const phoneId = r[7];
    const lensId = r[8];
    if (!kkActiveHold_(status)) return;
    if (!eventDates[String(eventId).trim()] || !kkSameDate_(eventDates[String(eventId).trim()], eventDate)) return;
    if (phoneId) booked.phone[String(phoneId).trim()] = true;
    if (lensId) booked.lens[String(lensId).trim()] = true;
  });
  return booked;
}

function kkFindAvailableAsset_(assetType, modelGroup, eventDate) {
  const type = String(assetType || '').toLowerCase();
  const model = String(modelGroup || '').trim();
  if (!model || model === 'NONE') return '';
  const booked = kkBookedAssetIdsForDate_(eventDate);
  const rows = kkGetValues_(KK.assets, 5, 1, 7);
  for (const r of rows) {
    const assetId = String(r[0] || '').trim();
    const rowType = String(r[1] || '').toLowerCase().trim();
    const rowModel = String(r[2] || '').trim();
    const status = String(r[4] || '').toLowerCase().trim();
    const rentable = kkAssetIsRentableAvailable_(status, r[6]);
    if (!assetId || rowType !== type || !kkAssetModelMatches_(type, rowModel, model) || !rentable) continue;
    if (booked[type] && booked[type][assetId]) continue;
    return assetId;
  }
  throw new Error(`No available ${type} asset for model ${model} on ${kkDateKey_(eventDate)}`);
}

function kkValidateManualAsset_(assetId, assetType, modelGroup, eventDate, excludeRow) {
  assetId = String(assetId || '').trim();
  if (!assetId) return;
  const type = String(assetType || '').toLowerCase().trim();
  const model = String(modelGroup || '').trim();
  const rows = kkGetValues_(KK.assets, 5, 1, 7);
  const booked = kkBookedAssetIdsForDate_(eventDate, excludeRow);
  let found = false;

  for (const r of rows) {
    const rowId = String(r[0] || '').trim();
    if (rowId !== assetId) continue;
    found = true;
    const rowType = String(r[1] || '').toLowerCase().trim();
    const rowModel = String(r[2] || '').trim();
    const status = String(r[4] || '').toLowerCase().trim();
    const rentable = kkAssetIsRentableAvailable_(status, r[6]);
    if (rowType !== type) throw new Error(`${assetId} is not a ${type} asset`);
    if (!kkAssetModelMatches_(type, rowModel, model)) throw new Error(`${assetId} model is ${rowModel}, expected compatible ${model}`);
    if (!rentable) throw new Error(`${assetId} is not rentable/available`);
    if (booked[type] && booked[type][assetId]) throw new Error(`${assetId} is already booked on ${kkDateKey_(eventDate)}`);
    return;
  }
  if (!found) throw new Error(`Asset not found: ${assetId}`);
}

function kkCreateEventFromDashboard() {
  const ui = SpreadsheetApp.getUi();
  try {
    const eventInputs = kkRange_('KK_EVENT_CREATE_INPUTS', KK.dashboard, 'B6:B13').getValues().flat();
    const pkgRows = kkRange_('KK_EVENT_PACKAGE_ROWS', KK.dashboard, 'A17:I46').getValues();
    const overrides = [];
    const seen = {};
    pkgRows.forEach(row => {
      const usePkg = kkIsTrue_(row[0]);
      const templateId = String(row[1] || '').trim();
      const overridePrice = row[4];
      const hide = kkIsTrue_(row[5]);
      const overrideNote = row[6];
      const sortOverride = row[7];
      const useCaseOverride = row[8];
      if (!templateId || seen[templateId]) return;
      seen[templateId] = true;
      const shouldWrite = !usePkg || hide || overridePrice !== '' || overrideNote !== '' || sortOverride !== '' || useCaseOverride !== '';
      if (!shouldWrite) return;
      overrides.push({
        template_id: templateId,
        override_price: overridePrice === '' ? '' : overridePrice,
        active_override: (!usePkg || hide) ? false : '',
        override_note: overrideNote || '',
        sort_order_override: sortOverride === '' ? '' : sortOverride,
        use_case_override: useCaseOverride || ''
      });
    });

    const result = kkApiCreateEvent_({
      event_name: eventInputs[0],
      event_date: eventInputs[1],
      venue: eventInputs[2],
      poster_url: eventInputs[3],
      note: eventInputs[4],
      status: eventInputs[5] || 'open',
      active_on_web: kkBlank_(eventInputs[6]) ? true : kkIsTrue_(eventInputs[6]),
      event_price_overrides: overrides,
      visibility_changed_by: 'SHEET_DASHBOARD'
    });
    kkRange_('KK_EVENT_CREATED_ID', KK.dashboard, 'B13').setValue(result.event_id);
    ui.alert('Created event: ' + result.event_id);
  } catch (error) {
    ui.alert('❌ เกิดข้อผิดพลาด:\n' + (error && error.message ? error.message : String(error)));
  }
}

function kkNextAssetIds_(assetType, qty) {
  const type = String(assetType || '').toLowerCase().trim();
  const prefix = type === 'lens' ? 'LENS' : 'PHONE';
  const values = kkGetValues_(KK.assets, 5, 1, 1).flat().filter(String);
  let max = 0;
  values.forEach(id => {
    const m = String(id).match(new RegExp('^' + prefix + '-(\\d+)$'));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return Array.from({ length: qty }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, '0')}`);
}

function kkAddAssetsFromDashboard() {
  const ui = SpreadsheetApp.getUi();
  try {
    const inputs = kkRange_('KK_ADD_ASSET_INPUTS', KK.dashboard, 'K6:K11').getValues().flat();
    const result = kkApiAddAssets_({
      asset_type: inputs[0],
      model_group: inputs[1],
      quantity: inputs[2],
      serial_prefix: inputs[3],
      status: inputs[4] || 'available',
      notes: inputs[5],
      rentable: String(inputs[4] || 'available').toLowerCase().trim() === 'available'
    });
    ui.alert('Added assets: ' + (result.asset_ids || []).join(', '));
  } catch (error) {
    ui.alert('❌ เกิดข้อผิดพลาด:\n' + (error && error.message ? error.message : String(error)));
  }
}

function kkUpdateAccessoryStockFromDashboard() {
  const ui = SpreadsheetApp.getUi();
  let lock = null;
  try {
    lock = kkAcquireDocumentLock_('update accessory stock', 12000);
    const rows = kkRange_('KK_ACCESSORY_INPUT_ROWS', KK.dashboard, 'J16:N26').getValues();
    const sh = kkSheet_(KK.accessories);
    const existing = kkGetValues_(KK.accessories, 5, 1, 1).flat();
    const rowByType = {};
    existing.forEach((v, i) => {
      const key = String(v || '').trim();
      if (key && rowByType[key] === undefined) rowByType[key] = i + 5;
    });
    let count = 0;
    const seenThisRun = {};
    rows.forEach(row => {
      const type = String(row[0] || '').trim();
      if (!type || seenThisRun[type]) return;
      seenThisRun[type] = true;
      const total = Number(row[1]);
      const damaged = Number(row[2] || 0);
      const notes = row[3] || '';
      if (!Number.isFinite(total) || !Number.isInteger(total) || total < 0) throw new Error('Accessory total_qty must be a non-negative integer: ' + type);
      if (!Number.isFinite(damaged) || !Number.isInteger(damaged) || damaged < 0) throw new Error('Accessory damaged_qty must be a non-negative integer: ' + type);
      if (damaged > total) throw new Error('Accessory damaged_qty cannot exceed total_qty: ' + type);
      let targetRow = rowByType[type];
      if (!targetRow) {
        targetRow = kkFirstEmptyRow_(KK.accessories, 1, 5, 1, 5);
        rowByType[type] = targetRow;
      }
      sh.getRange(targetRow, 1, 1, 3).setValues([[type, total, damaged]]);
      sh.getRange(targetRow, 5).setValue(notes);
      count++;
    });
    SpreadsheetApp.flush();
    ui.alert('Updated accessory rows: ' + count);
  } catch (error) {
    ui.alert('❌ เกิดข้อผิดพลาด:\n' + (error && error.message ? error.message : String(error)));
  } finally {
    if (lock) lock.releaseLock();
  }
}

function kkAddQuickBookingFromDashboard() {
  const ui = SpreadsheetApp.getUi();
  try {
    const bookingInputs = kkRange_('KK_QUICK_BOOKING_INPUTS', KK.dashboard, 'K31:K42').getValues().flat();
    const result = kkApiCreateBooking_({
      event_id: bookingInputs[0],
      template_id: bookingInputs[1],
      customer_name: bookingInputs[2],
      customer_contact: bookingInputs[3],
      customer_phone: bookingInputs[4],
      contact_channel: bookingInputs[5] || 'LINE',
      booking_status: bookingInputs[6] || 'confirmed',
      phone_asset_id: bookingInputs[7],
      lens_asset_id: bookingInputs[8],
      payment_status: bookingInputs[9] || 'unpaid',
      amount_received: bookingInputs[10],
      booking_note: bookingInputs[11]
    });
    kkRange_('KK_QUICK_BOOKING_ASSIGNED_ASSETS', KK.dashboard, 'K38:K39').setValues([[result.phone_asset_id || ''], [result.lens_asset_id || '']]);
    ui.alert(
      '✅ Added booking ' + (result.booking_id || '') + ' (row ' + (result.row_number || '-') + ')\n' +
      'Phone: ' + (result.phone_asset_id || '-') + '\nLens: ' + (result.lens_asset_id || '-')
    );
  } catch (error) {
    ui.alert('❌ เกิดข้อผิดพลาด:\n' + (error && error.message ? error.message : String(error)));
  }
}

function kkConvertEventDriveUrls() {
  let lock = null;
  try {
    lock = kkAcquireDocumentLock_('convert event poster URLs', 12000);
    const range = kkGetDynamicRange_(KK.events, 5, 5, 1);
    if (!range) return kkSafeAlert_('No events to convert.');
    const values = range.getValues();
    let count = 0;
    values.forEach((r, i) => {
      const before = r[0];
      const after = kkPosterForWrite_(before).url;
      if (before && before !== after) { values[i][0] = after; count++; }
    });
    if (count > 0) {
      range.setValues(values);
      SpreadsheetApp.flush();
    }
    kkSafeAlert_('Converted image URLs: ' + count);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function kkRunBasicHealthCheck() {
  SpreadsheetApp.flush();
  const sh = SpreadsheetApp.getActive().getSheetByName(KK.health);
  if (sh) SpreadsheetApp.setActiveSheet(sh);
  kkSafeAlert_('Health Check recalculated. Please review rows with CHECK.');
}

function kkApiJson_(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function kkApiOk_(data) {
  return Object.assign({ ok: true }, data || {});
}

function kkApiFail_(err) {
  return { ok: false, error: err && err.message ? err.message : String(err) };
}

function kkApiRequireKey_(payload) {
  const expected = String(PropertiesService.getScriptProperties().getProperty('KK_ADMIN_API_KEY') || '').trim();
  const provided = String(payload.apiKey || '').trim();
  if (!expected) throw new Error('Missing Script Property KK_ADMIN_API_KEY. In Google Sheet menu, run KK Admin > CRM: Generate Admin API Key.');
  if (!provided || provided !== expected) throw new Error('Invalid admin API key');
}

function kkAcquireDocumentLock_(label, waitMs) {
  const lock = LockService.getDocumentLock();
  const ms = Math.max(1000, Number(waitMs || 8000));
  if (!lock.tryLock(ms)) {
    throw new Error('ระบบกำลังบันทึก/คำนวณจากคำสั่งก่อนหน้าอยู่ กรุณารอ 10-20 วินาทีแล้วกดอีกครั้ง (' + String(label || 'document lock') + ')');
  }
  return lock;
}

function kkTryDocumentLock_(label, waitMs) {
  const lock = LockService.getDocumentLock();
  const ms = Math.max(1000, Number(waitMs || 3000));
  if (!lock.tryLock(ms)) {
    Logger.log('Skipped lock-dependent background task because document lock is busy: ' + String(label || 'document lock'));
    return null;
  }
  return lock;
}

function doPost(e) {
  const startedAt = Date.now();
  let payload = {};
  let action = '';
  let keyOk = false;
  try {
    payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    kkApiRequireKey_(payload);
    keyOk = true;
    action = String(payload.action || '').trim();
    let result;

    switch (action) {
      case 'snapshot': result = kkApiSnapshot_(payload); break;
      case 'phase1Health': result = { data: kkPhase1Diagnostics_(payload) }; break;
      case 'uploadPoster': result = kkApiUploadPoster_(payload); break;
      case 'createEvent': result = kkApiCreateEvent_(payload); break;
      case 'updateEvent': result = kkApiUpdateEvent_(payload); break;
      case 'createPackage': result = kkApiCreatePackage_(payload); break;
      case 'updatePackage': result = kkApiUpdatePackage_(payload); break;
      case 'upsertEventOverride': result = kkApiUpsertEventOverride_(payload); break;
      case 'bulkSetEventPackageVisibility': result = kkApiBulkSetEventPackageVisibility_(payload); break;
      case 'addAssets': result = kkApiAddAssets_(payload); break;
      case 'updateAsset': result = kkApiUpdateAsset_(payload); break;
      case 'deleteAsset': result = kkApiDeleteAsset_(payload); break;
      case 'createBooking': result = kkApiCreateBooking_(payload); break;
      case 'createLineBookingPending': result = kkApiCreateLineBookingPending_(payload); break;
      case 'decideLineBookingPending': result = kkApiDecideLineBookingPending_(payload); break;
      case 'updateBooking': result = kkApiUpdateBooking_(payload); break;
      case 'cleanupOldData': result = kkApiCleanupOldData_(payload); break;
      default: throw new Error('Unknown action: ' + action);
    }
    if (action && action !== 'snapshot' && action !== 'phase1Health') kkAuditLog_(action, payload, result, startedAt);
    return kkApiJson_(kkApiOk_(Object.assign({ admin_api_version: KK_ADMIN_VERSION }, result || {})));
  } catch (err) {
    if (keyOk) kkErrorLog_(action || (payload && payload.action) || '', payload, err, startedAt);
    return kkApiJson_(Object.assign({ admin_api_version: KK_ADMIN_VERSION }, kkApiFail_(err)));
  }
}

function doGet() {
  return kkApiJson_({
    ok: true,
    version: KK_ADMIN_VERSION,
    spreadsheet_id: SpreadsheetApp.getActive().getId(),
    message: 'KK Phone Rental Admin CRM API is running. Use POST through the Vercel proxy.'
  });
}

function kkApiDate_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function kkApiDateTime_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function kkApiBoolOrBlank_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  return kkIsTrue_(value);
}

function kkApiNumber_(value, fieldName, allowBlank) {
  if ((value === '' || value === null || typeof value === 'undefined') && allowBlank) return '';
  const n = Number(value || 0);
  if (isNaN(n) || n < 0) throw new Error(fieldName + ' must be a non-negative number');
  return n;
}

function kkModelDisplayMap_() {
  const map = {};
  const rows = kkGetValues_(KK.modelMaster, 5, 1, 5);
  if (!rows.length) return map;
  rows.forEach(r => {
    const key = String(r[0] || '').trim();
    if (!key) return;
    map[key] = {
      model_group: key,
      model_display: r[1] || key,
      asset_type: String(r[2] || '').toLowerCase().trim(),
      active: kkIsTrue_(r[3]),
      notes: r[4] || ''
    };
  });
  return map;
}

function kkAssertModelGroupType_(modelGroup, expectedType) {
  const group = String(modelGroup || '').trim();
  const type = String(expectedType || '').toLowerCase().trim();
  if (!group || group === 'NONE') throw new Error('model_group is required for ' + type + ' asset/package');
  if (type === 'lens' && kkIsRetiredG2LensGroup_(group)) throw new Error('Retired model_group cannot be used for new asset/package: ' + group);
  const model = kkModelDisplayMap_()[group];
  if (!model) throw new Error('Unknown model_group: ' + group);
  if (!model.active) throw new Error('Inactive model_group: ' + group);
  if (String(model.asset_type || '').toLowerCase().trim() !== type) {
    throw new Error('model_group ' + group + ' is ' + String(model.asset_type || '-') + ', expected ' + type);
  }
  return model;
}

function kkNormalizeAssetModelDisplay_(assetType, modelGroup, modelDisplay) {
  const type = String(assetType || '').toLowerCase().trim();
  const group = String(modelGroup || '').trim();
  const display = String(modelDisplay || '').trim();
  const normalizedGroup = group.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const displayIsFallback = !display || display.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedGroup;
  if (type === 'lens' && displayIsFallback && /^(G1|ZEISS235X|ZEISS235|LENSVIVO)$/.test(normalizedGroup)) return 'Lens Vivo';
  return display || group || '';
}

function kkApiWebReadyRows_() {
  return kkGetValues_(KK.webReady, 5, 1, 11).filter(r => r[0]).map(r => ({
    event_id: String(r[0] || '').trim(),
    event_name: r[1] || '',
    event_date: kkApiDate_(r[2]),
    venue: r[3] || '',
    poster_image_url: r[4] || '',
    phone_model_display: r[5] || '',
    available_phone_count: Number(r[6] || 0),
    available_lens_count: Number(r[7] || 0),
    line_message_template: r[8] || '',
    action_for_web: r[9] || '',
    data_health: r[10] || ''
  }));
}

function kkApiWebPackageRows_() {
  return kkGetValues_(KK.webPackages, 5, 1, 14).filter(r => r[0] && r[1] && !kkIsRetiredG2LensGroup_(r[5])).map(r => ({
    package_id: String(r[0] || '').trim(),
    event_id: String(r[1] || '').trim(),
    package_type: r[2] || '',
    model_group: r[3] || '',
    model_display: r[4] || '',
    lens_group: r[5] || '',
    lens_display: r[6] || '',
    price: Number(r[7] || 0),
    available_count: Number(r[8] || 0),
    package_status: r[9] || '',
    sort_order: r[10] || '',
    web_note: r[11] || '',
    raw_available_count: Number(r[12] || 0),
    use_case: r[13] || ''
  }));
}

function kkTemplateIdFromWebPackageId_(packageId, eventId) {
  const pkgId = String(packageId || '').trim();
  const evId = String(eventId || '').trim();
  if (!pkgId) return '';
  const tplPos = pkgId.indexOf('TPL-');
  if (tplPos >= 0) return pkgId.slice(tplPos);
  if (evId && pkgId.indexOf(evId + '-') === 0) return pkgId.slice(evId.length + 1);
  return pkgId;
}

function kkNormalizeTemplateIdForEvent_(eventId, templateId) {
  const raw = String(templateId || '').trim();
  if (!raw) return '';
  const normalized = kkTemplateIdFromWebPackageId_(raw, eventId);
  return normalized || raw;
}

function kkIsWebPackageBookable_(p) {
  if (!p) return false;
  const status = String(p.package_status || '').toLowerCase().trim();
  return (status === 'available' || status === 'open') && Number(p.available_count || 0) > 0 && Number(p.price || 0) > 0;
}

function kkAssertWebPackageBookable_(eventId, templateId) {
  const normalizedTemplateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);
  const eventRows = kkApiWebPackageRows_().filter(p => String(p.event_id || '').trim() === String(eventId || '').trim());
  if (!eventRows.length) return;
  const row = eventRows.find(p => {
    const webPackageId = String(p.package_id || '').trim();
    const webTemplateId = kkTemplateIdFromWebPackageId_(webPackageId, p.event_id || eventId);
    return webPackageId === normalizedTemplateId || webTemplateId === normalizedTemplateId;
  });
  if (!row) throw new Error('Package is not visible for this event in 09_Web_Packages: ' + normalizedTemplateId);
  if (!kkIsWebPackageBookable_(row)) {
    throw new Error('งานนี้เต็มแล้วหรือแพ็กเกจนี้ไม่พร้อมจอง: ' + normalizedTemplateId + ' / status=' + String(row.package_status || '-') + ' / available_count=' + String(row.available_count || 0) + ' / price=' + String(row.price || 0));
  }
}

function kkApiSnapshot_(payload) {
  // Snapshot is a read-only request. Never repair formulas or force a sheet-wide
  // recalculation here: both operations can make normal Admin refreshes exceed
  // the Vercel proxy timeout when the spreadsheet is busy. Repairs remain
  // available from the explicit KK Admin repair menu.
  const snapshotStartedAt = Date.now();
  const lensPatchReady = PropertiesService.getDocumentProperties()
    .getProperty('KK_LENS_COMPAT_PATCH_VERSION') === KK_LENS_COMPAT_PATCH_VERSION;

  const modelMap = kkModelDisplayMap_();

  const events = kkGetValues_(KK.events, 5, 1, 9)
    .filter(r => r[0])
    .map(r => ({
      event_id: String(r[0] || '').trim(),
      event_name: r[1] || '',
      event_date: kkApiDate_(r[2]),
      venue: r[3] || '',
      poster_url: r[4] || '',
      status: r[5] || '',
      active_on_web: kkIsTrue_(r[6]),
      note: r[7] || '',
      data_health: r[8] || ''
    }));
  const eventById = {};
  events.forEach(e => { eventById[e.event_id] = e; });

  const packages = kkGetValues_(KK.packages, 5, 1, 10)
    .filter(r => r[0])
    .map(r => ({
      template_id: String(r[0] || '').trim(),
      model_group: r[1] || '',
      package_type: r[2] || '',
      lens_group: r[3] || '',
      standard_price: r[4] || 0,
      display_name: r[5] || '',
      active: kkIsTrue_(r[7]),
      use_case: r[9] || ''
    }));

  const packageDisplayByKey = {};
  const packageDisplayByType = {};
  packages.forEach(p => {
    const type = String(p.package_type || '').trim();
    const model = String(p.model_group || '').trim();
    const lens = String(p.lens_group || '').trim();
    const label = p.display_name || p.template_id || type;
    if (type) packageDisplayByType[type] = packageDisplayByType[type] || label;
    if (type) {
      const lensKeys = lens && lens !== 'NONE' ? kkLensGroupAliases_(lens) : [lens];
      lensKeys.forEach(lensKey => { packageDisplayByKey[[type, model, lensKey].join('|')] = label; });
    }
  });

  const overrides = kkGetValues_(KK.overrides, 5, 1, 7)
    .map((r, i) => ({ row_number: i + 5, row: r }))
    .filter(o => o.row[0] && o.row[1])
    .map(o => ({
      row_number: o.row_number,
      event_id: String(o.row[0] || '').trim(),
      template_id: String(o.row[1] || '').trim(),
      override_price: o.row[2] === '' || o.row[2] === null ? '' : o.row[2],
      active_override: o.row[3] === '' || o.row[3] === null ? '' : kkIsTrue_(o.row[3]),
      override_note: o.row[4] || '',
      sort_order_override: o.row[5] || '',
      use_case_override: o.row[6] || ''
    }));

  const assets = kkGetValues_(KK.assets, 5, 1, 7)
    .filter(r => r[0])
    .map(r => {
      const modelGroup = String(r[2] || '').trim();
      const model = modelMap[modelGroup] || {};
      return {
        asset_id: String(r[0] || '').trim(),
        asset_type: String(r[1] || '').toLowerCase().trim(),
        model_group: modelGroup,
        model_display: kkNormalizeAssetModelDisplay_(r[1], modelGroup, model.model_display || modelGroup || ''),
        serial: r[3] || '',
        status: r[4] || '',
        notes: r[5] || '',
        rentable_setting: kkBlank_(r[6]) ? '' : kkIsTrue_(r[6]),
        rentable: kkAssetIsRentableAvailable_(r[4], r[6])
      };
    });

  const assetById = {};
  assets.forEach(a => { assetById[a.asset_id] = a; });

  const bookings = kkGetValues_(KK.bookings, 5, 1, 20)
    .map((r, i) => ({ row_number: i + 5, row: r }))
    .filter(o => o.row[3] || o.row[4])
    .map(o => {
      const r = o.row;
      const eventId = String(r[3] || '').trim();
      const event = eventById[eventId] || {};
      const phoneId = String(r[9] || '').trim();
      const lensId = String(r[10] || '').trim();
      const phone = assetById[phoneId] || {};
      const lens = assetById[lensId] || {};
      const status = String(r[2] || '').toLowerCase().trim();
      const payment = String(r[14] || '').toLowerCase().trim();
      let work_task = '';
      if (status === 'picked_up') work_task = 'รับคืน/ตรวจเครื่อง';
      else if (status === 'prepared') work_task = 'พร้อมส่งมอบ/รอลูกค้ารับ';
      else if (['pending','confirmed'].includes(status)) work_task = 'เตรียมส่งมอบ';
      else if (status === 'returned') work_task = 'อัปโหลดไฟล์/ส่งลิงก์';
      else if (status === 'uploaded') work_task = 'ปิดงาน';
      if (payment && payment !== 'paid' && status !== 'cancelled') work_task = work_task ? work_task + ' + ตามชำระเงิน' : 'ตามชำระเงิน';

      const packageType = String(r[8] || '').trim();
      const packageDisplay =
        packageDisplayByKey[[packageType, phone.model_group || '', lens.model_group || ''].join('|')] ||
        packageDisplayByKey[[packageType, phone.model_group || '', 'NONE'].join('|')] ||
        packageDisplayByKey[[packageType, 'NONE', lens.model_group || ''].join('|')] ||
        packageDisplayByType[packageType] || packageType;

      const eventDate = event.event_date || '';
      const isPastEvent = eventDate ? kkIsPastEventDate_(eventDate) : false;
      const isFinalStatus = ['cancelled', 'completed', 'no_show'].includes(status);
      const isCancelled = status === 'cancelled';
      const isActiveHold = kkActiveHold_(status);
      const isWorkflowOpen = ['pending', 'confirmed', 'prepared', 'picked_up', 'returned', 'uploaded'].includes(status);
      const shouldShowCurrent = !isFinalStatus && isWorkflowOpen;

      return {
        row_number: o.row_number,
        booking_id: r[0] || '',
        created_at: kkApiDateTime_(r[1]),
        booking_status: r[2] || '',
        event_id: eventId,
        event_name: event.event_name || eventId,
        event_date: event.event_date || '',
        venue: event.venue || '',
        customer_name: r[4] || '',
        customer_contact: r[5] || '',
        customer_phone: r[6] || '',
        contact_channel: r[7] || '',
        package_type: packageType,
        package_display: packageDisplay,
        phone_asset_id: phoneId,
        phone_model_display: phone.model_display || phoneId || '',
        phone_model_group: phone.model_group || '',
        lens_asset_id: lensId,
        lens_model_display: lens.model_display || lensId || '',
        lens_model_group: lens.model_group || '',
        pickup_time: r[11] || '',
        payment_status: r[13] || '',
        amount_received: r[14] || 0,
        work_task: work_task,
        is_cancelled: isCancelled,
        is_past_event: isPastEvent,
        is_active_hold: isActiveHold,
        should_show_current: shouldShowCurrent,
        note: kkBookingNoteForDisplay_(r[19])
      };
    }).reverse();

  const currentBookings = bookings.filter(b => b.should_show_current);

  const todayKey = kkApiDate_(new Date());
  const todayWorking = bookings
    .filter(b => b.event_date === todayKey && !['cancelled','completed','no_show'].includes(String(b.booking_status || '').toLowerCase()))
    .sort((a, b) => String(a.pickup_time || '').localeCompare(String(b.pickup_time || '')));

  const webReady = kkApiWebReadyRows_();
  const webPackages = kkApiWebPackageRows_();

  const health = kkGetValues_(KK.health, 5, 1, 4)
    .filter(r => r.some(v => v !== '' && v !== null))
    .map(r => ({ check: r[0] || '', status: r[1] || '', detail: r[2] || '', note: r[3] || '' }));

  const customerStats = kkReadCustomerStats_();
  const phase1Diagnostics = kkPhase1Diagnostics_(payload || {});

  return { data: {
    events: events,
    packages: packages,
    overrides: overrides,
    assets: assets,
    bookings: bookings,
    current_bookings: currentBookings,
    web_ready: webReady,
    web_packages: webPackages,
    today_working: todayWorking,
    today_key: todayKey,
    model_master: Object.keys(modelMap).map(k => modelMap[k]),
    customers: customerStats,
    health: health,
    generated_at: kkApiDateTime_(new Date()),
    spreadsheet_id: SpreadsheetApp.getActive().getId(),
    admin_api_version: KK_ADMIN_VERSION,
    frontend_sheet_id: phase1Diagnostics.frontend_sheet_id || '',
    phase1_diagnostics: phase1Diagnostics,
    performance: {
      snapshot_ms: Date.now() - snapshotStartedAt,
      lens_patch_ready: lensPatchReady,
      range_mode: 'trimmed-by-leading-columns'
    }
  } };
}

function kkApiVerifyEventWebReady_(eventId, expectedPosterUrl) {
  SpreadsheetApp.flush();
  const result = { web_ready_found: false, web_ready_poster_url: '', web_ready_action: '', web_ready_row_number: 0, web_ready_warning: '' };
  const id = String(eventId || '').trim();
  if (!id) return result;

  const rows = kkGetValues_(KK.webReady, 5, 1, 11);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() !== id) continue;
    result.web_ready_found = true;
    result.web_ready_poster_url = String(rows[i][4] || '').trim();
    result.web_ready_action = String(rows[i][9] || '').trim();
    result.web_ready_row_number = i + 5;
    break;
  }
  const expected = String(expectedPosterUrl || '').trim();
  if (expected && result.web_ready_found && !result.web_ready_poster_url) {
    result.web_ready_warning = 'Poster saved to 01_Events, but 08_Web_Ready poster_image_url is still blank. Check formulas in 08_Web_Ready column E.';
  }
  return result;
}

function kkNormalizeCreateEventOverrides_(rawOverrides) {
  if (rawOverrides === '' || rawOverrides === null || typeof rawOverrides === 'undefined') return [];
  let overrides = rawOverrides;
  if (typeof rawOverrides === 'string') {
    try { overrides = rawOverrides.trim() ? JSON.parse(rawOverrides) : []; }
    catch (err) { throw new Error('event_price_overrides must be valid JSON'); }
  }
  if (!Array.isArray(overrides)) throw new Error('event_price_overrides must be an array');
  const seen = {};
  return overrides.map(item => {
    const templateId = String(item && item.template_id || '').trim();
    if (!templateId) throw new Error('event_price_overrides has missing template_id');
    if (seen[templateId]) throw new Error('Duplicate price override template_id: ' + templateId);
    seen[templateId] = true;
    const pkg = kkGetPackageByTemplateId_(templateId);
    if (!pkg.active) throw new Error('Cannot override inactive package: ' + templateId);

    const hasOverridePrice = !(item.override_price === '' || item.override_price === null || typeof item.override_price === 'undefined');
    const overridePrice = hasOverridePrice ? kkApiNumber_(item.override_price, 'override_price', false) : '';
    const activeOverride = kkApiBoolOrBlank_(item.active_override);
    const overrideNote = item.override_note === undefined ? '' : String(item.override_note || '');
    const sortOrderOverride = item.sort_order_override === undefined || item.sort_order_override === '' ? '' : kkApiNumber_(item.sort_order_override, 'sort_order_override', false);
    const useCaseOverride = item.use_case_override === undefined ? '' : String(item.use_case_override || '');

    if (overridePrice === '' && activeOverride === '' && !overrideNote && sortOrderOverride === '' && !useCaseOverride) return null;
    return { template_id: templateId, override_price: overridePrice, active_override: activeOverride, override_note: overrideNote, sort_order_override: sortOrderOverride, use_case_override: useCaseOverride };
  }).filter(Boolean);
}

function kkWriteEventOverrides_(eventId, overrides) {
  if (!overrides || !overrides.length) return 0;
  const sh = kkSheet_(KK.overrides);
  let count = 0;
  overrides.forEach(o => {
    let row = kkFindOverrideRow_(eventId, o.template_id);
    if (!row) row = kkFirstEmptyRow_(KK.overrides, 1, 5, 1, 7);
    sh.getRange(row, 1, 1, 7).setValues([[eventId, o.template_id, o.override_price, o.active_override, o.override_note, o.sort_order_override, o.use_case_override]]);
    count++;
  });
  return count;
}

function kkApplyCreateEventOverridePricesToWebPackages_(eventId, overrides) {
  // Phase 3.9.1 fix:
  // Creating a new event can save 04_Event_Overrides correctly while 09_Web_Packages!H
  // still shows the default price because public package rows/formulas are generated
  // asynchronously by Sheets. Apply only the just-created event/package prices directly
  // to H and never touch other events.
  if (!overrides || !overrides.length) return { attempted: 0, applied: 0, pending: 0 };

  let attempted = 0;
  let applied = 0;
  const pending = [];

  SpreadsheetApp.flush();
  Utilities.sleep(250);

  overrides.forEach(o => {
    attempted++;
    const rows = kkRefreshWebPackagePriceForOverride_(eventId, o.template_id, o.override_price);
    if (rows) {
      applied += rows;
    } else {
      pending.push(o);
    }
  });

  // If 09_Web_Packages rows were not visible on the first pass, wait once and retry
  // only the missing rows. This keeps the create-event flow deterministic without
  // doing a full-column price repair.
  if (pending.length) {
    SpreadsheetApp.flush();
    Utilities.sleep(750);
    for (let i = pending.length - 1; i >= 0; i--) {
      const o = pending[i];
      const rows = kkRefreshWebPackagePriceForOverride_(eventId, o.template_id, o.override_price);
      if (rows) {
        applied += rows;
        pending.splice(i, 1);
      }
    }
  }

  SpreadsheetApp.flush();
  return { attempted: attempted, applied: applied, pending: pending.length };
}

function kkApiUploadPoster_(payload) {
  const folderId = String(PropertiesService.getScriptProperties().getProperty('KK_POSTER_FOLDER_ID') || '').trim();
  if (!folderId) throw new Error('Missing Script Property KK_POSTER_FOLDER_ID. Run KK Admin > CRM: Set Poster Folder ID.');
  const base64 = String(payload.base64 || '').trim();
  const mimeType = String(payload.mimeType || 'image/jpeg').trim().toLowerCase();
  const fileName = String(payload.fileName || ('poster-' + Date.now() + '.jpg')).replace(/[\/:*?"<>|]+/g, '-').slice(0, 120);

  if (!base64) throw new Error('Missing poster file data');
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)) throw new Error('Poster file must be JPG, PNG, or WEBP.');

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > 3 * 1024 * 1024) throw new Error('Poster image is too large. Please use a file below 3 MB.');

  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
  const publicInfo = kkEnsureDriveFilePublic_(file.getId(), { strict: false });
  const posterUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1200';

  return {
    file_id: file.getId(),
    view_url: publicInfo.view_url || file.getUrl(),
    url: posterUrl,
    poster_url: posterUrl,
    public_checked: !!publicInfo.public_checked,
    sharing_warning: publicInfo.sharing_warning || ''
  };
}

function kkApiCreateEvent_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const eventName = String(payload.event_name || '').trim();
    const eventDate = payload.event_date;
    const venue = String(payload.venue || '').trim();
    const posterInfo = kkPosterForWrite_(payload.poster_url || '');
    const poster = posterInfo.url;
    const status = String(payload.status || 'open').toLowerCase().trim();
    const active = payload.active_on_web === undefined ? true : kkIsTrue_(payload.active_on_web);
    const note = payload.note || '';
    if (!eventName || !eventDate || !venue) throw new Error('Please fill event_name, event_date and venue');
    if (!['open', 'closed'].includes(status)) throw new Error('status must be open or closed');
    kkEnsureAdminLogSheets_();
    kkAssertCreateEventHistoryAllowed_(eventName, eventDate, venue);
    const priceOverrides = kkNormalizeCreateEventOverrides_(payload.event_price_overrides);
    const eventId = kkGenerateUniqueEventId_(eventName, eventDate);
    const row = kkFirstEmptyRow_(KK.events, 1, 5, 1, 8);
    const sh = kkSheet_(KK.events);
    sh.getRange(row, 1, 1, 8).setValues([[eventId, eventName, kkDateObj_(eventDate), venue, poster, status, active, note]]);
    const visibilityHistory = kkUpsertVisibilityLock_(eventId, eventName, eventDate, venue, active ? 'SEEN_CORE' : 'LOCKED', payload);
    const overridesCreated = kkWriteEventOverrides_(eventId, priceOverrides);
    const createOverrideApply = kkApplyCreateEventOverridePricesToWebPackages_(eventId, priceOverrides);
    SpreadsheetApp.flush();
    const savedPoster = String(sh.getRange(row, 5).getValue() || '').trim();
    if (poster && !savedPoster) throw new Error('Poster uploaded, but poster_url was not written to 01_Events. Please try saving again.');
    const webReady = kkApiVerifyEventWebReady_(eventId, savedPoster);
    return Object.assign({
      event_id: eventId, row_number: row, poster_url: savedPoster, overrides_created: overridesCreated,
      visibility_history_state: visibilityHistory.lock_state,
      create_override_price_rows_applied: createOverrideApply.applied, create_override_price_rows_pending: createOverrideApply.pending,
      poster_drive_file_id: posterInfo.drive_file_id || '', poster_public_checked: !!posterInfo.public_checked, poster_public_warning: posterInfo.sharing_warning || ''
    }, webReady);
  } finally {
    lock.releaseLock();
  }
}


function kkSnapshotWebPackagePricesForEvent_(eventId) {
  const eid = String(eventId || '').trim();
  const snapshot = [];
  if (!eid) return snapshot;
  const rows = kkGetValues_(KK.webPackages, 5, 1, 14);
  const sheet = kkSheet_(KK.webPackages);
  rows.forEach((row, idx) => {
    if (String(row[1] || '').trim() !== eid) return;
    const sheetRow = idx + 5;
    const cell = sheet.getRange(sheetRow, 8); // 09_Web_Packages!H price
    snapshot.push({ row: sheetRow, value: cell.getValue(), formula: cell.getFormula() });
  });
  return snapshot;
}

function kkRestoreWebPackagePricesForEvent_(snapshot) {
  if (!snapshot || !snapshot.length) return 0;
  const sheet = kkSheet_(KK.webPackages);
  let restored = 0;
  snapshot.forEach(item => {
    if (!item || !item.row) return;
    const cell = sheet.getRange(item.row, 8); // 09_Web_Packages!H price
    // Preserve exactly what was visible before poster/event update.
    // If it was a manually applied override value, keep that value.
    // If it was still a formula, keep the formula.
    if (item.formula) cell.setFormula(item.formula);
    else cell.setValue(item.value);
    restored++;
  });
  if (restored) SpreadsheetApp.flush();
  return restored;
}

function kkApiUpdateEvent_(payload) {
  const lock = kkAcquireDocumentLock_('update event', 12000);
  try {
    const eventId = String(payload.event_id || '').trim();
    if (!eventId) throw new Error('event_id is required');
    const priceSnapshot = kkSnapshotWebPackagePricesForEvent_(eventId);
    const sh = kkSheet_(KK.events);
    const rows = kkGetValues_(KK.events, 5, 1, 8);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() !== eventId) continue;
      const rowNumber = i + 5;
      const current = rows[i].slice();
      if (payload.event_name) current[1] = String(payload.event_name).trim();
      if (payload.event_date) {
        const nextEventDate = kkDateObj_(payload.event_date);
        kkAssertEventDateChangeSafe_(eventId, nextEventDate);
        current[2] = nextEventDate;
      }
      if (payload.venue) current[3] = String(payload.venue).trim();
      const posterInfo = payload.poster_url ? kkPosterForWrite_(payload.poster_url) : { url: '', drive_file_id: '', public_checked: false };
      if (payload.poster_url) current[4] = posterInfo.url;
      if (payload.status) {
        const nextEventStatus = String(payload.status).toLowerCase().trim();
        if (!['open', 'closed'].includes(nextEventStatus)) throw new Error('status must be open or closed');
        current[5] = nextEventStatus;
      }
      const active = kkApiBoolOrBlank_(payload.active_on_web);
      const currentActive = kkIsTrue_(current[6]);
      const ownerReopenIntent = String(payload.visibility_owner_intent || '').trim() === 'explicit_owner_reopen';
      const visibilityHistory = kkFindVisibilityHistory_(eventId, current[1], current[2], current[3]);
      if (active === true && visibilityHistory && visibilityHistory.lock_state === 'LOCKED' && !ownerReopenIntent) {
        throw new Error('EVENT_VISIBILITY_TOMBSTONE_LOCKED: owner-hidden event requires explicit owner reopen intent');
      }
      if (currentActive === false && active === true && !ownerReopenIntent) {
        throw new Error('EVENT_VISIBILITY_OWNER_LOCKED: owner-hidden event requires explicit owner reopen intent');
      }
      if (active !== '') current[6] = active;
      if (payload.note !== undefined && payload.note !== '') current[7] = payload.note;
      sh.getRange(rowNumber, 1, 1, 8).setValues([current]);
      let visibilityLockState = '';
      if (active === false) {
        visibilityLockState = kkUpsertVisibilityLock_(eventId, current[1], current[2], current[3], 'LOCKED', payload).lock_state;
      } else if (active === true && ownerReopenIntent) {
        visibilityLockState = kkUpsertVisibilityLock_(eventId, current[1], current[2], current[3], 'REOPENED', payload).lock_state;
      }
      SpreadsheetApp.flush();
      const savedPoster = String(sh.getRange(rowNumber, 5).getValue() || '').trim();
      if (payload.poster_url && !savedPoster) throw new Error('Poster uploaded, but poster_url was not written to 01_Events. Please try saving again.');
      const restoredWebPrices = kkRestoreWebPackagePricesForEvent_(priceSnapshot);
      const webReady = kkApiVerifyEventWebReady_(eventId, savedPoster);
      return Object.assign({
        event_id: eventId, row_number: rowNumber, poster_url: savedPoster,
        poster_drive_file_id: posterInfo.drive_file_id || '', poster_public_checked: !!posterInfo.public_checked, poster_public_warning: posterInfo.sharing_warning || '',
        web_package_prices_preserved: restoredWebPrices,
        visibility_lock_state: visibilityLockState
      }, webReady);
    }
    throw new Error('Event not found: ' + eventId);
  } finally {
    lock.releaseLock();
  }
}

function kkGenerateUniqueTemplateId_(displayName) {
  const base = 'TPL-' + kkSlug_(displayName);
  const existing = kkGetValues_(KK.packages, 5, 1, 1).flat().map(v => String(v || '').trim()).filter(String);
  if (!existing.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const id = base + '-' + i;
    if (!existing.includes(id)) return id;
  }
  throw new Error('Cannot generate unique template_id');
}

function kkApiCreatePackage_(payload) {
  const lock = kkAcquireDocumentLock_('create package', 12000);
  try {
    const displayName = String(payload.display_name || '').trim();
    if (!displayName) throw new Error('display_name is required');
    const templateId = String(payload.template_id || '').trim() || kkGenerateUniqueTemplateId_(displayName);
    const modelGroup = String(payload.model_group || 'NONE').trim() || 'NONE';
    const packageType = String(payload.package_type || '').toLowerCase().trim();
    const lensGroup = String(payload.lens_group || 'NONE').trim() || 'NONE';
    const standardPrice = kkApiNumber_(payload.standard_price, 'standard_price', false);
    const active = payload.active === undefined ? true : kkIsTrue_(payload.active);
    const useCase = payload.use_case || '';
    if (!['phone_only', 'lens_only', 'phone_lens_bundle'].includes(packageType)) throw new Error('package_type must be phone_only, lens_only or phone_lens_bundle');
    if ((packageType === 'phone_only' || packageType === 'phone_lens_bundle') && (!modelGroup || modelGroup === 'NONE')) throw new Error('model_group is required for phone packages');
    if ((packageType === 'lens_only' || packageType === 'phone_lens_bundle') && (!lensGroup || lensGroup === 'NONE')) throw new Error('lens_group is required for lens packages');
    if (packageType === 'phone_only' || packageType === 'phone_lens_bundle') kkAssertModelGroupType_(modelGroup, 'phone');
    if (packageType === 'lens_only' || packageType === 'phone_lens_bundle') kkAssertModelGroupType_(lensGroup, 'lens');

    const existing = kkGetValues_(KK.packages, 5, 1, 1).flat().map(v => String(v || '').trim());
    if (existing.includes(templateId)) throw new Error('template_id already exists: ' + templateId);
    const row = kkFirstEmptyRow_(KK.packages, 1, 5, 1, 10);
    kkSheet_(KK.packages).getRange(row, 1, 1, 10).setValues([[templateId, modelGroup, packageType, lensGroup, standardPrice, displayName, '', active, '', useCase]]);
    SpreadsheetApp.flush();
    return { template_id: templateId, row_number: row };
  } finally {
    lock.releaseLock();
  }
}

function kkApiUpdatePackage_(payload) {
  const lock = kkAcquireDocumentLock_('update package', 12000);
  try {
    const templateId = String(payload.template_id || '').trim();
    if (!templateId) throw new Error('template_id is required');
    const sh = kkSheet_(KK.packages);
    const rows = kkGetValues_(KK.packages, 5, 1, 10);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() !== templateId) continue;
      const rowNumber = i + 5;
      const current = rows[i].slice();
      if (payload.standard_price !== '' && payload.standard_price !== undefined) current[4] = kkApiNumber_(payload.standard_price, 'standard_price', false);
      if (payload.display_name) current[5] = String(payload.display_name).trim();
      const active = kkApiBoolOrBlank_(payload.active);
      if (active !== '') current[7] = active;
      if (payload.use_case !== undefined && payload.use_case !== '') current[9] = payload.use_case;
      sh.getRange(rowNumber, 1, 1, 10).setValues([current]);
      SpreadsheetApp.flush();
      return { template_id: templateId, row_number: rowNumber };
    }
    throw new Error('Package not found: ' + templateId);
  } finally {
    lock.releaseLock();
  }
}

function kkFindOverrideRows_(eventId, templateId) {
  const eid = String(eventId || '').trim();
  const tid = String(templateId || '').trim();
  const rows = kkGetValues_(KK.overrides, 5, 1, 2);
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === eid && String(rows[i][1] || '').trim() === tid) matches.push(i + 5);
  }
  return matches;
}

function kkFindOverrideRow_(eventId, templateId) {
  const matches = kkFindOverrideRows_(eventId, templateId);
  // IMPORTANT: price formulas use LOOKUP/latest matching override row.
  // Therefore edit the latest row, not the first, otherwise Admin may show the new
  // value from row 1 while 09_Web_Packages still applies a later duplicate row.
  return matches.length ? matches[matches.length - 1] : 0;
}

function kkClearOlderOverrideDuplicates_(eventId, templateId, keepRow) {
  const matches = kkFindOverrideRows_(eventId, templateId).filter(r => Number(r) !== Number(keepRow));
  if (!matches.length) return 0;
  const sh = kkSheet_(KK.overrides);
  matches.forEach(r => sh.getRange(r, 1, 1, 7).clearContent());
  return matches.length;
}

function kkApiUpsertEventOverride_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const eventId = String(payload.event_id || '').trim();
    let templateId = String(payload.template_id || '').trim();
    if (!eventId || !templateId) throw new Error('Please select event and package');
    kkGetEventById_(eventId);
    templateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);
    kkGetPackageByTemplateId_(templateId);
    
    const hasOverridePrice = !(payload.override_price === '' || payload.override_price === null || typeof payload.override_price === 'undefined');
    const overridePrice = hasOverridePrice ? kkApiNumber_(payload.override_price, 'override_price', false) : '';
    const activeOverride = kkApiBoolOrBlank_(payload.active_override);
    const overrideNote = payload.override_note === undefined ? '' : String(payload.override_note || '');
    const sortOrderOverride = payload.sort_order_override === undefined || payload.sort_order_override === '' ? '' : kkApiNumber_(payload.sort_order_override, 'sort_order_override', false);
    const useCaseOverride = payload.use_case_override === undefined ? '' : String(payload.use_case_override || '');
    
    const sh = kkSheet_(KK.overrides);
    let row = kkFindOverrideRow_(eventId, templateId);
    if (!row) row = kkFirstEmptyRow_(KK.overrides, 1, 5, 1, 7);
    sh.getRange(row, 1, 1, 7).setValues([[eventId, templateId, overridePrice, activeOverride, overrideNote, sortOrderOverride, useCaseOverride]]);
    const duplicate_overrides_cleared = kkClearOlderOverrideDuplicates_(eventId, templateId, row);
    const refreshedWebPriceRows = kkRefreshWebPackagePriceForOverride_(eventId, templateId, overridePrice);
    SpreadsheetApp.flush();
    if (refreshedWebPriceRows) Utilities.sleep(250);
    return { event_id: eventId, template_id: templateId, row_number: row, override_price: overridePrice, active_override: activeOverride, use_case_override: useCaseOverride, duplicate_overrides_cleared: duplicate_overrides_cleared, web_price_rows_refreshed: refreshedWebPriceRows };
  } finally {
    lock.releaseLock();
  }
}


function kkApiBulkSetEventPackageVisibility_(payload) {
  const lock = kkAcquireDocumentLock_('bulk event package visibility', 12000);
  try {
    const eventId = String(payload.event_id || '').trim();
    const mode = String(payload.mode || '').toLowerCase().trim();
    if (!eventId) throw new Error('Please select event');
    if (!['hide', 'show', 'inherit'].includes(mode)) throw new Error('mode must be hide, show, or inherit');
    kkGetEventById_(eventId);

    const activeOverride = mode === 'hide' ? false : (mode === 'show' ? true : '');
    const packages = kkGetValues_(KK.packages, 5, 1, 10)
      .filter(r => String(r[0] || '').trim())
      .filter(r => kkIsTrue_(r[7]))
      .filter(r => !kkIsRetiredG2LensGroup_(r[3]))
      .map(r => String(r[0] || '').trim());

    if (!packages.length) throw new Error('No active package master found');

    const sh = kkSheet_(KK.overrides);
    let updated = 0;
    let created = 0;
    let duplicatesCleared = 0;

    packages.forEach(templateId => {
      let row = kkFindOverrideRow_(eventId, templateId);
      let values;
      if (row) {
        values = sh.getRange(row, 1, 1, 7).getValues()[0];
      } else {
        row = kkFirstEmptyRow_(KK.overrides, 1, 5, 1, 7);
        values = [eventId, templateId, '', '', '', '', ''];
        created++;
      }
      // Preserve price, note, sort order and use case. Only change active_override.
      values[0] = eventId;
      values[1] = templateId;
      values[3] = activeOverride;
      sh.getRange(row, 1, 1, 7).setValues([values]);
      duplicatesCleared += kkClearOlderOverrideDuplicates_(eventId, templateId, row);
      updated++;
    });

    SpreadsheetApp.flush();
    Utilities.sleep(250);
    return {
      event_id: eventId,
      mode: mode,
      active_override: activeOverride,
      packages_updated: updated,
      overrides_created: created,
      duplicate_overrides_cleared: duplicatesCleared
    };
  } finally {
    lock.releaseLock();
  }
}

function kkApiAddAssets_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const assetType = String(payload.asset_type || '').toLowerCase().trim();
    const modelGroup = String(payload.model_group || '').trim();
    const qty = Number(payload.quantity || 0);
    const serialPrefix = String(payload.serial_prefix || '').trim();
    const status = String(payload.status || 'available').toLowerCase().trim();
    const notes = payload.notes || '';
    let rentable = payload.rentable === false ? false : true;
    if (!['phone', 'lens'].includes(assetType)) throw new Error('asset_type must be phone or lens');
    if (!['available', 'repair', 'inactive'].includes(status)) throw new Error('status must be available, repair, or inactive');
    if (status !== 'available') rentable = false;
    if (!modelGroup || qty < 1 || qty > 50 || Math.floor(qty) !== qty) throw new Error('Please fill model_group and integer quantity 1-50');
    kkAssertModelGroupType_(modelGroup, assetType);
    
    const sh = kkSheet_(KK.assets);
    const ids = kkNextAssetIds_(assetType, qty);
    const targetRows = kkEmptyRows_(KK.assets, 1, 5, 1, 7, qty);
    const data = ids.map((id, i) => [id, assetType, modelGroup, serialPrefix ? serialPrefix + '-' + String(i + 1).padStart(3, '0') : '', status, notes, rentable]);
    const contiguous = targetRows.every((row, i) => i === 0 || row === targetRows[i - 1] + 1);
    if (contiguous) sh.getRange(targetRows[0], 1, qty, 7).setValues(data);
    else targetRows.forEach((row, i) => sh.getRange(row, 1, 1, 7).setValues([data[i]]));
    return { asset_ids: ids, rows: targetRows };
  } finally {
    lock.releaseLock();
  }
}

function kkFindAssetRow_(assetId) {
  const key = String(assetId || '').trim();
  if (!key) throw new Error('asset_id is required');
  const values = kkGetValues_(KK.assets, 5, 1, 1).flat();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i] || '').trim() === key) return i + 5;
  }
  throw new Error('Asset not found: ' + key);
}

function kkActiveBookingWarningForAsset_(assetId) {
  const key = String(assetId || '').trim();
  if (!key) return '';
  const rows = kkGetValues_(KK.bookings, 5, 1, 20);
  let count = 0;
  rows.forEach(r => {
    const status = String(r[2] || '').toLowerCase().trim();
    if (!kkActiveHold_(status)) return;
    if (String(r[9] || '').trim() === key || String(r[10] || '').trim() === key) count++;
  });
  return count ? 'Asset นี้ยังถูกผูกกับ booking ที่ยัง active ' + count + ' รายการ ถ้าเปลี่ยนเป็น repair/inactive ควร reassign booking ด้วย' : '';
}

function kkApiUpdateAsset_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const assetId = String(payload.asset_id || '').trim();
    const status = String(payload.status || '').toLowerCase().trim();
    if (!assetId) throw new Error('asset_id is required');
    if (!['available', 'repair', 'inactive'].includes(status)) throw new Error('status must be available, repair, or inactive');
    const hasRentable = payload.rentable !== undefined;
    const row = kkFindAssetRow_(assetId);
    const sh = kkSheet_(KK.assets);
    const current = sh.getRange(row, 1, 1, 7).getValues()[0];
    let rentable = hasRentable ? kkIsTrue_(payload.rentable) : kkIsTrue_(current[6]);
    if (status !== 'available') rentable = false;
    sh.getRange(row, 5).setValue(status);
    sh.getRange(row, 7).setValue(rentable);
    SpreadsheetApp.flush();
    const warning = status !== 'available' ? kkActiveBookingWarningForAsset_(assetId) : '';
    return { asset_id: assetId, row_number: row, status: status, rentable: rentable, active_booking_warning: warning };
  } finally {
    lock.releaseLock();
  }
}


function kkAssetUsageSummary_(assetId) {
  const key = String(assetId || '').trim();
  const summary = { current_total: 0, current_active: 0, archive_total: 0 };
  if (!key) return summary;

  const bookingRows = kkGetValues_(KK.bookings, 5, 1, 20);
  bookingRows.forEach(r => {
    const phoneId = String(r[9] || '').trim();
    const lensId = String(r[10] || '').trim();
    if (phoneId !== key && lensId !== key) return;
    summary.current_total += 1;
    const status = String(r[2] || '').toLowerCase().trim();
    if (kkActiveHold_(status) || ['returned', 'uploaded'].includes(status)) summary.current_active += 1;
  });

  const archiveSheet = SpreadsheetApp.getActive().getSheetByName(KK.bookingArchive);
  if (archiveSheet) {
    const lastRow = archiveSheet.getLastRow();
    const lastCol = archiveSheet.getLastColumn();
    if (lastRow >= 2 && lastCol >= 1) {
      const rows = archiveSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      rows.forEach(r => {
        if (r.some(v => String(v || '').trim() === key)) summary.archive_total += 1;
      });
    }
  }
  return summary;
}

function kkApiDeleteAsset_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const assetId = String(payload.asset_id || '').trim();
    if (!assetId) throw new Error('asset_id is required');
    const row = kkFindAssetRow_(assetId);
    const usage = kkAssetUsageSummary_(assetId);
    if (usage.current_active > 0) {
      throw new Error('ลบไม่ได้: Asset นี้ยังผูกกับ booking ที่ยัง active อยู่ ' + usage.current_active + ' รายการ ให้ย้าย asset ออกจาก booking หรือเปลี่ยนเป็น inactive ก่อน');
    }
    if (usage.current_total > 0 || usage.archive_total > 0) {
      throw new Error('ลบไม่ได้: Asset นี้เคยถูกใช้ในประวัติ booking แล้ว เพื่อไม่ให้ประวัติ CRM/รายงานเพี้ยน ให้เปลี่ยน Status เป็น inactive และ Rentable เป็นปิดแทน');
    }
    const sh = kkSheet_(KK.assets);
    sh.getRange(row, 1, 1, 7).clearContent();
    SpreadsheetApp.flush();
    return { asset_id: assetId, deleted: true, row_number: row, usage: usage };
  } finally {
    lock.releaseLock();
  }
}

function kkIsPastEventDate_(value) {
  if (!value) return true;
  const d = kkDateObj_(value);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

function kkIsCurrentOrFutureEventDate_(value) {
  if (!value) return false;
  return !kkIsPastEventDate_(value);
}


function kkFindBookingRow_(rowNumber, bookingId) {
  const sh = kkSheet_(KK.bookings);
  const id = String(bookingId || '').trim();

  // booking_id is the stable identity. row_number from public GViz snapshots is
  // only a display hint because GViz can collapse physical blank rows.
  if (id) {
    const values = kkGetValues_(KK.bookings, 5, 1, 1);
    const matches = [];
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === id) matches.push(i + 5);
    }
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new Error('Duplicate booking_id: ' + id);
    throw new Error('Booking not found: ' + id);
  }

  const n = Number(rowNumber || 0);
  if (n >= 5 && n <= sh.getMaxRows()) {
    const rowValues = sh.getRange(n, 1, 1, 4).getValues()[0];
    if (!rowValues[0] && !rowValues[3]) throw new Error('Booking row is empty: ' + n);
    return n;
  }
  throw new Error('booking_id or row_number is required');
}

function kkAssertBookingAssetsNotDoubleBooked_(rowNumber, bookingRow, nextStatus) {
  if (!kkActiveHold_(nextStatus)) return;
  const eventId = String(bookingRow[3] || '').trim();
  const phoneId = String(bookingRow[9] || '').trim();
  const lensId = String(bookingRow[10] || '').trim();
  if (!eventId) throw new Error('Booking missing event_id');
  const event = kkGetEventById_(eventId);
  const booked = kkBookedAssetIdsForDate_(event.event_date, rowNumber);
  if (phoneId && booked.phone[phoneId]) throw new Error('Cannot reactivate booking: phone is already booked on this event date: ' + phoneId);
  if (lensId && booked.lens[lensId]) throw new Error('Cannot reactivate booking: lens is already booked on this event date: ' + lensId);
}


function kkBookingRequestId_(payload) {
  const requestId = String(payload && payload.request_id || '').trim();
  if (!requestId) return '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) throw new Error('Invalid booking request_id');
  return requestId;
}

function kkBookingRequestMarker_(requestId) {
  return requestId ? '[KK_REQ:' + requestId + ']' : '';
}

function kkBookingNoteWithRequest_(note, requestId) {
  const base = String(note || '').replace(/\s*\[KK_REQ:[A-Za-z0-9._:-]{8,128}\]\s*/g, ' ').trim();
  const marker = kkBookingRequestMarker_(requestId);
  return marker ? (base ? base + ' ' + marker : marker) : base;
}

function kkBookingNoteForDisplay_(note) {
  return String(note || '').replace(/\s*\[KK_REQ:[A-Za-z0-9._:-]{8,128}\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function kkBookingRequestIdFromNote_(note) {
  const m = String(note || '').match(/\[KK_REQ:([A-Za-z0-9._:-]{8,128})\]/);
  return m ? m[1] : '';
}

function kkFindBookingByRequestId_(requestId) {
  const marker = kkBookingRequestMarker_(requestId);
  if (!marker) return null;
  const rows = kkGetValues_(KK.bookings, 5, 1, 20);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    if (String(row[19] || '').indexOf(marker) < 0) continue;
    return { row_number: i + 5, row: row };
  }
  return null;
}

function kkBookingIdValues_() {
  const ids = [];
  kkGetValues_(KK.bookings, 5, 1, 1).forEach(r => {
    const id = String(r[0] || '').trim();
    if (id) ids.push(id);
  });
  const archive = SpreadsheetApp.getActive().getSheetByName(KK.bookingArchive);
  if (archive && archive.getLastRow() >= 2) {
    archive.getRange(2, 7, archive.getLastRow() - 1, 1).getValues().forEach(r => {
      const id = String(r[0] || '').trim();
      if (id) ids.push(id);
    });
  }
  return ids;
}

function kkGenerateUniqueBookingId_(eventDate) {
  const day = kkDateKey_(eventDate);
  const prefix = 'BK-' + day + '-';
  let maxSeq = 0;
  const used = {};
  kkBookingIdValues_().forEach(id => {
    used[id] = true;
    if (id.indexOf(prefix) !== 0) return;
    const suffix = id.slice(prefix.length);
    if (/^\d+$/.test(suffix)) maxSeq = Math.max(maxSeq, Number(suffix));
  });
  for (let seq = maxSeq + 1; seq < maxSeq + 10000; seq++) {
    const candidate = prefix + String(seq).padStart(3, '0');
    if (!used[candidate]) return candidate;
  }
  throw new Error('Unable to allocate unique booking_id for ' + day);
}

function kkBookingCreateResult_(rowNumber, row, replay) {
  const current = row || [];
  const bookingId = String(current[0] || '').trim();
  if (!bookingId) throw new Error('Booking canonical booking_id readback failed');
  return {
    row_number: rowNumber,
    booking_id: bookingId,
    booking_status: current[2] || '',
    phone_asset_id: current[9] || '',
    lens_asset_id: current[10] || '',
    idempotent_replay: replay === true
  };
}

function kkBookingArchiveIdentity_(bookingRow, eventDateOverride) {
  const r = bookingRow || [];
  const customerKey = kkCustomerKey_(r[4], r[5], r[6]);
  const created = r[1] instanceof Date ? r[1].getTime() : String(r[1] || '').trim();
  const eventDate = eventDateOverride instanceof Date ? eventDateOverride.getTime() : String(eventDateOverride || '').trim();
  return [
    String(r[0] || '').trim(),
    String(r[3] || '').trim(),
    customerKey,
    created,
    eventDate
  ].join('|');
}

function kkRebuildCustomerStatsFromArchive_() {
  kkEnsureCrmArchiveSheets_();
  const archive = kkSheet_(KK.bookingArchive);
  const stats = kkSheet_(KK.customerStats);
  const lastRow = archive.getLastRow();
  const rows = lastRow >= 2 ? archive.getRange(2, 1, lastRow - 1, Math.max(26, archive.getLastColumn())).getValues() : [];
  const seen = {};
  const byCustomer = {};

  rows.forEach(a => {
    // Archive metadata A:F, original booking A:T starts at G.
    const booking = a.slice(6, 26);
    const status = String(booking[2] || '').toLowerCase().trim();
    if (!['picked_up', 'returned', 'uploaded', 'completed'].includes(status)) return;
    const customerKey = String(a[5] || '').trim() || kkCustomerKey_(booking[4], booking[5], booking[6]);
    if (!customerKey) return;
    const eventDate = a[3] || booking[1] || '';
    const identity = kkBookingArchiveIdentity_(booking, eventDate);
    if (seen[identity]) return;
    seen[identity] = true;

    const rentalDate = eventDate ? kkDateObj_(eventDate) : (booking[1] ? kkDateObj_(booking[1]) : new Date());
    let item = byCustomer[customerKey];
    if (!item) {
      item = byCustomer[customerKey] = {
        key: customerKey,
        name: booking[4] || '',
        contact: booking[5] || '',
        phone: booking[6] || '',
        count: 0,
        first: rentalDate,
        last: rentalDate,
        lastEvent: a[2] || '',
        lastStatus: booking[2] || ''
      };
    }
    item.count++;
    if (rentalDate < item.first) item.first = rentalDate;
    if (rentalDate >= item.last) {
      item.last = rentalDate;
      item.lastEvent = a[2] || item.lastEvent;
      item.lastStatus = booking[2] || item.lastStatus;
    }
    if (booking[4]) item.name = booking[4];
    if (booking[5]) item.contact = booking[5];
    if (booking[6]) item.phone = booking[6];
  });

  const output = Object.keys(byCustomer).sort().map(key => {
    const x = byCustomer[key];
    return [x.key, x.name, x.contact, x.phone, x.count, x.first, x.last, x.lastEvent, x.lastStatus, new Date()];
  });

  if (stats.getLastRow() >= 2) stats.getRange(2, 1, stats.getLastRow() - 1, 10).clearContent();
  if (output.length) stats.getRange(2, 1, output.length, 10).setValues(output);
  return output.length;
}

function kkLineBookingRequestKey_(requestId) {
  const id = String(requestId || '').trim();
  if (!/^line:[a-f0-9]{48}$/.test(id)) throw new Error('Invalid deterministic LINE request_id');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id, Utilities.Charset.UTF_8);
  return 'KK_LINE_BOOKING_REQ_' + digest.map(function(b) {
    return ('0' + ((b + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function kkLineBookingClaimReadback_(claim) {
  const row = Number(claim && claim.row_number || 0);
  const bookingId = String(claim && claim.booking_id || '').trim();
  if (!Number.isInteger(row) || row < 5 || !bookingId) return null;
  const sh = kkSheet_(KK.bookings);
  const readback = sh.getRange(row, 1, 1, 20).getValues()[0];
  if (String(readback[0] || '').trim() !== bookingId) return null;
  if (String(readback[2] || '').toLowerCase().trim() !== 'pending') return null;
  if (String(readback[3] || '').trim() !== String(claim.event_id || '').trim()) return null;
  if (String(readback[4] || '').trim() !== String(claim.customer_name || '').trim()) return null;
  if (String(readback[6] || '').trim() !== String(claim.customer_phone || '').trim()) return null;
  if (String(readback[7] || '').toUpperCase().trim() !== 'LINE') return null;
  if (String(readback[9] || '').trim() || String(readback[10] || '').trim()) return null;
  if (String(readback[13] || '').toLowerCase().trim() !== 'unpaid') return null;
  if (Number(readback[14] || 0) !== 0) return null;
  if (kkBookingRequestIdFromNote_(readback[19]) !== String(claim.request_id || '').trim()) return null;
  return { row_number: row, row: readback };
}

function kkApiCreateLineBookingPending_(payload) {
  const lock = kkAcquireDocumentLock_('LINE pending booking intake', 12000);
  try {
    const requestId = String(payload.request_id || '').trim();
    const requestKey = kkLineBookingRequestKey_(requestId);
    const props = PropertiesService.getScriptProperties();
    const existingRaw = String(props.getProperty(requestKey) || '').trim();
    if (existingRaw) {
      let existing = null;
      try { existing = JSON.parse(existingRaw); } catch (_) {}
      if (existing && existing.status === 'OK' && existing.booking_id) {
        return {
          row_number: Number(existing.row_number || 0),
          booking_id: String(existing.booking_id),
          booking_status: 'pending',
          payment_status: 'unpaid',
          phone_asset_id: '',
          lens_asset_id: '',
          request_id: requestId,
          idempotent_replay: true
        };
      }
      if (existing && existing.status === 'PENDING') {
        const reconciled = kkLineBookingClaimReadback_(existing);
        if (reconciled) {
          props.setProperty(requestKey, JSON.stringify({
            status: 'OK',
            request_id: requestId,
            booking_id: String(existing.booking_id),
            row_number: reconciled.row_number,
            event_id: String(existing.event_id || ''),
            template_id: String(existing.template_id || ''),
            completed_at: new Date().toISOString(),
            reconciled: true
          }));
          return {
            row_number: reconciled.row_number,
            booking_id: String(existing.booking_id),
            booking_status: 'pending',
            payment_status: 'unpaid',
            phone_asset_id: '',
            lens_asset_id: '',
            request_id: requestId,
            idempotent_replay: true,
            reconciled: true
          };
        }
      }
      throw new Error('LINE booking request is pending or uncertain; exact readback did not reconcile safely');
    }

    const eventId = String(payload.event_id || '').trim();
    let templateId = String(payload.template_id || '').trim();
    const customerName = String(payload.customer_name || '').trim();
    const customerPhone = String(payload.customer_phone || '').trim();
    // A verified LINE contact identifies international customers without a phone.
    // Caller identity is enforced upstream; keep canonical customer_contact mandatory.
    const customerContact = String(payload.customer_contact || '').trim();
    const pickupTime = String(payload.pickup_time || '').trim();
    if (!eventId || !templateId || !customerName || !customerContact) {
      throw new Error('LINE booking requires event_id, template_id, customer_name and customer_contact');
    }
    if (payload.phone_asset_id || payload.lens_asset_id) {
      throw new Error('Pending LINE intake must not assign physical assets');
    }

    templateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);
    const event = kkGetEventById_(eventId);
    if (kkIsPastEventDate_(event.event_date)) throw new Error('Cannot create booking for a past event date: ' + kkApiDate_(event.event_date));
    const pkg = kkGetPackageByTemplateId_(templateId);
    if (String(event.status).toLowerCase() !== 'open') throw new Error('Event is not open: ' + eventId);
    if (!event.active) throw new Error('Event is not active_on_web: ' + eventId);
    if (!pkg.active) throw new Error('Package is inactive: ' + templateId);
    kkAssertWebPackageBookable_(eventId, templateId);

    // First claim blocks duplicate redelivery before any Booking mutation.
    props.setProperty(requestKey, JSON.stringify({
      status: 'PENDING',
      request_id: requestId,
      event_id: eventId,
      template_id: templateId,
      customer_name: customerName,
      customer_phone: customerPhone,
      claimed_at: new Date().toISOString()
    }));

    const pkgType = String(pkg.package_type || '').toLowerCase().trim();
    const row = kkFirstEmptyRow_(KK.bookings, 4, 5, 2, 19);
    const bookingId = kkGenerateUniqueBookingId_(event.event_date);
    // Current 9.5.13 schema owns canonical IDs in column A directly. Persist the exact
    // row + canonical ID before setValues so an uncertain write can be reconciled.
    props.setProperty(requestKey, JSON.stringify({
      status: 'PENDING',
      request_id: requestId,
      event_id: eventId,
      template_id: templateId,
      customer_name: customerName,
      customer_phone: customerPhone,
      row_number: row,
      booking_id: bookingId,
      claimed_at: new Date().toISOString()
    }));

    const bookingNote = kkBookingNoteWithRequest_(payload.booking_note || 'LINE webhook intake', requestId);
    const sh = kkSheet_(KK.bookings);
    sh.getRange(row, 1, 1, 20).setValues([[
      bookingId, new Date(), 'pending', eventId, customerName, customerContact, customerPhone, 'LINE',
      pkgType, '', '', pickupTime, '', 'unpaid', 0, '', '', '', 0, bookingNote
    ]]);
    SpreadsheetApp.flush();

    const persisted = kkLineBookingClaimReadback_({
      request_id: requestId,
      event_id: eventId,
      customer_name: customerName,
      customer_phone: customerPhone,
      row_number: row,
      booking_id: bookingId
    });
    if (!persisted) throw new Error('LINE pending booking exact A:T readback failed');

    props.setProperty(requestKey, JSON.stringify({
      status: 'OK',
      request_id: requestId,
      booking_id: bookingId,
      row_number: row,
      event_id: eventId,
      template_id: templateId,
      completed_at: new Date().toISOString()
    }));

    return {
      row_number: row,
      booking_id: bookingId,
      booking_status: 'pending',
      payment_status: 'unpaid',
      phone_asset_id: '',
      lens_asset_id: '',
      request_id: requestId,
      idempotent_replay: false
    };
  } finally {
    lock.releaseLock();
  }
}


function kkApiDecideLineBookingPending_(payload) {
  const lock = kkAcquireDocumentLock_('LINE owner booking decision', 12000);
  try {
    const bookingId = String(payload.booking_id || '').trim();
    const decision = String(payload.decision || '').toLowerCase().trim();
    if (!bookingId) throw new Error('booking_id is required');
    if (!['approve', 'reject'].includes(decision)) throw new Error('decision must be approve or reject');

    const row = kkFindBookingRow_('', bookingId);
    const sh = kkSheet_(KK.bookings);
    const current = sh.getRange(row, 1, 1, 20).getValues()[0];
    if (String(current[0] || '').trim() !== bookingId) throw new Error('Booking identity mismatch: ' + bookingId);
    if (String(current[7] || '').toUpperCase().trim() !== 'LINE') throw new Error('Owner decision is limited to LINE bookings');

    const requestId = kkBookingRequestIdFromNote_(current[19]);
    if (!/^line:[a-f0-9]{48}$/.test(String(requestId || ''))) {
      throw new Error('Booking is not a governed LINE pending intake: ' + bookingId);
    }

    const customerContact = String(current[5] || '').trim();
    if (!customerContact) throw new Error('LINE customer contact missing: ' + bookingId);

    const currentStatus = String(current[2] || '').toLowerCase().trim();
    const targetStatus = decision === 'approve' ? 'confirmed' : 'cancelled';
    if (currentStatus === targetStatus) {
      return {
        row_number: row,
        booking_id: bookingId,
        booking_status: currentStatus,
        payment_status: String(current[13] || '').toLowerCase().trim(),
        customer_contact: customerContact,
        phone_asset_id: String(current[9] || '').trim(),
        lens_asset_id: String(current[10] || '').trim(),
        decision: decision,
        idempotent_replay: true
      };
    }
    if (currentStatus !== 'pending') {
      throw new Error('LINE pending booking already decided: ' + bookingId + ' / status=' + currentStatus);
    }

    const next = current.slice();
    next[2] = targetStatus;
    sh.getRange(row, 1, 1, 20).setValues([next]);
    SpreadsheetApp.flush();

    const persisted = sh.getRange(row, 1, 1, 20).getValues()[0];
    if (String(persisted[0] || '').trim() !== bookingId) throw new Error('Booking identity readback failed: ' + bookingId);
    if (String(persisted[2] || '').toLowerCase().trim() !== targetStatus) throw new Error('Owner decision readback failed: ' + bookingId);
    if (kkBookingRequestIdFromNote_(persisted[19]) !== requestId) throw new Error('LINE request identity readback failed: ' + bookingId);
    if (String(persisted[5] || '').trim() !== customerContact) throw new Error('LINE customer contact readback failed: ' + bookingId);

    return {
      row_number: row,
      booking_id: bookingId,
      booking_status: targetStatus,
      payment_status: String(persisted[13] || '').toLowerCase().trim(),
      customer_contact: customerContact,
      phone_asset_id: String(persisted[9] || '').trim(),
      lens_asset_id: String(persisted[10] || '').trim(),
      decision: decision,
      idempotent_replay: false
    };
  } finally {
    lock.releaseLock();
  }
}


function kkApiCreateBooking_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const requestId = kkBookingRequestId_(payload);
    const prior = requestId ? kkFindBookingByRequestId_(requestId) : null;
    if (prior) return kkBookingCreateResult_(prior.row_number, prior.row, true);

    const eventId = String(payload.event_id || '').trim();
    let templateId = String(payload.template_id || '').trim();
    const customerName = String(payload.customer_name || '').trim();
    const customerContact = payload.customer_contact || '';
    const customerPhone = payload.customer_phone || '';
    const contactChannel = payload.contact_channel || 'LINE';
    const bookingStatus = String(payload.booking_status || 'confirmed').toLowerCase().trim();
    let phoneAssetId = String(payload.phone_asset_id || '').trim();
    let lensAssetId = String(payload.lens_asset_id || '').trim();
    const pickupTime = String(payload.pickup_time || '').trim();
    const paymentStatus = String(payload.payment_status || 'unpaid').toLowerCase().trim();
    const amountReceived = kkApiNumber_(payload.amount_received, 'amount_received', true) || 0;
    const bookingNote = kkBookingNoteWithRequest_(payload.booking_note || '', requestId);

    kkEnsureLensCompatibilityPatchInstalled_();
    if (!eventId || !templateId || !customerName) throw new Error('Please fill event_id, template_id and customer_name');
    if (!['pending', 'confirmed', 'prepared', 'picked_up', 'returned', 'uploaded', 'completed', 'no_show', 'cancelled'].includes(bookingStatus)) throw new Error('Invalid booking_status');
    if (!['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) throw new Error('Invalid payment_status');

    templateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);
    const event = kkGetEventById_(eventId);
    if (kkIsPastEventDate_(event.event_date)) throw new Error('Cannot create booking for a past event date: ' + kkApiDate_(event.event_date));
    const pkg = kkGetPackageByTemplateId_(templateId);
    if (String(event.status).toLowerCase() !== 'open') throw new Error('Event is not open: ' + eventId);
    if (!event.active) throw new Error('Event is not active_on_web: ' + eventId);
    if (!pkg.active) throw new Error('Package is inactive: ' + templateId);
    kkAssertWebPackageBookable_(eventId, templateId);

    const pkgType = String(pkg.package_type || '').toLowerCase().trim();
    if (phoneAssetId) kkValidateManualAsset_(phoneAssetId, 'phone', pkg.model_group, event.event_date);
    if (lensAssetId) kkValidateManualAsset_(lensAssetId, 'lens', pkg.lens_group, event.event_date);
    if ((pkgType === 'phone_only' || pkgType === 'phone_lens_bundle') && !phoneAssetId) phoneAssetId = kkFindAvailableAsset_('phone', pkg.model_group, event.event_date);
    if ((pkgType === 'lens_only' || pkgType === 'phone_lens_bundle') && !lensAssetId) lensAssetId = kkFindAvailableAsset_('lens', pkg.lens_group, event.event_date);

    const row = kkFirstEmptyRow_(KK.bookings, 4, 5, 2, 19);
    const bookingId = kkGenerateUniqueBookingId_(event.event_date);
    const bookingSheet = kkSheet_(KK.bookings);
    bookingSheet.getRange(row, 1, 1, 20).setValues([[
      bookingId, new Date(), bookingStatus, eventId, customerName, customerContact, customerPhone, contactChannel,
      pkgType, phoneAssetId, lensAssetId, pickupTime, '', paymentStatus, amountReceived, '', '', '', 0, bookingNote
    ]]);
    SpreadsheetApp.flush();
    const persisted = bookingSheet.getRange(row, 1, 1, 20).getValues()[0];
    if (String(persisted[0] || '').trim() !== bookingId) throw new Error('Booking canonical booking_id readback failed');
    return kkBookingCreateResult_(row, persisted, false);
  } finally {
    lock.releaseLock();
  }
}

function kkApiUpdateBooking_(payload) {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const row = kkFindBookingRow_(payload.row_number, payload.booking_id);
    const sh = kkSheet_(KK.bookings);
    const current = sh.getRange(row, 1, 1, 20).getValues()[0];
    if (!current[0] && !current[3]) throw new Error('Booking row is empty: ' + row);
    
    const nextStatus = String(payload.booking_status || current[2] || '').toLowerCase().trim();
    const paymentStatus = String(payload.payment_status || current[13] || '').toLowerCase().trim();
    const amountReceived = payload.amount_received === undefined || payload.amount_received === '' ? current[14] : kkApiNumber_(payload.amount_received, 'amount_received', true);

    if (!['pending', 'confirmed', 'prepared', 'picked_up', 'returned', 'uploaded', 'completed', 'no_show', 'cancelled'].includes(nextStatus)) throw new Error('Invalid booking_status');
    if (!['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) throw new Error('Invalid payment_status');

    const next = current.slice();
    if (payload.booking_status !== undefined && payload.booking_status !== '') next[2] = nextStatus;
    if (payload.customer_name !== undefined && payload.customer_name !== '') next[4] = String(payload.customer_name || '').trim();
    if (payload.customer_contact !== undefined) next[5] = payload.customer_contact || '';
    if (payload.customer_phone !== undefined) next[6] = payload.customer_phone || '';
    if (payload.contact_channel !== undefined && payload.contact_channel !== '') next[7] = payload.contact_channel || 'LINE';
    if (payload.phone_asset_id !== undefined) next[9] = String(payload.phone_asset_id || '').trim();
    if (payload.lens_asset_id !== undefined) next[10] = String(payload.lens_asset_id || '').trim();
    if (payload.pickup_time !== undefined) next[11] = payload.pickup_time || '';
    if (payload.payment_status !== undefined && payload.payment_status !== '') next[13] = paymentStatus;
    if (payload.amount_received !== undefined && payload.amount_received !== '') next[14] = amountReceived;
    if (payload.booking_note !== undefined) {
      const existingRequestId = kkBookingRequestIdFromNote_(current[19]);
      next[19] = kkBookingNoteWithRequest_(payload.booking_note || '', existingRequestId);
    }
    if (!String(next[4] || '').trim()) throw new Error('customer_name is required');

    const eventId = String(next[3] || '').trim();
    const event = kkGetEventById_(eventId);

    // Critical workflow guard: older bookings may reserve package stock correctly but
    // still have blank physical Asset IDs. When admin clicks “เตรียมแล้ว” (prepared)
    // or “รับแล้ว” (picked_up), assign the missing phone/lens automatically.
    kkAssignMissingAssetsForPreparedBooking_(next, nextStatus, event.event_date);

    if (kkActiveHold_(nextStatus)) {
      // Do not re-require "available" for an asset that already belongs to this booking.
      // Unrelated edits (payment/customer/status) must not fail just because the asset's
      // master status changed after assignment. Revalidate availability only when the
      // asset itself changes or when a previously closed booking is reactivated.
      const currentStatus = String(current[2] || '').toLowerCase().trim();
      const reactivating = !kkActiveHold_(currentStatus);
      const phoneChanged = String(next[9] || '').trim() !== String(current[9] || '').trim();
      const lensChanged = String(next[10] || '').trim() !== String(current[10] || '').trim();
      if (next[9] && (reactivating || phoneChanged)) kkValidateManualAsset_(next[9], 'phone', '', event.event_date, row);
      if (next[10] && (reactivating || lensChanged)) kkValidateManualAsset_(next[10], 'lens', '', event.event_date, row);
    }
    kkAssertBookingAssetsNotDoubleBooked_(row, next, nextStatus);

    // One canonical A:T row write prevents a later range write from leaving the
    // booking half-updated if Sheets fails mid-mutation.
    const bookingId = String(current[0] || '').trim();
    sh.getRange(row, 1, 1, 20).setValues([next]);
    SpreadsheetApp.flush();
    const persisted = sh.getRange(row, 1, 1, 20).getValues()[0];
    if (String(persisted[0] || '').trim() !== bookingId) throw new Error('Booking identity readback failed: ' + bookingId);
    if (String(persisted[2] || '').toLowerCase().trim() !== String(next[2] || '').toLowerCase().trim()) throw new Error('Booking status readback failed: ' + bookingId);
    if (String(persisted[13] || '').toLowerCase().trim() !== String(next[13] || '').toLowerCase().trim()) throw new Error('Booking payment readback failed: ' + bookingId);
    if (String(persisted[9] || '').trim() !== String(next[9] || '').trim() || String(persisted[10] || '').trim() !== String(next[10] || '').trim()) throw new Error('Booking asset readback failed: ' + bookingId);

    return { row_number: row, booking_id: persisted[0] || '', booking_status: persisted[2], payment_status: persisted[13], phone_asset_id: persisted[9], lens_asset_id: persisted[10] };
  } finally {
    lock.releaseLock();
  }
}

function kkEnsureSheetWithHeaders_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  let needsHeaders = false;
  for (let i = 0; i < headers.length; i++) {
    if (existing[i] !== headers[i]) { needsHeaders = true; break; }
  }
  if (needsHeaders) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function kkEnsureCrmArchiveSheets_() {
  const bookingHeaders = kkSheet_(KK.bookings).getRange('A4:T4').getValues()[0];
  kkEnsureSheetWithHeaders_(KK.customerStats, [
    'customer_key','customer_name','customer_contact','customer_phone','rental_count',
    'first_rental_date','last_rental_date','last_event_name','last_booking_status','updated_at'
  ]);
  kkEnsureSheetWithHeaders_(KK.bookingArchive, ['archived_at','source_row','event_name','event_date','venue','customer_key'].concat(bookingHeaders));
  const eventHeaders = kkSheet_(KK.events).getRange('A4:I4').getValues()[0];
  kkEnsureSheetWithHeaders_(KK.eventArchive, ['archived_at','source_row'].concat(eventHeaders));
  const overrideHeaders = kkSheet_(KK.overrides).getRange('A4:G4').getValues()[0];
  kkEnsureSheetWithHeaders_(KK.overrideArchive, ['archived_at','source_row'].concat(overrideHeaders));
}

function kkCustomerKey_(name, contact, phone) {
  const p = String(phone || '').replace(/\D+/g, '');
  if (p) return 'phone:' + p;
  const c = String(contact || '').trim().toLowerCase();
  if (c) return 'contact:' + c;
  const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return n ? 'name:' + n : '';
}

function kkReadCustomerStats_() {
  return kkGetValues_(KK.customerStats, 2, 1, 10)
    .filter(r => r[0])
    .map(r => ({
      customer_key: r[0] || '',
      customer_name: r[1] || '',
      customer_contact: r[2] || '',
      customer_phone: r[3] || '',
      rental_count: r[4] || 0,
      first_rental_date: kkApiDate_(r[5]),
      last_rental_date: kkApiDate_(r[6]),
      last_event_name: r[7] || '',
      last_booking_status: r[8] || '',
      updated_at: kkApiDateTime_(r[9])
    }))
    .sort((a, b) => Number(b.rental_count || 0) - Number(a.rental_count || 0));
}

function kkUpsertCustomerStat_(booking, event) {
  const customerName = booking[4] || '';
  const contact = booking[5] || '';
  const phone = booking[6] || '';
  const key = kkCustomerKey_(customerName, contact, phone);
  if (!key) return false;
  const status = String(booking[2] || '').toLowerCase().trim();
  // Customer Stats rental_count must count real rentals only.
  // Do not count pending/confirmed/prepared/cancelled/no_show rows that were merely archived.
  if (!['picked_up', 'returned', 'uploaded', 'completed'].includes(status)) return false;

  const sh = kkSheet_(KK.customerStats);
  const rows = kkGetValues_(KK.customerStats, 2, 1, 10);
  let targetRow = 0;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === key) { targetRow = i + 2; break; }
  }
  if (!targetRow) targetRow = Math.max(sh.getLastRow() + 1, 2);

  const current = targetRow <= sh.getLastRow() ? sh.getRange(targetRow, 1, 1, 10).getValues()[0] : [];
  const rentalDate = event && event.event_date ? kkDateObj_(event.event_date) : (booking[1] ? kkDateObj_(booking[1]) : new Date());
  const currentCount = Number(current[4] || 0);
  const firstDate = current[5] ? kkDateObj_(current[5]) : rentalDate;
  const lastDate = current[6] ? kkDateObj_(current[6]) : rentalDate;

  sh.getRange(targetRow, 1, 1, 10).setValues([[
    key,
    customerName || current[1] || '',
    contact || current[2] || '',
    phone || current[3] || '',
    currentCount + 1,
    firstDate < rentalDate ? firstDate : rentalDate,
    lastDate > rentalDate ? lastDate : rentalDate,
    event && event.event_name ? event.event_name : (current[7] || ''),
    booking[2] || current[8] || '',
    new Date()
  ]]);
  return true;
}

// PERFORMANCE FIX: O(1) Batch Archiving & Range Clearing
function kkCleanupOldData30Days_() {
  kkEnsureCrmArchiveSheets_();
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    threshold.setHours(0, 0, 0, 0);

    const eventMap = {};
    const eventRows = kkGetValues_(KK.events, 5, 1, 9);
    eventRows.forEach((r, i) => {
      if (!r[0]) return;
      eventMap[String(r[0]).trim()] = {
        row_number: i + 5,
        event_id: r[0], event_name: r[1], event_date: r[2], venue: r[3], row: r
      };
    });

    const bookingSh = kkSheet_(KK.bookings);
    const bookingArchive = kkSheet_(KK.bookingArchive);
    const bookings = kkGetValues_(KK.bookings, 5, 1, 20);
    let customerStatsUpdated = 0;
    let skippedOrphanBookings = 0;
    
    const bookingArchiveRows = [];
    const bookingClearA1s = [];

    bookings.forEach((r, i) => {
      const hasData = r[3] || r[4];
      if (!hasData) return;
      const event = eventMap[String(r[3] || '').trim()] || null;
      // Fail closed: never archive a booking from created_at when its linked
      // event cannot be resolved. A future booking created >30 days early must
      // not disappear merely because its event row is temporarily missing.
      if (!event || !event.event_date) { skippedOrphanBookings++; return; }
      const basisDate = kkDateObj_(event.event_date);
      if (basisDate >= threshold) return;

      const sourceRow = i + 5;
      const customerKey = kkCustomerKey_(r[4], r[5], r[6]);
      bookingArchiveRows.push([
        new Date(), sourceRow, event ? event.event_name : '', event ? event.event_date : '', event ? event.venue : '', customerKey
      ].concat(r));
      
      bookingClearA1s.push(`A${sourceRow}:T${sourceRow}`);
    });

    if (bookingArchiveRows.length > 0) {
      bookingArchive.getRange(Math.max(bookingArchive.getLastRow() + 1, 2), 1, bookingArchiveRows.length, bookingArchiveRows[0].length).setValues(bookingArchiveRows);
      bookingSh.getRangeList(bookingClearA1s).clearContent();
    }

    const eventSh = kkSheet_(KK.events);
    const eventArchive = kkSheet_(KK.eventArchive);
    const eventArchiveRows = [];
    const eventClearA1s = [];
    const archivedEventIds = {};

    Object.keys(eventMap).forEach(id => {
      const ev = eventMap[id];
      if (!ev.event_date || kkDateObj_(ev.event_date) >= threshold) return;
      eventArchiveRows.push([new Date(), ev.row_number].concat(ev.row));
      archivedEventIds[id] = true;
      eventClearA1s.push(`A${ev.row_number}:H${ev.row_number}`);
    });

    if (eventArchiveRows.length > 0) {
      eventArchive.getRange(Math.max(eventArchive.getLastRow() + 1, 2), 1, eventArchiveRows.length, eventArchiveRows[0].length).setValues(eventArchiveRows);
      eventSh.getRangeList(eventClearA1s).clearContent();
    }

    const overrideSh = kkSheet_(KK.overrides);
    const overrideArchive = kkSheet_(KK.overrideArchive);
    const overrideRows = kkGetValues_(KK.overrides, 5, 1, 7);
    const overrideArchiveRows = [];
    const overrideClearA1s = [];

    overrideRows.forEach((r, i) => {
      const eventId = String(r[0] || '').trim();
      if (!eventId || !archivedEventIds[eventId]) return;
      const sourceRow = i + 5;
      overrideArchiveRows.push([new Date(), sourceRow].concat(r));
      overrideClearA1s.push(`A${sourceRow}:G${sourceRow}`);
    });

    if (overrideArchiveRows.length > 0) {
      overrideArchive.getRange(Math.max(overrideArchive.getLastRow() + 1, 2), 1, overrideArchiveRows.length, overrideArchiveRows[0].length).setValues(overrideArchiveRows);
      overrideSh.getRangeList(overrideClearA1s).clearContent();
    }

    SpreadsheetApp.flush();
    // Rebuild from archive as source-of-truth so a partial previous cleanup
    // cannot double-increment or permanently undercount Customer Stats.
    customerStatsUpdated = kkRebuildCustomerStatsFromArchive_();
    SpreadsheetApp.flush();
    return {
      archived_bookings: bookingArchiveRows.length,
      archived_events: eventArchiveRows.length,
      archived_overrides: overrideArchiveRows.length,
      customer_stats_updated: customerStatsUpdated,
      skipped_orphan_bookings: skippedOrphanBookings,
      threshold_date: kkApiDate_(threshold)
    };
  } finally {
    lock.releaseLock();
  }
}

function kkCleanupOldData30Days() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Run 30-day Archive Cleanup?',
    'ระบบจะย้าย booking/event ที่เก่ากว่า 30 วันไป archive และอัปเดต 11_Customer_Stats ก่อนล้างข้อมูลจากชีตทำงาน ต้องการทำต่อไหม?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;
  const result = kkCleanupOldData30Days_();
  ui.alert(
    'Cleanup completed\n' +
    'Archived bookings: ' + result.archived_bookings + '\n' +
    'Archived events: ' + result.archived_events + '\n' +
    'Customer stats updated: ' + result.customer_stats_updated + '\n' +
    'Threshold: ' + result.threshold_date
  );
}

function kkCleanupOldData30DaysAuto() {
  kkCleanupOldData30Days_();
}

function kkInstallDailyCleanupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'kkCleanupOldData30DaysAuto')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('kkCleanupOldData30DaysAuto')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  kkSafeAlert_('Installed daily cleanup trigger at around 03:00.');
}

function kkApiCleanupOldData_(payload) {
  return kkCleanupOldData30Days_();
}

function kkGenerateAdminApiKey() {
  const key = Utilities.getUuid() + '-' + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('KK_ADMIN_API_KEY', key);
  kkSafeAlert_('Generated KK_ADMIN_API_KEY. Copy this key to Vercel ENV KK_ADMIN_API_KEY:\n\n' + key);
}

function kkSetPosterFolderId() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    'Set Poster Folder ID',
    'Paste Google Drive folder ID or folder URL for event posters:',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const folderId = kkExtractDriveFolderId_(resp.getResponseText());
  if (!folderId) throw new Error('Folder ID is blank');
  PropertiesService.getScriptProperties().setProperty('KK_POSTER_FOLDER_ID', folderId);
  ui.alert('Saved KK_POSTER_FOLDER_ID:\n' + folderId + '\n\nNext step: run KK Admin > CRM: Authorize Drive Access once.');
}

function kkAuthorizeDriveAccess() {
  const folderId = String(PropertiesService.getScriptProperties().getProperty('KK_POSTER_FOLDER_ID') || '').trim();
  if (!folderId) {
    kkSafeAlert_('Missing KK_POSTER_FOLDER_ID. Run KK Admin > CRM: Set Poster Folder ID first.');
    return;
  }
  const folder = DriveApp.getFolderById(folderId);
  kkSafeAlert_('Drive permission OK: ' + folder.getName());
}

function kkShowAdminCrmSetupInfo() {
  const props = PropertiesService.getScriptProperties();
  const hasKey = props.getProperty('KK_ADMIN_API_KEY') ? 'YES' : 'NO';
  const hasFolder = props.getProperty('KK_POSTER_FOLDER_ID') ? 'YES' : 'NO';
  kkSafeAlert_(
    'KK Admin CRM API Setup v16.7.0_CRM_PRO_PHASE3_6_7\n\n' +
    '1) Deploy Apps Script as Web app. Execute as: Me. Access: Anyone with the link.\n' +
    '2) Copy the /exec URL to Vercel ENV KK_ADMIN_SCRIPT_URL.\n' +
    '3) Generate API key and copy to Vercel ENV KK_ADMIN_API_KEY.\n' +
    '4) Set Vercel ENV KK_ADMIN_PIN for /admin login.\n\n' +
    'Current Script Properties:\n' +
    'KK_ADMIN_API_KEY: ' + hasKey + '\n' +
    'KK_POSTER_FOLDER_ID: ' + hasFolder
  );
}