/**
 * KK Phone Rental — canonical booking create idempotency overlay.
 *
 * Code.gs explicitly dispatches to kkBookingCreateWithReceipt_ without relying
 * on file evaluation order. This adds a non-PII durable request
 * receipt inside the canonical Apps Script writer boundary.
 *
 * Receipt states:
 *   PREPARED -> booking row exact write/readback -> COMMITTED
 *
 * Repeating the same request_id + exact intent is safe. Reusing a request_id
 * for different intent fails closed. A PREPARED receipt is reconciled against
 * its exact target booking row before any retry mutation.
 */

const KK_BOOKING_RECEIPT_SHEET = '17_Booking_Request_Receipts';
const KK_BOOKING_RECEIPT_HEADERS = [
  'request_id',
  'request_fingerprint',
  'status',
  'target_row',
  'write_fingerprint',
  'phone_asset_id',
  'lens_asset_id',
  'event_id',
  'template_id',
  'prepared_at',
  'committed_at',
  'booking_id',
  'result_json',
  'writer_version',
  'last_error'
];

function kkBookingHash_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value === undefined || value === null ? '' : value),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ((b + 256) % 256).toString(16).padStart(2, '0');
  }).join('');
}

function kkBookingCanonicalText_(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function kkBookingCanonicalPhone_(value) {
  return kkBookingCanonicalText_(value).replace(/[^0-9+]/g, '');
}

function kkBookingCanonicalAmount_(value) {
  if (value === '' || value === null || value === undefined) return '0';
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return kkBookingCanonicalText_(value);
  return String(n);
}

function kkBookingRequestFingerprint_(payload) {
  const p = payload || {};
  const canonical = [
    ['event_id', kkBookingCanonicalText_(p.event_id)],
    ['template_id', kkBookingCanonicalText_(p.template_id)],
    ['customer_name', kkBookingCanonicalText_(p.customer_name)],
    ['customer_contact', kkBookingCanonicalText_(p.customer_contact)],
    ['customer_phone', kkBookingCanonicalPhone_(p.customer_phone)],
    ['contact_channel', kkBookingCanonicalText_(p.contact_channel || 'LINE').toUpperCase()],
    ['booking_status', kkBookingCanonicalText_(p.booking_status || 'confirmed').toLowerCase()],
    ['phone_asset_id', kkBookingCanonicalText_(p.phone_asset_id)],
    ['lens_asset_id', kkBookingCanonicalText_(p.lens_asset_id)],
    ['pickup_time', kkBookingCanonicalText_(p.pickup_time)],
    ['payment_status', kkBookingCanonicalText_(p.payment_status || 'unpaid').toLowerCase()],
    ['amount_received', kkBookingCanonicalAmount_(p.amount_received)],
    ['booking_note', kkBookingCanonicalText_(p.booking_note)]
  ];
  return kkBookingHash_(JSON.stringify(canonical));
}

function kkBookingWriteFingerprint_(bookingRowBtoT) {
  // Column B (created_at) is intentionally excluded. Everything that carries
  // booking intent/assignment in C:T is exact-bound.
  const row = Array.isArray(bookingRowBtoT) ? bookingRowBtoT.slice(1) : [];
  const canonical = row.map(function(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return kkBookingCanonicalText_(value);
  });
  return kkBookingHash_(JSON.stringify(canonical));
}

function kkEnsureBookingReceiptSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(KK_BOOKING_RECEIPT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(KK_BOOKING_RECEIPT_SHEET);
    sh.getRange(1, 1, 1, KK_BOOKING_RECEIPT_HEADERS.length).setValues([KK_BOOKING_RECEIPT_HEADERS]);
    sh.setFrozenRows(1);
    SpreadsheetApp.flush();
  }

  const current = sh.getRange(1, 1, 1, KK_BOOKING_RECEIPT_HEADERS.length).getDisplayValues()[0];
  for (let i = 0; i < KK_BOOKING_RECEIPT_HEADERS.length; i++) {
    if (String(current[i] || '').trim() !== KK_BOOKING_RECEIPT_HEADERS[i]) {
      throw new Error('Booking receipt schema mismatch at column ' + (i + 1) + '. Fail closed; do not rewrite receipt history.');
    }
  }
  return sh;
}

