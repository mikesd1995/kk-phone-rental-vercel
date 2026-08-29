/**
 * KK Phone Rental — Core v1 Notification Transport
 * Scope: _Notification_Ledger -> Telegram + LINE only.
 * Safety: read/write only the Event Tracker notification/status/reconciliation sheets.
 * Does NOT scan events, change monthly event truth, pricing, booking, DCRM, or public site.
 */

const KK_CORE_V1 = Object.freeze({
  spreadsheetId: '1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo',
  timezone: 'Asia/Bangkok',
  ledgerSheet: '_Notification_Ledger',
  coreStatusSheet: '_Core_V1_Status',
  reconciliationSheet: '_Reconciliation_Log',
  maxPerRun: 10,
  handler: 'kkCoreV1SendPendingNotifications',
  menuHandler: 'kkCoreV1AddMenu',
  props: Object.freeze({
    telegramToken: 'KK_TELEGRAM_BOT_TOKEN',
    telegramChatId: 'KK_TELEGRAM_CHAT_ID',
    lineToken: 'KK_LINE_CHANNEL_ACCESS_TOKEN',
    lineTargetId: 'KK_LINE_TARGET_ID',
    active: 'KK_CORE_V1_ACTIVE',
    activatedAt: 'KK_CORE_V1_ACTIVATED_AT'
  })
});

function kkCoreV1Spreadsheet_() {
  try {
    const active = SpreadsheetApp.getActive();
    if (active && active.getId() === KK_CORE_V1.spreadsheetId) return active;
  } catch (_) {}
  return SpreadsheetApp.openById(KK_CORE_V1.spreadsheetId);
}

function kkCoreV1Sheet_(name) {
  const sh = kkCoreV1Spreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Missing required sheet: ' + name);
  return sh;
}

function kkCoreV1NowIso_() {
  return Utilities.formatDate(new Date(), KK_CORE_V1.timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function kkCoreV1Prompt_(ui, title, message, currentValue) {
  const suffix = currentValue ? '\n\nมีค่าเดิมอยู่แล้ว กด Cancel เพื่อเก็บค่าเดิม' : '';
  const r = ui.prompt(title, message + suffix, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() === ui.Button.CANCEL) return currentValue || '';
  return String(r.getResponseText() || '').trim();
}

function kkCoreV1SetupInteractive() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const telegramToken = kkCoreV1Prompt_(ui, 'Telegram Bot Token', 'วาง Bot Token ของ Telegram', props.getProperty(KK_CORE_V1.props.telegramToken));
  const telegramChatId = kkCoreV1Prompt_(ui, 'Telegram Chat ID', 'วาง Chat ID ที่ต้องการรับแจ้งเตือน', props.getProperty(KK_CORE_V1.props.telegramChatId));
  const lineToken = kkCoreV1Prompt_(ui, 'LINE Channel Access Token', 'วาง Channel Access Token ของ LINE Messaging API', props.getProperty(KK_CORE_V1.props.lineToken));
  const lineTargetId = kkCoreV1Prompt_(ui, 'LINE Target ID', 'วาง LINE userId / groupId / roomId ที่ต้องการรับแจ้งเตือน', props.getProperty(KK_CORE_V1.props.lineTargetId));

  if (!telegramToken || !telegramChatId || !lineToken || !lineTargetId) {
    throw new Error('Setup incomplete: Telegram และ LINE ต้องมี credential/target ครบทั้ง 4 ค่า');
  }

  props.setProperties({
    [KK_CORE_V1.props.telegramToken]: telegramToken,
    [KK_CORE_V1.props.telegramChatId]: telegramChatId,
    [KK_CORE_V1.props.lineToken]: lineToken,
    [KK_CORE_V1.props.lineTargetId]: lineTargetId,
    [KK_CORE_V1.props.active]: 'TRUE',
    [KK_CORE_V1.props.activatedAt]: props.getProperty(KK_CORE_V1.props.activatedAt) || kkCoreV1NowIso_()
  }, false);

  kkCoreV1InstallTriggers_();
  kkCoreV1AddMenu();
  kkCoreV1SetCoreStatus_('Telegram Delivery', 'READY_UAT', '', 'Run transport UAT');
  kkCoreV1SetCoreStatus_('LINE Delivery', 'READY_UAT', '', 'Run transport UAT');

  ui.alert('Core v1 transport พร้อมทดสอบ\n\nขั้นต่อไป: เมนู KK Core v1 → Run Telegram + LINE UAT');
}

function kkCoreV1InstallTriggers_() {
  const ss = kkCoreV1Spreadsheet_();
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const h = trigger.getHandlerFunction();
    if (h === KK_CORE_V1.handler || h === KK_CORE_V1.menuHandler) ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger(KK_CORE_V1.handler)
    .timeBased()
    .everyMinutes(5)
    .create();

  ScriptApp.newTrigger(KK_CORE_V1.menuHandler)
    .forSpreadsheet(ss)
    .onOpen()
    .create();
}

function kkCoreV1AddMenu() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('KK Core v1')
      .addItem('Setup / Update Telegram + LINE', 'kkCoreV1SetupInteractive')
      .addItem('Run Telegram + LINE UAT', 'kkCoreV1RunTransportUAT')
      .addItem('Send Pending Now', 'kkCoreV1SendPendingNotifications')
      .addItem('Show Transport Health', 'kkCoreV1ShowHealth')
      .addSeparator()
      .addItem('Pause Transport', 'kkCoreV1PauseTransport')
      .addToUi();
  } catch (_) {}
}

function kkCoreV1PauseTransport() {
  PropertiesService.getScriptProperties().setProperty(KK_CORE_V1.props.active, 'FALSE');
  kkCoreV1SetCoreStatus_('Telegram Delivery', 'PAUSED', '', 'Re-enable with Setup / Update Telegram + LINE');
  kkCoreV1SetCoreStatus_('LINE Delivery', 'PAUSED', '', 'Re-enable with Setup / Update Telegram + LINE');
  SpreadsheetApp.getUi().alert('Core v1 notification transport paused');
}

function kkCoreV1Headers_(sheet) {
  const width = Math.max(sheet.getLastColumn(), 23);
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    const key = String(h || '').trim();
    if (key) map[key] = i;
  });
  const required = [
    'Notification ID','Created At','Change Type','Priority','Quiet Hours Policy','Payload','Transport','Status',
    'Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status',
    'Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error'
  ];
  const missing = required.filter(h => typeof map[h] === 'undefined');
  if (missing.length) throw new Error('Notification Ledger missing columns: ' + missing.join(', '));
  return map;
}

function kkCoreV1IsQuietHours_() {
  const hour = Number(Utilities.formatDate(new Date(), KK_CORE_V1.timezone, 'H'));
  return hour >= 23 || hour < 7;
}

function kkCoreV1CriticalOverride_(row, h) {
  const priority = String(row[h['Priority']] || '').toUpperCase();
  const change = String(row[h['Change Type']] || '').toUpperCase();
  if (priority.indexOf('P0') === 0) return true;
  return ['CANCELLED','POSTPONED','DATE_CHANGE','VENUE_CHANGE'].some(x => change.indexOf(x) >= 0);
}

function kkCoreV1DateDue_(value) {
  if (!value) return true;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return true;
  return d.getTime() <= Date.now();
}

function kkCoreV1RetryAt_(attempt) {
  const mins = [5, 15, 60, 180, 360];
  const delay = mins[Math.min(Math.max(Number(attempt || 1) - 1, 0), mins.length - 1)];
  return new Date(Date.now() + delay * 60 * 1000);
}

function kkCoreV1HeaderValue_(headers, name) {
  const target = String(name || '').toLowerCase();
  for (const k in headers) {
    if (String(k).toLowerCase() === target) {
      const v = headers[k];
      return Array.isArray(v) ? String(v[0] || '') : String(v || '');
    }
  }
  return '';
}

function kkCoreV1SendTelegram_(text) {
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty(KK_CORE_V1.props.telegramToken) || '').trim();
  const chatId = String(props.getProperty(KK_CORE_V1.props.telegramChatId) || '').trim();
  if (!token || !chatId) throw new Error('Missing Telegram credential/target');

  const safeText = String(text || '').slice(0, 3900);
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: safeText,
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  let parsed = {};
  try { parsed = JSON.parse(body || '{}'); } catch (_) {}
  if (status < 200 || status >= 300 || parsed.ok !== true) {
    throw new Error('Telegram HTTP ' + status + ': ' + String(parsed.description || body || 'unknown').slice(0, 400));
  }

  return {
    httpStatus: status,
    providerMessageId: parsed.result && parsed.result.message_id ? String(parsed.result.message_id) : '',
    evidence: JSON.stringify({ ok: true, message_id: parsed.result && parsed.result.message_id ? parsed.result.message_id : null }).slice(0, 900)
  };
}