function kkFindBookingReceipt_(sh, requestId) {
  const id = kkBookingCanonicalText_(requestId);
  if (!id || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, KK_BOOKING_RECEIPT_HEADERS.length).getValues();
  const matches = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (kkBookingCanonicalText_(rows[i][0]) === id) {
      matches.push({ row_number: i + 2, values: rows[i] });
    }
  }
  if (matches.length > 1) throw new Error('BOOKING_RECEIPT_NOT_EXACT1: duplicate request identity requires reconciliation');
  return matches[0] || null;
}

function kkBookingReceiptObject_(found) {
  if (!found) return null;
  const r = found.values || [];
  return {
    row_number: found.row_number,
    request_id: kkBookingCanonicalText_(r[0]),
    request_fingerprint: kkBookingCanonicalText_(r[1]),
    status: kkBookingCanonicalText_(r[2]).toUpperCase(),
    target_row: Number(r[3] || 0),
    write_fingerprint: kkBookingCanonicalText_(r[4]),
    phone_asset_id: kkBookingCanonicalText_(r[5]),
    lens_asset_id: kkBookingCanonicalText_(r[6]),
    event_id: kkBookingCanonicalText_(r[7]),
    template_id: kkBookingCanonicalText_(r[8]),
    prepared_at: r[9] || '',
    committed_at: r[10] || '',
    booking_id: kkBookingCanonicalText_(r[11]),
    result_json: kkBookingCanonicalText_(r[12]),
    writer_version: kkBookingCanonicalText_(r[13]),
    last_error: kkBookingCanonicalText_(r[14])
  };
}

function kkWriteBookingReceipt_(sh, rowNumber, values) {
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || values.length !== KK_BOOKING_RECEIPT_HEADERS.length) {
    throw new Error('BOOKING_RECEIPT_TARGET_OR_WIDTH_INVALID');
  }
  // The enclosing canonical writer must still own the lock after every read.
  if (!kkScriptLockFrame_ || !kkScriptLockFrame_.lock.hasLock()) throw new Error('SCRIPT_LOCK_OWNERSHIP_LOST');
  if (values.some(v => typeof v === 'string' && /^\s*=/.test(v))) throw new Error('BOOKING_RECEIPT_FORMULA_INPUT_REJECTED');
  sh.getRange(rowNumber, 1, 1, KK_BOOKING_RECEIPT_HEADERS.length).setValues([values]);
  SpreadsheetApp.flush();
  const actual = sh.getRange(rowNumber, 1, 1, KK_BOOKING_RECEIPT_HEADERS.length).getValues()[0];
  const canonical = row => JSON.stringify(row.map(v => v instanceof Date ? v.toISOString() : (v == null ? '' : v)));
  if (canonical(actual) !== canonical(values)) throw new Error('BOOKING_RECEIPT_FULL_READBACK_MISMATCH');
  return kkBookingReceiptObject_({
    row_number: rowNumber,
    values: actual
  });
}

function kkAssertBookingReceipt_(receipt, expectedStatus, requestId, requestFingerprint) {
  if (!receipt) throw new Error('Booking receipt exact readback missing');
  if (receipt.request_id !== requestId) throw new Error('Booking receipt request_id readback mismatch');
  if (receipt.request_fingerprint !== requestFingerprint) throw new Error('Booking receipt fingerprint readback mismatch');
  if (receipt.status !== expectedStatus) throw new Error('Booking receipt status readback mismatch: ' + receipt.status);
  return true;
}

function kkBookingStoredResult_(receipt) {
  let parsed;
  try { parsed = JSON.parse(receipt.result_json); }
  catch (_) { throw new Error('BOOKING_COMMITTED_RECEIPT_RECONCILIATION_REQUIRED'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !receipt.booking_id ||
      !Number.isInteger(receipt.target_row) || receipt.target_row < 5 || receipt.target_row > 1000 ||
      ['booking_id','phone_asset_id','lens_asset_id','request_id','request_fingerprint'].some(k => parsed[k] !== receipt[k]) ||
      parsed.row_number !== receipt.target_row) throw new Error('BOOKING_COMMITTED_RECEIPT_RECONCILIATION_REQUIRED');
  kkAssertBookingIdUnique_(receipt.booking_id, receipt.target_row);
  return {
    row_number: receipt.target_row,
    booking_id: receipt.booking_id,
    phone_asset_id: receipt.phone_asset_id,
    lens_asset_id: receipt.lens_asset_id,
    request_id: receipt.request_id,
    request_fingerprint: receipt.request_fingerprint,
    idempotent_replay: true
  };
}

function kkBookingTargetRowState_(targetRow) {
  const row = Number(targetRow || 0);
  if (!Number.isInteger(row) || row < 5 || row > 1000) throw new Error('Invalid booking receipt target_row');
  const sh = kkSheet_(KK.bookings);
  const values = sh.getRange(row, 1, 1, 20).getValues()[0];
  const hasData = values.some(function(v) { return !kkBlank_(v); });
  return {
    values: values,
    booking_id: kkBookingCanonicalText_(values[0]),
    row_b_to_t: values.slice(1, 20),
    has_data: hasData
  };
}

function kkAssertBookingIdUnique_(bookingId, targetRow) {
  const id = kkBookingCanonicalText_(bookingId);
  const target = Number(targetRow || 0);
  if (!id) throw new Error('BOOKING_ID_MISSING: canonical booking_id exact readback is blank');
  if (target < 5) throw new Error('BOOKING_ID_TARGET_ROW_INVALID');

  const sh = kkSheet_(KK.bookings);
  const last = Math.max(sh.getLastRow(), 5);
  const ids = sh.getRange(5, 1, last - 4, 1).getDisplayValues();
  const matchedRows = [];
  for (let i = 0; i < ids.length; i++) {
    if (kkBookingCanonicalText_(ids[i][0]) === id) matchedRows.push(i + 5);
  }
  if (matchedRows.length !== 1 || matchedRows[0] !== target) {
    throw new Error('BOOKING_ID_NOT_GLOBALLY_UNIQUE: ' + id + ' rows=' + matchedRows.join(','));
  }
  return true;
}

function kkBookingDateKey_(eventDate) {
  if (!(eventDate instanceof Date) || isNaN(eventDate.getTime())) throw new Error('BOOKING_ID_EVENT_DATE_INVALID');
  // Match the spreadsheet TEXT(date) formula, not the script/account timezone.
  return Utilities.formatDate(eventDate, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyyMMdd');
}

function kkAssertBookingTargetNotReserved_(receiptSheet, targetRow, requestId, expectedBookingId) {
  const target = Number(targetRow || 0);
  if (target < 5) throw new Error('BOOKING_ID_TARGET_ROW_INVALID');
  if (!receiptSheet || receiptSheet.getLastRow() < 2) return true;
  const rows = receiptSheet.getRange(2, 1, receiptSheet.getLastRow() - 1, KK_BOOKING_RECEIPT_HEADERS.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const status = kkBookingCanonicalText_(rows[i][2]).toUpperCase();
    const reservedTarget = Number(rows[i][3] || 0);
    const reservedRequestId = kkBookingCanonicalText_(rows[i][0]);
    if (status === 'PREPARED' && reservedRequestId !== requestId) {
      if (!reservedRequestId || !Number.isInteger(reservedTarget) || reservedTarget < 5 || !rows[i][11]) {
        throw new Error('BOOKING_REQUEST_RECONCILIATION_REQUIRED: malformed or legacy PREPARED reservation');
      }
      if (reservedTarget === target || (expectedBookingId && rows[i][11] === expectedBookingId)) {
        throw new Error('BOOKING_TARGET_OR_ID_RESERVED_BY_OTHER_PREPARED_REQUEST');
      }
    }
  }
  return true;
}

function kkNextAppendBookingRow_() {
  const sh = kkSheet_(KK.bookings);
  const last = Math.max(sh.getLastRow(), 5);
  const rows = sh.getRange(5, 2, last - 4, 19).getValues();
  let target = 5;
  rows.forEach((r, i) => { if (r.some(v => !kkBlank_(v))) target = i + 6; });
  if (target > Math.min(1000, sh.getMaxRows())) throw new Error('BOOKING_FORMULA_CAPACITY_EXHAUSTED');
  return target;
}

function kkExpectedBookingIdBeforeWrite_(eventDate, targetRow, eventId) {
  const target = Number(targetRow || 0);
  if (!Number.isInteger(target) || target < 5 || target > 1000) throw new Error('BOOKING_ID_TARGET_ROW_INVALID');
  // COUNTIF is case-insensitive and interprets wildcards/numeric criteria.
  // Only unambiguous text keys are modelled; do not guess other coercions.
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(String(eventId || ''))) throw new Error('BOOKING_ID_EVENT_KEY_UNSUPPORTED');

  const sh = kkSheet_(KK.bookings);
  const formula = String(sh.getRange(target, 1).getFormula() || '');
  const d = 'D' + target;
  const knownFormula = '=IF(' + d + '="","",IFERROR("BK-"&TEXT(VLOOKUP(' + d + ',\'01_Events\'!$A$5:$C$1000,3,FALSE),"yyyymmdd")&"-"&TEXT(COUNTIF($D$5:' + d + ',' + d + '),"000"),"CHECK EVENT"))';
  if (formula !== knownFormula) {
    throw new Error('BOOKING_ID_PREWRITE_FORMULA_UNSAFE: unverified formula semantics');
  }
  const events = kkSheet_(KK.events).getRange(5, 1, 996, 3).getValues().filter(r => String(r[0]).toUpperCase() === eventId.toUpperCase());
  if (events.length !== 1 || !(events[0][2] instanceof Date) || events[0][2].getTime() !== eventDate.getTime()) {
    throw new Error('BOOKING_ID_EVENT_LOOKUP_NOT_EXACT1');
  }
  const dateKey = kkBookingDateKey_(eventDate);
  const prefix = 'BK-' + dateKey + '-';
  const last = Math.max(sh.getLastRow(), 5);
  const rows = sh.getRange(5, 1, last - 4, 20).getValues();
  let sameEventCount = 0;
  const existing = new Set();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], physicalRow = i + 5;
    const id = kkBookingCanonicalText_(r[0]);
    if (physicalRow >= target && r.slice(1).some(v => !kkBlank_(v))) {
      throw new Error('BOOKING_ID_APPEND_ONLY_REQUIRED: insertion may renumber existing formula identities');
    }
    if (id) {
      if (existing.has(id)) throw new Error('BOOKING_ID_EXISTING_DUPLICATE_RECONCILIATION_REQUIRED');
      existing.add(id);
    }
    if (physicalRow < target && String(r[3]).toUpperCase() === eventId.toUpperCase()) sameEventCount++;
  }
  const expected = prefix + String(sameEventCount + 1).padStart(3, '0');
  if (existing.has(expected)) {
    throw new Error('BOOKING_ID_PREWRITE_COLLISION: ' + expected);
  }
  return expected;
}