function kkCoreV1SendLine_(text) {
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty(KK_CORE_V1.props.lineToken) || '').trim();
  const target = String(props.getProperty(KK_CORE_V1.props.lineTargetId) || '').trim();
  if (!token || !target) throw new Error('Missing LINE credential/target');

  const safeText = String(text || '').slice(0, 4900);
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      to: target,
      messages: [{ type: 'text', text: safeText }]
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  const requestId = kkCoreV1HeaderValue_(response.getHeaders(), 'x-line-request-id');
  if (status < 200 || status >= 300) {
    throw new Error('LINE HTTP ' + status + ': ' + String(body || 'unknown').slice(0, 400));
  }

  return {
    httpStatus: status,
    providerMessageId: requestId,
    evidence: JSON.stringify({ accepted: true, request_id: requestId || null, response: String(body || '').slice(0, 300) }).slice(0, 900)
  };
}

function kkCoreV1Cell_(sheet, rowNumber, columnIndexZeroBased) {
  return sheet.getRange(rowNumber, columnIndexZeroBased + 1);
}

function kkCoreV1WriteTransportState_(sheet, rowNumber, h, patch) {
  Object.keys(patch).forEach(header => {
    if (typeof h[header] !== 'undefined') kkCoreV1Cell_(sheet, rowNumber, h[header]).setValue(patch[header]);
  });
  SpreadsheetApp.flush();
}

function kkCoreV1SendPendingNotifications() {
  const props = PropertiesService.getScriptProperties();
  if (String(props.getProperty(KK_CORE_V1.props.active) || '').toUpperCase() !== 'TRUE') return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;

  try {
    const sheet = kkCoreV1Sheet_(KK_CORE_V1.ledgerSheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const h = kkCoreV1Headers_(sheet);
    const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 23)).getValues();
    const sentKeys = new Set();

    values.forEach(row => {
      const status = String(row[h['Status']] || '').trim().toUpperCase();
      const dedup = String(row[h['Dedup Key']] || '').trim();
      const transport = String(row[h['Transport']] || '').trim().toUpperCase();
      if (status === 'SENT' && dedup && transport) sentKeys.add(transport + '|' + dedup);
    });

    let processed = 0;
    for (let i = 0; i < values.length && processed < KK_CORE_V1.maxPerRun; i++) {
      const row = values[i];
      const rowNumber = i + 2;
      const status = String(row[h['Status']] || '').trim().toUpperCase();

      // Historical quarantine rows are intentionally ignored: no backlog flood.
      if (status !== 'QUEUED' && status !== 'RETRY_WAIT') continue;
      if (!kkCoreV1DateDue_(row[h['Next Retry At']])) continue;

      const payload = String(row[h['Payload']] || '').trim();
      const transport = String(row[h['Transport']] || '').trim().toUpperCase();
      const dedup = String(row[h['Dedup Key']] || '').trim();
      if (!payload || !transport || !dedup) {
        kkCoreV1WriteTransportState_(sheet, rowNumber, h, {
          'Status': 'FAILED_PERMANENT',
          'Last Error': 'Missing payload, transport or dedup key'
        });
        continue;
      }

      if (kkCoreV1IsQuietHours_() && !kkCoreV1CriticalOverride_(row, h)) continue;

      const sentKey = transport + '|' + dedup;
      if (sentKeys.has(sentKey)) {
        kkCoreV1WriteTransportState_(sheet, rowNumber, h, {
          'Status': 'SKIPPED_DUPLICATE',
          'Delivery Evidence': 'Existing SENT row has same Transport + Dedup Key',
          'Last Error': ''
        });
        processed++;
        continue;
      }

      const attempt = Number(row[h['Attempt Count']] || 0) + 1;
      const attemptAt = new Date();
      kkCoreV1WriteTransportState_(sheet, rowNumber, h, {
        'Status': 'SENDING',
        'Attempt Count': attempt,
        'Last Attempt At': attemptAt,
        'Last Error': ''
      });

      try {
        let result;
        if (transport === 'TELEGRAM_OWNER_ALERTS') {
          result = kkCoreV1SendTelegram_(payload);
        } else if (transport === 'LINE_OWNER_ALERTS') {
          result = kkCoreV1SendLine_(payload);
        } else {
          throw new Error('Unsupported transport: ' + transport);
        }

        const confirmedAt = new Date();
        kkCoreV1WriteTransportState_(sheet, rowNumber, h, {
          'Status': 'SENT',
          'Delivery Evidence': result.evidence || '',
          'Next Retry At': '',
          'HTTP Status': result.httpStatus || '',
          'Provider Message ID': result.providerMessageId || '',
          'API Accepted At': confirmedAt,
          'Delivery Confirmed At': confirmedAt,
          'Last Error': ''
        });
        sentKeys.add(sentKey);
      } catch (err) {
        kkCoreV1WriteTransportState_(sheet, rowNumber, h, {
          'Status': attempt >= 8 ? 'FAILED_PERMANENT' : 'RETRY_WAIT',
          'Next Retry At': attempt >= 8 ? '' : kkCoreV1RetryAt_(attempt),
          'Last Error': String(err && err.message ? err.message : err).slice(0, 1000)
        });
      }
      processed++;
    }
  } finally {
    lock.releaseLock();
  }
}

function kkCoreV1AppendLedgerRow_(transport, payload, dedupSuffix) {
  const sheet = kkCoreV1Sheet_(KK_CORE_V1.ledgerSheet);
  const h = kkCoreV1Headers_(sheet);
  const width = Math.max(sheet.getLastColumn(), 23);
  const row = new Array(width).fill('');
  const stamp = Utilities.formatDate(new Date(), KK_CORE_V1.timezone, 'yyyyMMddHHmmss');
  const channel = transport === 'TELEGRAM_OWNER_ALERTS' ? 'TELEGRAM' : 'LINE';

  const assign = (header, value) => { row[h[header]] = value; };
  assign('Notification ID', 'NTF|COREV1|UAT|' + stamp + '|' + channel);
  assign('Created At', new Date());
  assign('Event Family ID', 'CORE_V1_UAT');
  assign('Show ID', 'CORE_V1_UAT');
  assign('Change Type', 'UAT_CANARY');
  assign('Priority', 'P0');
  assign('Quiet Hours Policy', 'UAT_BYPASS');
  assign('Payload', payload);
  assign('Transport', transport);
  assign('Status', 'QUEUED');
  assign('Attempt Count', 0);
  assign('Dedup Key', transport + '|CORE_V1_UAT|' + stamp + '|' + dedupSuffix);
  assign('Notes', 'CORE_V1_TRANSPORT_UAT');

  const targetRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(targetRow, 1, 1, width).setValues([row]);
  return targetRow;
}