function kkFinalizePreparedBookingReceipt_(receiptSheet, receipt) {
  // Historic PREPARED rows did not persist expected identity. Never infer it
  // from the possibly incorrect business row during recovery.
  if (!receipt.booking_id) throw new Error('BOOKING_REQUEST_RECONCILIATION_REQUIRED: PREPARED expected booking ID missing');
  const target = kkBookingTargetRowState_(receipt.target_row);
  if (!target.has_data) return null;

  const actualWriteFingerprint = kkBookingWriteFingerprint_(target.row_b_to_t);
  if (!receipt.write_fingerprint || actualWriteFingerprint !== receipt.write_fingerprint) {
    throw new Error('BOOKING_REQUEST_RECONCILIATION_REQUIRED: PREPARED target row is occupied by non-matching booking data');
  }
  if (target.booking_id !== receipt.booking_id) {
    throw new Error('BOOKING_ID_READBACK_MISMATCH: PREPARED recovery differs from reserved identity');
  }
  kkAssertBookingIdUnique_(target.booking_id, receipt.target_row);

  const result = {
    row_number: receipt.target_row,
    booking_id: target.booking_id,
    phone_asset_id: receipt.phone_asset_id,
    lens_asset_id: receipt.lens_asset_id,
    request_id: receipt.request_id,
    request_fingerprint: receipt.request_fingerprint,
    reconciled_from_prepared: true
  };

  const committed = kkWriteBookingReceipt_(receiptSheet, receipt.row_number, [
    receipt.request_id,
    receipt.request_fingerprint,
    'COMMITTED',
    receipt.target_row,
    receipt.write_fingerprint,
    receipt.phone_asset_id,
    receipt.lens_asset_id,
    receipt.event_id,
    receipt.template_id,
    receipt.prepared_at || new Date(),
    new Date(),
    target.booking_id,
    JSON.stringify(result),
    KK_ADMIN_VERSION,
    ''
  ]);
  kkAssertBookingReceipt_(committed, 'COMMITTED', receipt.request_id, receipt.request_fingerprint);
  return Object.assign({}, result, { idempotent_replay: true });
}