function kkCoreV1RunTransportUAT() {
  const props = PropertiesService.getScriptProperties();
  if (String(props.getProperty(KK_CORE_V1.props.active) || '').toUpperCase() !== 'TRUE') {
    throw new Error('Transport is not active. Run kkCoreV1SetupInteractive first.');
  }

  const timestamp = kkCoreV1NowIso_();
  kkCoreV1AppendLedgerRow_(
    'TELEGRAM_OWNER_ALERTS',
    '✅ KK Phone Rental Core v1\nTelegram transport UAT\nเวลา ' + timestamp + '\nถ้าเห็นข้อความนี้ แปลว่า Ledger → Telegram ทำงานแล้ว',
    'TG'
  );
  kkCoreV1AppendLedgerRow_(
    'LINE_OWNER_ALERTS',
    '✅ KK Phone Rental Core v1\nLINE transport UAT\nเวลา ' + timestamp + '\nถ้าเห็นข้อความนี้ แปลว่า Ledger → LINE ทำงานแล้ว',
    'LINE'
  );

  kkCoreV1SendPendingNotifications();
  Utilities.sleep(800);

  const sh = kkCoreV1Sheet_(KK_CORE_V1.ledgerSheet);
  const h = kkCoreV1Headers_(sh);
  const last = sh.getLastRow();
  const recent = sh.getRange(Math.max(2, last - 3), 1, Math.min(4, last - 1), Math.max(sh.getLastColumn(), 23)).getValues();
  let tgPass = false;
  let linePass = false;
  recent.forEach(row => {
    const notes = String(row[h['Notes']] || '');
    if (notes !== 'CORE_V1_TRANSPORT_UAT') return;
    const status = String(row[h['Status']] || '').toUpperCase();
    const transport = String(row[h['Transport']] || '').toUpperCase();
    if (status === 'SENT' && transport === 'TELEGRAM_OWNER_ALERTS') tgPass = true;
    if (status === 'SENT' && transport === 'LINE_OWNER_ALERTS') linePass = true;
  });

  kkCoreV1SetCoreStatus_('Telegram Delivery', tgPass ? 'PASS_UAT' : 'UAT_FAILED', tgPass ? '' : 'Check newest Ledger UAT row Last Error', tgPass ? 'Wait for full E2E event UAT' : 'Fix credential/target and rerun UAT');
  kkCoreV1SetCoreStatus_('LINE Delivery', linePass ? 'PASS_UAT' : 'UAT_FAILED', linePass ? '' : 'Check newest Ledger UAT row Last Error', linePass ? 'Wait for full E2E event UAT' : 'Fix credential/target and rerun UAT');
  kkCoreV1SetCoreStatus_('Core v1 End-to-End UAT', 'WAITING_REAL_E2E', 'Transport-only UAT is not full scanner E2E proof', 'Use next eligible NEW/material event and read back both SENT rows');

  SpreadsheetApp.getUi().alert(
    'Transport UAT\nTelegram: ' + (tgPass ? 'PASS' : 'FAIL') + '\nLINE: ' + (linePass ? 'PASS' : 'FAIL') +
    '\n\nFull Core v1 ยังไม่ PASS จนกว่าจะผ่าน Scan → Verify → Sheet → Ledger → ทั้ง 2 ช่องทาง'
  );
}

function kkCoreV1SetCoreStatus_(component, status, blocker, nextAction) {
  try {
    const sh = kkCoreV1Sheet_(KK_CORE_V1.coreStatusSheet);
    const rows = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), Math.max(sh.getLastColumn(), 10)).getValues();
    let target = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === component) { target = i + 1; break; }
    }
    if (target < 0) return;
    sh.getRange(target, 3).setValue(status);
    sh.getRange(target, 6).setValue(blocker || '');
    sh.getRange(target, 7).setValue(nextAction || '');
    sh.getRange(target, 9).setValue(kkCoreV1NowIso_());
  } catch (_) {}
}

function kkCoreV1ShowHealth() {
  const props = PropertiesService.getScriptProperties();
  const sh = kkCoreV1Sheet_(KK_CORE_V1.ledgerSheet);
  const h = kkCoreV1Headers_(sh);
  const rows = sh.getLastRow() >= 2
    ? sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 23)).getValues()
    : [];
  const counts = {};
  rows.forEach(row => {
    const status = String(row[h['Status']] || 'BLANK').toUpperCase();
    counts[status] = (counts[status] || 0) + 1;
  });
  const secrets = {
    telegramToken: !!props.getProperty(KK_CORE_V1.props.telegramToken),
    telegramChatId: !!props.getProperty(KK_CORE_V1.props.telegramChatId),
    lineToken: !!props.getProperty(KK_CORE_V1.props.lineToken),
    lineTargetId: !!props.getProperty(KK_CORE_V1.props.lineTargetId)
  };
  SpreadsheetApp.getUi().alert(
    'KK Core v1 Transport Health\n\nActive: ' + props.getProperty(KK_CORE_V1.props.active) +
    '\nTelegram configured: ' + (secrets.telegramToken && secrets.telegramChatId) +
    '\nLINE configured: ' + (secrets.lineToken && secrets.lineTargetId) +
    '\nQUEUED: ' + (counts.QUEUED || 0) +
    '\nRETRY_WAIT: ' + (counts.RETRY_WAIT || 0) +
    '\nSENT: ' + (counts.SENT || 0) +
    '\nLegacy HOLD (ignored): ' + (counts.HOLD_TRANSPORT_QUARANTINE || 0)
  );
}