function kkBookingMarkReceiptError_(receiptSheet, receipt, err) {
  if (!receipt || !receipt.row_number) return;
  try {
    const match = String(err && err.message || '').match(/^([A-Z][A-Z0-9_]{3,80})(?=:|$)/);
    const msg = match ? match[1] : 'BOOKING_OPERATION_FAILED';
    const current = receiptSheet.getRange(receipt.row_number, 1, 1, KK_BOOKING_RECEIPT_HEADERS.length).getValues()[0];
    if (current[0] !== receipt.request_id || current[1] !== receipt.request_fingerprint || current[2] !== 'PREPARED') return;
    current[14] = msg.slice(0, 1000);
    kkWriteBookingReceipt_(receiptSheet, receipt.row_number, current);
  } catch (_) {
    // Never hide/replace the original booking error because receipt diagnostics failed.
  }
}

// Override the legacy create writer with durable writer-side idempotency.
function kkBookingCreateWithReceipt_(payload) {
  const lock = kkAcquireDocumentLock_('create booking idempotent', 12000);
  let receiptSheet = null;
  let activeReceipt = null;
  try {
    const p = payload || {};
    const requestFingerprint = kkBookingRequestFingerprint_(p);
    const suppliedFingerprint = kkBookingCanonicalText_(p.request_fingerprint);
    if (suppliedFingerprint && suppliedFingerprint !== requestFingerprint) {
      throw new Error('request_fingerprint does not match canonical booking intent');
    }

    let requestId = kkBookingCanonicalText_(p.request_id);
    if (!requestId) requestId = 'AUTO-' + requestFingerprint.slice(0, 40);
    if (requestId.length > 128) throw new Error('request_id exceeds 128 characters');

    receiptSheet = kkEnsureBookingReceiptSheet_();
    const found = kkFindBookingReceipt_(receiptSheet, requestId);
    if (found) {
      activeReceipt = kkBookingReceiptObject_(found);
      if (activeReceipt.request_fingerprint !== requestFingerprint) {
        throw new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING_INTENT');
      }
      if (activeReceipt.status === 'COMMITTED') return kkBookingStoredResult_(activeReceipt);
      if (activeReceipt.status !== 'PREPARED') {
        throw new Error('Unknown booking request receipt status: ' + activeReceipt.status);
      }

      const recovered = kkFinalizePreparedBookingReceipt_(receiptSheet, activeReceipt);
      if (recovered) return recovered;
      // PREPARED but target row is still blank: resume safely using the exact
      // stored target row + assignments after revalidating current business state.
    }

    const eventId = kkBookingCanonicalText_(p.event_id);
    let templateId = kkBookingCanonicalText_(p.template_id);
    const customerName = kkBookingCanonicalText_(p.customer_name);
    const customerContact = p.customer_contact || '';
    const customerPhone = p.customer_phone || '';
    const contactChannel = p.contact_channel || 'LINE';
    const bookingStatus = kkBookingCanonicalText_(p.booking_status || 'confirmed').toLowerCase();
    let phoneAssetId = kkBookingCanonicalText_(p.phone_asset_id);
    let lensAssetId = kkBookingCanonicalText_(p.lens_asset_id);
    const pickupTime = kkBookingCanonicalText_(p.pickup_time);
    const paymentStatus = kkBookingCanonicalText_(p.payment_status || 'unpaid').toLowerCase();
    const amountReceived = kkApiNumber_(p.amount_received, 'amount_received', true) || 0;
    const bookingNote = p.booking_note || '';

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

    const pkgType = kkBookingCanonicalText_(pkg.package_type).toLowerCase();
    if (!['phone_only','lens_only','phone_lens_bundle'].includes(pkgType)) throw new Error('BOOKING_PACKAGE_TYPE_UNSUPPORTED');

    if (activeReceipt) {
      phoneAssetId = activeReceipt.phone_asset_id;
      lensAssetId = activeReceipt.lens_asset_id;
      if (phoneAssetId) kkValidateManualAsset_(phoneAssetId, 'phone', pkg.model_group, event.event_date);
      if (lensAssetId) kkValidateManualAsset_(lensAssetId, 'lens', pkg.lens_group, event.event_date);
    } else {
      if (phoneAssetId) kkValidateManualAsset_(phoneAssetId, 'phone', pkg.model_group, event.event_date);
      if (lensAssetId) kkValidateManualAsset_(lensAssetId, 'lens', pkg.lens_group, event.event_date);
      if ((pkgType === 'phone_only' || pkgType === 'phone_lens_bundle') && !phoneAssetId) {
        phoneAssetId = kkFindAvailableAsset_('phone', pkg.model_group, event.event_date);
      }
      if ((pkgType === 'lens_only' || pkgType === 'phone_lens_bundle') && !lensAssetId) {
        lensAssetId = kkFindAvailableAsset_('lens', pkg.lens_group, event.event_date);
      }
    }

    if ((pkgType !== 'lens_only' && !phoneAssetId) || (pkgType !== 'phone_only' && !lensAssetId)) throw new Error('BOOKING_REQUIRED_ASSET_MISSING');

    const targetRow = activeReceipt
      ? activeReceipt.target_row
      : kkNextAppendBookingRow_();

    kkAssertBookingTargetNotReserved_(receiptSheet, targetRow, requestId);
    const existingTarget = kkBookingTargetRowState_(targetRow);
    if (existingTarget.has_data) {
      if (activeReceipt && kkBookingWriteFingerprint_(existingTarget.row_b_to_t) === activeReceipt.write_fingerprint) {
        return kkFinalizePreparedBookingReceipt_(receiptSheet, activeReceipt);
      }
      throw new Error('BOOKING_REQUEST_RECONCILIATION_REQUIRED: reserved booking target row is no longer blank');
    }

    const bookingValues = [
      new Date(), bookingStatus, eventId, customerName, customerContact, customerPhone, contactChannel,
      pkgType, phoneAssetId, lensAssetId, pickupTime, '', paymentStatus, amountReceived, '', '', '', 0, bookingNote
    ];
    const writeFingerprint = kkBookingWriteFingerprint_(bookingValues);
    if (bookingValues.some(v => typeof v === 'string' && /^\s*=/.test(v))) throw new Error('BOOKING_FORMULA_INPUT_REJECTED');
    const expectedBookingId = kkExpectedBookingIdBeforeWrite_(event.event_date, targetRow, eventId);
    kkAssertBookingTargetNotReserved_(receiptSheet, targetRow, requestId, expectedBookingId);
    if (activeReceipt && activeReceipt.booking_id !== expectedBookingId) {
      throw new Error('BOOKING_REQUEST_RECONCILIATION_REQUIRED: expected booking identity changed before resume');
    }

    if (activeReceipt) {
      if (activeReceipt.write_fingerprint !== writeFingerprint) {
        throw new Error('BOOKING_REQUEST_RECONCILIATION_REQUIRED: PREPARED write fingerprint no longer matches current booking intent');
      }
    } else {
      const receiptRow = Math.max(receiptSheet.getLastRow() + 1, 2);
      activeReceipt = kkWriteBookingReceipt_(receiptSheet, receiptRow, [
        requestId,
        requestFingerprint,
        'PREPARED',
        targetRow,
        writeFingerprint,
        phoneAssetId,
        lensAssetId,
        eventId,
        templateId,
        new Date(),
        '',
        expectedBookingId,
        '',
        KK_ADMIN_VERSION,
        ''
      ]);
      kkAssertBookingReceipt_(activeReceipt, 'PREPARED', requestId, requestFingerprint);
    }

    // The booking_id formula lives in column A while the business write targets
    // B:T. Validate the target formula and reserve the exact expected globally
    // unique ID before any booking business cells are mutated.
    lock.assertHeld();
    if (kkBookingTargetRowState_(targetRow).has_data) throw new Error('BOOKING_TARGET_CHANGED_BEFORE_WRITE');
    if (kkExpectedBookingIdBeforeWrite_(event.event_date, targetRow, eventId) !== expectedBookingId) throw new Error('BOOKING_ID_CHANGED_BEFORE_WRITE');
    kkSheet_(KK.bookings).getRange(targetRow, 2, 1, 19).setValues([bookingValues]);
    SpreadsheetApp.flush();

    const stored = kkBookingTargetRowState_(targetRow);
    if (!stored.has_data) throw new Error('Booking write exact readback missing');
    const storedFingerprint = kkBookingWriteFingerprint_(stored.row_b_to_t);
    if (storedFingerprint !== writeFingerprint) {
      throw new Error('Booking write exact readback fingerprint mismatch');
    }
    if (stored.booking_id !== expectedBookingId) {
      throw new Error('BOOKING_ID_READBACK_MISMATCH: expected ' + expectedBookingId + ' got ' + stored.booking_id);
    }
    kkAssertBookingIdUnique_(stored.booking_id, targetRow);

    const result = {
      row_number: targetRow,
      booking_id: stored.booking_id,
      phone_asset_id: phoneAssetId,
      lens_asset_id: lensAssetId,
      request_id: requestId,
      request_fingerprint: requestFingerprint,
      idempotent_replay: false
    };

    const committed = kkWriteBookingReceipt_(receiptSheet, activeReceipt.row_number, [
      requestId,
      requestFingerprint,
      'COMMITTED',
      targetRow,
      writeFingerprint,
      phoneAssetId,
      lensAssetId,
      eventId,
      templateId,
      activeReceipt.prepared_at || new Date(),
      new Date(),
      stored.booking_id,
      JSON.stringify(result),
      KK_ADMIN_VERSION,
      ''
    ]);
    kkAssertBookingReceipt_(committed, 'COMMITTED', requestId, requestFingerprint);

    return result;
  } catch (err) {
    if (receiptSheet && activeReceipt && activeReceipt.status === 'PREPARED') {
      try { lock.assertHeld(); kkBookingMarkReceiptError_(receiptSheet, activeReceipt, err); }
      catch (_) { /* Ownership loss: no diagnostic write and preserve original error. */ }
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}
