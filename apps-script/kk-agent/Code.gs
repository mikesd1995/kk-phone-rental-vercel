const KK_LINE_CONFIG = Object.freeze({
  SPREADSHEET_ID:
    '1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo',

  AUDIT_SHEET:
    '_Audit_Log',

  SCAN_STATUS_SHEET:
    '_Scan_Status',

  TIME_ZONE:
    'Asia/Bangkok',

  SCAN_ROUNDS: [
    {
      time: '07:00',
      minutes: 7 * 60
    },
    {
      time: '13:00',
      minutes: 13 * 60
    },
    {
      time: '20:00',
      minutes: 20 * 60
    }
  ],

  SCAN_GRACE_MINUTES:
    45,

  LAST_SENT_AUDIT_ROW_KEY:
    'LINE_LAST_SENT_AUDIT_ROW',

  MONITOR_START_KEY:
    'KK_LINE_MONITOR_START',

  SCAN_ALERTS_KEY:
    'KK_LINE_SCAN_ALERTS',

  MONITOR_ERROR_KEY:
    'KK_LINE_MONITOR_ERROR',

  MAX_TEXT_CHARS:
    4300
});


/* =========================================================
   ฟังก์ชันที่ผู้ใช้กดเรียกใช้
   ========================================================= */


/**
 * ทดสอบการส่ง LINE
 */
function sendLineTest() {
  sendLineText_(
    '✅ เชื่อมต่อระบบแจ้งเตือน KK Phone Rental สำเร็จ'
  );
}


/**
 * ตั้งจุดเริ่มต้นของระบบ
 *
 * กดครั้งเดียวหลังเปลี่ยนโค้ด
 * ระบบจะไม่ส่งประวัติเก่าทั้งหมด
 */
function initializeKKLineSystem() {
  const spreadsheet =
    SpreadsheetApp.openById(
      KK_LINE_CONFIG.SPREADSHEET_ID
    );

  const auditSheet =
    spreadsheet.getSheetByName(
      KK_LINE_CONFIG.AUDIT_SHEET
    );

  const scanStatusSheet =
    spreadsheet.getSheetByName(
      KK_LINE_CONFIG.SCAN_STATUS_SHEET
    );

  if (!auditSheet) {
    throw new Error(
      `ไม่พบชีต ${KK_LINE_CONFIG.AUDIT_SHEET}`
    );
  }

  if (!scanStatusSheet) {
    throw new Error(
      `ไม่พบชีต ${KK_LINE_CONFIG.SCAN_STATUS_SHEET}`
    );
  }

  const properties =
    PropertiesService.getScriptProperties();

  const currentAuditLastRow =
    Math.max(
      auditSheet.getLastRow(),
      1
    );

  const now = new Date();

  const monitorStart =
    `${formatLocalDate_(now)}|` +
    `${formatLocalTime_(now)}`;

  properties.setProperties({
    [KK_LINE_CONFIG.LAST_SENT_AUDIT_ROW_KEY]:
      String(currentAuditLastRow),

    [KK_LINE_CONFIG.MONITOR_START_KEY]:
      monitorStart,

    [KK_LINE_CONFIG.SCAN_ALERTS_KEY]:
      '{}'
  });

  properties.deleteProperty(
    KK_LINE_CONFIG.MONITOR_ERROR_KEY
  );

  console.log(
    'ตั้งค่าระบบเรียบร้อย'
  );

  console.log(
    `เริ่มติดตาม _Audit_Log หลังแถว ${currentAuditLastRow}`
  );

  console.log(
    `เริ่มตรวจสถานะสแกนตั้งแต่ ${monitorStart}`
  );
}


/**
 * ทดสอบข้อความงานล่าสุดจาก _Audit_Log
 *
 * ไม่กระทบตำแหน่งการติดตามจริง
 */
function previewLatestAuditToLine() {
  const spreadsheet =
    SpreadsheetApp.openById(
      KK_LINE_CONFIG.SPREADSHEET_ID
    );

  const auditSheet =
    spreadsheet.getSheetByName(
      KK_LINE_CONFIG.AUDIT_SHEET
    );

  if (!auditSheet) {
    throw new Error(
      `ไม่พบชีต ${KK_LINE_CONFIG.AUDIT_SHEET}`
    );
  }

  const lastRow =
    auditSheet.getLastRow();

  if (lastRow < 2) {
    throw new Error(
      'ยังไม่มีรายการใน _Audit_Log'
    );
  }

  const row =
    auditSheet
      .getRange(
        lastRow,
        1,
        1,
        16
      )
      .getDisplayValues()[0];

  const item =
    auditRowToItem_(
      row,
      lastRow
    );

  sendLineText_(
    formatAuditLineMessage_(
      [item]
    )
  );
}


/**
 * ทดสอบตัวอย่างแจ้งระบบสแกนขัดข้อง
 *
 * เป็นเพียงข้อความทดสอบ
 * ไม่เปลี่ยนสถานะจริง
 */
function previewScanProblemToLine() {
  const now = new Date();

  const message = [
    '⚠️ ระบบสแกน KK Phone Rental',
    '',
    'ไม่พบผลสแกนรอบ 13:00 น.',
    `วันที่ ${formatThaiDate_(now)}`,
    '',
    'ระบบจะแจ้งอีกครั้งเมื่อกลับมาทำงาน'
  ].join('\n');

  sendLineText_(message);
}


/**
 * ทดสอบตัวอย่างระบบกลับมาทำงาน
 */
function previewScanRecoveryToLine() {
  const now = new Date();

  const message = [
    '✅ ระบบสแกนกลับมาทำงานแล้ว',
    '',
    'รอบสแกน: 13:00 น.',
    `สำเร็จเวลา: ${formatLocalTime_(now)} น.`
  ].join('\n');

  sendLineText_(message);
}


/**
 * ฟังก์ชัน Trigger เดิมที่ใช้เป็นสะพาน cutover เพียงตัวเดียว
 *
 * สำคัญ:
 * - ไม่อ่านหรือส่งจาก _Audit_Log อีกต่อไป
 * - ตรวจสุขภาพสแกนแบบ read-only เท่านั้น
 * - การส่ง Telegram/LINE ทั้งหมดต้องผ่าน _Notification_Ledger
 */
function runKKLineMonitor() {
  let scanHealth;
  try {
    scanHealth =
      getKKScanHealthReadOnly();
  } catch (error) {
    scanHealth = {
      status:
        'READ_FAILED',
      error:
        safeText_(
          error && error.message
            ? error.message
            : error
        ).slice(0, 300)
    };
    console.error(
      JSON.stringify(scanHealth)
    );
  }

  const notifier =
    runCoreV1Notifier();

  const result = {
    scan_health:
      scanHealth,
    notifier:
      notifier
  };

  console.log(
    JSON.stringify(result)
  );

  return result;
}


/**
 * อ่านสถานะสแกนโดยไม่เขียนชีต, Script Properties หรือส่งข้อความ
 * ไม่ใช้กฎรอบ 07:00/13:00/20:00 ของ legacy เพื่อตัดสินระบบใหม่
 */
function getKKScanHealthReadOnly() {
  const properties =
    PropertiesService
      .getScriptProperties()
      .getProperties();

  const spreadsheetId =
    properties.CORE_V1_SPREADSHEET_ID ||
    KK_LINE_CONFIG.SPREADSHEET_ID;

  const spreadsheet =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  const statusSheet =
    spreadsheet.getSheetByName(
      KK_LINE_CONFIG.SCAN_STATUS_SHEET
    );

  if (!statusSheet) {
    throw new Error(
      `ไม่พบชีต ${KK_LINE_CONFIG.SCAN_STATUS_SHEET}`
    );
  }

  const rows =
    readRecentScanStatusRows_(
      statusSheet
    );

  const today =
    formatLocalDate_(
      new Date()
    );

  let latest = null;
  let latestSuccess = null;
  let todayRunCount = 0;

  for (
    let index = rows.length - 1;
    index >= 0;
    index -= 1
  ) {
    const row = rows[index];
    const record = {
      scan_date:
        safeText_(row[0]),
      scheduled_round:
        safeText_(row[1]),
      started_at:
        safeText_(row[2]),
      finished_at:
        safeText_(row[3]),
      status:
        normalizeUpper_(row[4]),
      change_count:
        safeText_(row[5]),
      run_key:
        safeText_(row[7])
    };

    if (record.scan_date === today) {
      todayRunCount += 1;
    }

    if (!latest && record.run_key) {
      latest = record;
    }

    if (
      !latestSuccess &&
      record.run_key &&
      record.status === 'SUCCESS'
    ) {
      latestSuccess = record;
    }
  }

  return {
    status:
      latest
        ? 'OBSERVED'
        : 'NO_SCAN_ROWS',
    mode:
      'READ_ONLY_NO_PROVIDER_SIDE_EFFECT',
    legacy_round_assertion:
      'DISABLED_DURING_CUTOVER',
    observed_date:
      today,
    rows_checked:
      rows.length,
    today_run_count:
      todayRunCount,
    latest_run:
      latest,
    latest_success:
      latestSuccess
  };
}


/**
 * สร้าง Trigger ตรวจทุก 10 นาที
 *
 * กดครั้งเดียว
 */
function createKKLineMonitorTrigger() {
  return setupCoreV1Notifier();
}


/**
 * ลบ Trigger เก่าของระบบนี้
 */
function deleteOldKKLineTriggers_() {
  throw new Error(
    'LEGACY_TRIGGER_DELETE_DISABLED_USE_SETUP_CORE_V1_NOTIFIER'
  );

  const handlerNames = [
    'runKKLineMonitor',
    'sendAuditLogUpdates',
    'sendAuditLogUpdates_',
    'checkScanHealth',
    'checkScanHealth_'
  ];

  const triggers =
    ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    if (
      handlerNames.includes(
        trigger.getHandlerFunction()
      )
    ) {
      ScriptApp.deleteTrigger(
        trigger
      );
    }
  });
}


/* =========================================================
   ระบบแจ้งงานใหม่และรายการแก้ไข
   ========================================================= */


/**
 * ตรวจรายการใหม่ใน _Audit_Log
 */
function sendAuditLogUpdates_() {
  throw new Error(
    'LEGACY_AUDIT_LOG_TRANSPORT_DISABLED_USE_NOTIFICATION_LEDGER'
  );

  const spreadsheet =
    SpreadsheetApp.openById(
      KK_LINE_CONFIG.SPREADSHEET_ID
    );

  const auditSheet =
    spreadsheet.getSheetByName(
      KK_LINE_CONFIG.AUDIT_SHEET
    );

  if (!auditSheet) {
    throw new Error(
      `ไม่พบชีต ${KK_LINE_CONFIG.AUDIT_SHEET}`
    );
  }

  const properties =
    PropertiesService.getScriptProperties();

  const savedRow =
    properties.getProperty(
      KK_LINE_CONFIG.LAST_SENT_AUDIT_ROW_KEY
    );

  if (savedRow === null) {
    throw new Error(
      'กรุณาเรียกใช้ initializeKKLineSystem ก่อน'
    );
  }

  const lastSentRow =
    Math.max(
      Number(savedRow) || 1,
      1
    );

  const currentLastRow =
    auditSheet.getLastRow();

  /*
   * มีการลบแถวใน Audit Log
   */
  if (currentLastRow < lastSentRow) {
    properties.setProperty(
      KK_LINE_CONFIG.LAST_SENT_AUDIT_ROW_KEY,
      String(currentLastRow)
    );

    console.log(
      'จำนวนแถว _Audit_Log ลดลง ระบบปรับจุดติดตามใหม่แล้ว'
    );

    return;
  }

  /*
   * ไม่มีรายการใหม่
   */
  if (currentLastRow <= lastSentRow) {
    console.log(
      'ไม่มีรายการงานใหม่'
    );
    return;
  }

  const startRow =
    lastSentRow + 1;

  const rowCount =
    currentLastRow - lastSentRow;

  const rows =
    auditSheet
      .getRange(
        startRow,
        1,
        rowCount,
        16
      )
      .getDisplayValues();

  const items = [];

  rows.forEach((row, index) => {
    const auditRowNumber =
      startRow + index;

    const eventName =
      safeText_(row[3]);

    const changeType =
      safeText_(row[6]);

    if (!eventName || !changeType) {
      return;
    }

    items.push(
      auditRowToItem_(
        row,
        auditRowNumber
      )
    );
  });

  if (items.length === 0) {
    properties.setProperty(
      KK_LINE_CONFIG.LAST_SENT_AUDIT_ROW_KEY,
      String(currentLastRow)
    );

    return;
  }

  const messageGroups =
    createAuditMessageGroups_(
      items
    );

  messageGroups.forEach(group => {
    sendLineText_(
      formatAuditLineMessage_(
        group.items
      )
    );

    /*
     * บันทึกหลังส่งสำเร็จแต่ละชุด
     * ป้องกันแจ้งซ้ำทั้งหมด
     */
    properties.setProperty(
      KK_LINE_CONFIG.LAST_SENT_AUDIT_ROW_KEY,
      String(group.endRow)
    );
  });

  properties.setProperty(
    KK_LINE_CONFIG.LAST_SENT_AUDIT_ROW_KEY,
    String(currentLastRow)
  );

  console.log(
    `ส่งรายการถึงแถว ${currentLastRow} เรียบร้อย`
  );
}


/**
 * แปลงหนึ่งแถวจาก _Audit_Log
 *
 * D ชื่องาน
 * E วันที่งาน
 * G Change Type
 * H Old Value
 * I New Value
 * P Notes
 */
function auditRowToItem_(
  row,
  auditRowNumber
) {
  const eventName =
    safeText_(row[3]) ||
    'ไม่ระบุชื่องาน';

  const eventDate =
    safeText_(row[4]) ||
    'ไม่ระบุวันที่';

  const changeType =
    safeText_(row[6]);

  const oldValue =
    safeText_(row[7]);

  const newValue =
    safeText_(row[8]);

  const notes =
    safeText_(row[15]);

  const isNewEvent =
    isNewEventType_(
      changeType
    );

  return {
    auditRowNumber:
      auditRowNumber,

    eventName:
      eventName,

    eventDate:
      eventDate,

    isNewEvent:
      isNewEvent,

    notificationType:
      isNewEvent
        ? '🆕 งานใหม่'
        : '🔄 ปรับปรุงแก้ไขรายการ',

    changeDetail:
      isNewEvent
        ? ''
        : buildChangeDetail_(
            changeType,
            oldValue,
            newValue,
            notes
          )
  };
}


/**
 * ตรวจว่าเป็นงานใหม่หรือไม่
 */
function isNewEventType_(
  changeType
) {
  const text =
    normalizeUpper_(
      changeType
    );

  const keywords = [
    'NEW EVENT',
    'BACKFILL ADDED',
    'NEW FUTURE EVENT',
    'ADD EVENT',
    'ADDED',
    'เพิ่มงานใหม่',
    'เพิ่มรายการใหม่',
    'งานใหม่'
  ];

  return keywords.some(
    keyword =>
      text.includes(
        normalizeUpper_(keyword)
      )
  );
}


/**
 * สร้างรายละเอียดว่าแก้ไขอะไร
 */
function buildChangeDetail_(
  changeType,
  oldValue,
  newValue,
  notes
) {
  const typeText =
    normalizeUpper_(
      changeType
    );

  let label =
    safeText_(changeType) ||
    'ปรับปรุงข้อมูล';

  if (
    containsAny_(
      typeText,
      [
        'CANCEL',
        'CANCELLED',
        'CANCELED',
        'ยกเลิก'
      ]
    )
  ) {
    label = 'ยกเลิกงาน';

  } else if (
    containsAny_(
      typeText,
      [
        'RESCHEDULE',
        'POSTPONE',
        'DATE CHANGED',
        'DATE UPDATE',
        'EVENT DATE',
        'เลื่อนวัน',
        'เลื่อนงาน',
        'เปลี่ยนวัน',
        'แก้ไขวันที่',
        'วันจัดงาน'
      ]
    )
  ) {
    label =
      'เลื่อน/แก้ไขวันจัดงาน';

  } else if (
    containsAny_(
      typeText,
      [
        'ADD SHOW',
        'ADDED SHOW',
        'EXTRA SHOW',
        'ADDITIONAL SHOW',
        'SHOW ADDED',
        'เพิ่มรอบ',
        'เปิดรอบเพิ่ม'
      ]
    )
  ) {
    label =
      'เพิ่มรอบการแสดง';

  } else if (
    containsAny_(
      typeText,
      [
        'TIME CHANGED',
        'TIME UPDATE',
        'SHOW TIME',
        'EVENT TIME',
        'แก้ไขเวลา',
        'เปลี่ยนเวลา'
      ]
    )
  ) {
    label =
      'แก้ไขเวลา';

  } else if (
    containsAny_(
      typeText,
      [
        'VENUE',
        'LOCATION',
        'CHANGE VENUE',
        'เปลี่ยนสถานที่',
        'ย้ายสถานที่',
        'แก้ไขสถานที่'
      ]
    )
  ) {
    label =
      'แก้ไขสถานที่';

  } else if (
    containsAny_(
      typeText,
      [
        'PRICE',
        'RECOMMENDED PRICE',
        'อัปเดตราคา',
        'แก้ไขราคา',
        'ราคาแนะนำ'
      ]
    )
  ) {
    label =
      'อัปเดตราคาแนะนำ';

  } else if (
    containsAny_(
      typeText,
      [
        'POSTER',
        'IMAGE UPDATED',
        'อัปเดตโปสเตอร์',
        'แก้ไขโปสเตอร์',
        'เพิ่มโปสเตอร์'
      ]
    )
  ) {
    label =
      'อัปเดตโปสเตอร์';

  } else if (
    containsAny_(
      typeText,
      [
        'TICKET',
        'SOLD OUT',
        'ON SALE',
        'สถานะบัตร',
        'บัตรหมด',
        'เปิดขายบัตร'
      ]
    )
  ) {
    label =
      'อัปเดตสถานะบัตร';

  } else if (
    containsAny_(
      typeText,
      [
        'SOURCE',
        'VERIFICATION',
        'OFFICIAL SOURCE',
        'แหล่งยืนยัน',
        'แหล่งข้อมูล'
      ]
    )
  ) {
    label =
      'อัปเดตแหล่งยืนยัน';
  }

  /*
   * มีค่าเก่าและค่าใหม่
   */
  if (
    oldValue &&
    newValue &&
    normalizeComparable_(oldValue) !==
      normalizeComparable_(newValue)
  ) {
    return (
      `${label}: ` +
      `${oldValue} → ${newValue}`
    );
  }

  /*
   * มีเฉพาะค่าใหม่
   */
  if (newValue) {
    return (
      `${label}: ${newValue}`
    );
  }

  /*
   * มีเฉพาะค่าเก่า
   */
  if (oldValue) {
    return (
      `${label}: ${oldValue}`
    );
  }

  /*
   * ใช้หมายเหตุสำรอง
   */
  if (notes) {
    return (
      `${label}: ${notes}`
    );
  }

  return label;
}


/**
 * จัดรูปแบบข้อความงาน
 */
function formatAuditLineMessage_(
  items
) {
  const header =
    '🔔 KK Phone Rental\n\n';

  const sections =
    items.map(item => {
      const lines = [
        item.notificationType,
        `🎤 ${safeText_(item.eventName)}`,
        `📅 ${safeText_(item.eventDate)}`
      ];

      if (
        !item.isNewEvent &&
        item.changeDetail
      ) {
        lines.push(
          `📝 ${safeText_(item.changeDetail)}`
        );
      }

      return lines.join('\n');
    });

  return (
    header +
    sections.join(
      '\n\n──────────────\n\n'
    )
  );
}


/**
 * แบ่งข้อความหากมีหลายงาน
 */
function createAuditMessageGroups_(
  items
) {
  const groups = [];

  let currentItems = [];

  items.forEach(item => {
    const testItems =
      currentItems.concat(item);

    const testMessage =
      formatAuditLineMessage_(
        testItems
      );

    if (
      currentItems.length > 0 &&
      testMessage.length >
        KK_LINE_CONFIG.MAX_TEXT_CHARS
    ) {
      groups.push({
        items:
          currentItems,

        endRow:
          currentItems[
            currentItems.length - 1
          ].auditRowNumber
      });

      currentItems = [item];

    } else {
      currentItems = testItems;
    }
  });

  if (currentItems.length > 0) {
    groups.push({
      items:
        currentItems,

      endRow:
        currentItems[
          currentItems.length - 1
        ].auditRowNumber
    });
  }

  return groups;
}


/* =========================================================
   ระบบตรวจสุขภาพการสแกน
   ========================================================= */


/**
 * ตรวจว่าสแกนรอบ 07:00 / 13:00 / 20:00
 * บันทึกผลหรือไม่
 */
function checkScanHealth_() {
  throw new Error(
    'LEGACY_MUTATING_SCAN_HEALTH_DISABLED_USE_GET_KK_SCAN_HEALTH_READ_ONLY'
  );

  const spreadsheet =
    SpreadsheetApp.openById(
      KK_LINE_CONFIG.SPREADSHEET_ID
    );

  const statusSheet =
    spreadsheet.getSheetByName(
      KK_LINE_CONFIG.SCAN_STATUS_SHEET
    );

  if (!statusSheet) {
    throw new Error(
      `ไม่พบชีต ${KK_LINE_CONFIG.SCAN_STATUS_SHEET}`
    );
  }

  const properties =
    PropertiesService.getScriptProperties();

  const monitorStart =
    properties.getProperty(
      KK_LINE_CONFIG.MONITOR_START_KEY
    );

  if (!monitorStart) {
    throw new Error(
      'กรุณาเรียกใช้ initializeKKLineSystem ก่อน'
    );
  }

  const now =
    new Date();

  const today =
    formatLocalDate_(now);

  const currentMinutes =
    getLocalMinutes_(now);

  const statusRows =
    readRecentScanStatusRows_(
      statusSheet
    );

  const statusByRunKey = {};

  let latestSuccessfulScan = null;

  statusRows.forEach(row => {
    const record = {
      scanDate:
        safeText_(row[0]),

      scheduledRound:
        safeText_(row[1]),

      startedAt:
        safeText_(row[2]),

      finishedAt:
        safeText_(row[3]),

      status:
        normalizeUpper_(row[4]),

      changeCount:
        safeText_(row[5]),

      notes:
        safeText_(row[6]),

      runKey:
        safeText_(row[7])
    };

    if (!record.runKey) {
      return;
    }

    /*
     * แถวหลังสุดของ Run Key เดียวกัน
     * ถือเป็นสถานะล่าสุด
     */
    statusByRunKey[
      record.runKey
    ] = record;

    if (
      record.status === 'SUCCESS'
    ) {
      latestSuccessfulScan =
        record;
    }
  });

  const scanAlerts =
    getScanAlerts_();

  KK_LINE_CONFIG
    .SCAN_ROUNDS
    .forEach(round => {
      if (
        !shouldMonitorRound_(
          today,
          round.minutes,
          monitorStart
        )
      ) {
        return;
      }

      const runKey =
        `${today}|${round.time}`;

      const record =
        statusByRunKey[runKey];

      /*
       * สแกนสำเร็จ
       */
      if (
        record &&
        record.status === 'SUCCESS'
      ) {
        if (scanAlerts[runKey]) {
          sendScanRecoveredMessage_(
            record
          );

          delete scanAlerts[runKey];
        }

        return;
      }

      /*
       * มีสถานะ Error หรือสถานะผิดปกติ
       */
      if (
        record &&
        record.status &&
        record.status !== 'RUNNING'
      ) {
        const errorAlertValue =
          `ERROR:${record.status}`;

        if (
          scanAlerts[runKey] !==
          errorAlertValue
        ) {
          sendScanErrorMessage_(
            record,
            latestSuccessfulScan
          );

          scanAlerts[runKey] =
            errorAlertValue;
        }

        return;
      }

      /*
       * ยังไม่ถึงเวลาเตือน
       */
      const alertDueMinutes =
        round.minutes +
        KK_LINE_CONFIG
          .SCAN_GRACE_MINUTES;

      if (
        currentMinutes <
        alertDueMinutes
      ) {
        return;
      }

      /*
       * เกิน 45 นาทีแล้ว
       * แต่ยังไม่มีผลสแกน
       */
      if (
        scanAlerts[runKey] !==
        'MISSING'
      ) {
        sendMissingScanMessage_(
          today,
          round.time,
          latestSuccessfulScan
        );

        scanAlerts[runKey] =
          'MISSING';
      }
    });

  pruneOldScanAlerts_(
    scanAlerts
  );

  properties.setProperty(
    KK_LINE_CONFIG.SCAN_ALERTS_KEY,
    JSON.stringify(scanAlerts)
  );
}


/**
 * อ่านสถานะสแกนล่าสุดไม่เกิน 300 แถว
 */
function readRecentScanStatusRows_(
  statusSheet
) {
  const lastRow =
    statusSheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const firstDataRow =
    Math.max(
      2,
      lastRow - 299
    );

  const rowCount =
    lastRow -
    firstDataRow +
    1;

  return statusSheet
    .getRange(
      firstDataRow,
      1,
      rowCount,
      8
    )
    .getDisplayValues();
}


/**
 * ไม่ตรวจรอบที่เกิดก่อนตั้งระบบ
 */
function shouldMonitorRound_(
  today,
  roundMinutes,
  monitorStart
) {
  const parts =
    String(monitorStart)
      .split('|');

  if (parts.length !== 2) {
    return true;
  }

  const startDate =
    parts[0];

  const startMinutes =
    timeTextToMinutes_(
      parts[1]
    );

  if (today > startDate) {
    return true;
  }

  if (today < startDate) {
    return false;
  }

  /*
   * วันเดียวกับวันที่ตั้งระบบ
   * ตรวจเฉพาะรอบที่อยู่หลังเวลาตั้งระบบ
   */
  return (
    roundMinutes >
    startMinutes
  );
}


/**
 * แจ้งเมื่อไม่พบผลสแกน
 */
function sendMissingScanMessage_(
  scanDate,
  scheduledRound,
  latestSuccessfulScan
) {
  const lines = [
    '⚠️ ระบบสแกน KK Phone Rental',
    '',
    `ไม่พบผลสแกนรอบ ${scheduledRound} น.`,
    `วันที่ ${formatThaiDateFromYmd_(scanDate)}`
  ];

  if (latestSuccessfulScan) {
    lines.push(
      '',
      'ผลสแกนสำเร็จล่าสุด:',
      formatScanRecordTime_(
        latestSuccessfulScan
      )
    );
  } else {
    lines.push(
      '',
      'ยังไม่พบประวัติการสแกนสำเร็จ'
    );
  }

  sendLineText_(
    lines.join('\n')
  );
}


/**
 * แจ้งเมื่อระบบบันทึก Error
 */
function sendScanErrorMessage_(
  record,
  latestSuccessfulScan
) {
  const lines = [
    '⚠️ ระบบสแกน KK Phone Rental ขัดข้อง',
    '',
    `รอบสแกน: ${record.scheduledRound} น.`,
    `วันที่ ${formatThaiDateFromYmd_(record.scanDate)}`,
    `สถานะ: ${record.status}`
  ];

  if (record.notes) {
    lines.push(
      `สาเหตุ: ${record.notes}`
    );
  } else {
    lines.push(
      'สาเหตุ: ระบบไม่ได้ระบุรายละเอียด'
    );
  }

  if (latestSuccessfulScan) {
    lines.push(
      '',
      'ผลสแกนสำเร็จล่าสุด:',
      formatScanRecordTime_(
        latestSuccessfulScan
      )
    );
  }

  sendLineText_(
    lines.join('\n')
  );
}


/**
 * แจ้งเมื่อระบบกลับมาทำงาน
 */
function sendScanRecoveredMessage_(
  record
) {
  const lines = [
    '✅ ระบบสแกนกลับมาทำงานแล้ว',
    '',
    `รอบสแกน: ${record.scheduledRound} น.`,
    `วันที่ ${formatThaiDateFromYmd_(record.scanDate)}`,
    `สำเร็จเวลา: ${formatScanFinishedTime_(record)}`
  ];

  sendLineText_(
    lines.join('\n')
  );
}


/**
 * อ่านรายการรอบที่เคยแจ้ง Error แล้ว
 */
function getScanAlerts_() {
  const properties =
    PropertiesService.getScriptProperties();

  const saved =
    properties.getProperty(
      KK_LINE_CONFIG.SCAN_ALERTS_KEY
    );

  if (!saved) {
    return {};
  }

  try {
    const parsed =
      JSON.parse(saved);

    if (
      parsed &&
      typeof parsed === 'object'
    ) {
      return parsed;
    }

  } catch (error) {
    console.error(
      'อ่าน SCAN_ALERTS ไม่สำเร็จ'
    );
  }

  return {};
}


/**
 * เก็บประวัติแจ้งเตือนไม่เกิน 20 รอบ
 */
function pruneOldScanAlerts_(
  scanAlerts
) {
  const keys =
    Object.keys(scanAlerts)
      .sort();

  while (keys.length > 20) {
    const key =
      keys.shift();

    delete scanAlerts[key];
  }
}


/* =========================================================
   ระบบตรวจข้อผิดพลาดของ Apps Script เอง
   ========================================================= */


/**
 * แจ้ง Error ของตัวระบบแจ้งเตือนเพียงครั้งเดียว
 */
function notifyMonitorErrorOnce_(
  error
) {
  throw new Error(
    'LEGACY_DIRECT_MONITOR_ALERT_DISABLED_USE_NOTIFICATION_LEDGER'
  );

  const properties =
    PropertiesService.getScriptProperties();

  const message =
    safeText_(
      error && error.message
        ? error.message
        : String(error)
    ).slice(0, 500);

  const previousError =
    properties.getProperty(
      KK_LINE_CONFIG.MONITOR_ERROR_KEY
    );

  if (
    previousError === message
  ) {
    return;
  }

  properties.setProperty(
    KK_LINE_CONFIG.MONITOR_ERROR_KEY,
    message
  );

  try {
    sendLineText_(
      [
        '⚠️ ระบบแจ้งเตือน KK Phone Rental ขัดข้อง',
        '',
        `สาเหตุ: ${message}`,
        '',
        'ระบบจะลองตรวจสอบใหม่อัตโนมัติ'
      ].join('\n')
    );

  } catch (lineError) {
    console.error(
      'ไม่สามารถส่งข้อความ Error เข้า LINE ได้'
    );

    console.error(
      lineError
    );
  }
}


/**
 * แจ้งเมื่อ Apps Script กลับมาทำงาน
 */
function clearMonitorErrorIfRecovered_() {
  throw new Error(
    'LEGACY_DIRECT_MONITOR_RECOVERY_DISABLED_USE_NOTIFICATION_LEDGER'
  );

  const properties =
    PropertiesService.getScriptProperties();

  const previousError =
    properties.getProperty(
      KK_LINE_CONFIG.MONITOR_ERROR_KEY
    );

  if (!previousError) {
    return;
  }

  sendLineText_(
    [
      '✅ ระบบแจ้งเตือน KK Phone Rental',
      '',
      'ระบบกลับมาทำงานตามปกติแล้ว'
    ].join('\n')
  );

  properties.deleteProperty(
    KK_LINE_CONFIG.MONITOR_ERROR_KEY
  );
}


/* =========================================================
   การส่ง LINE
   ========================================================= */


/**
 * ส่งข้อความผ่าน LINE Messaging API
 */
function sendLineText_(
  text
) {
  throw new Error(
    'LEGACY_DIRECT_LINE_SEND_DISABLED_USE_NOTIFICATION_LEDGER'
  );
}



/* =========================================================
   ฟังก์ชันช่วยจัดข้อความและเวลา
   ========================================================= */


function containsAny_(
  text,
  keywords
) {
  return keywords.some(
    keyword =>
      text.includes(
        normalizeUpper_(keyword)
      )
  );
}


function safeText_(
  value
) {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function normalizeUpper_(
  value
) {
  return safeText_(value)
    .toUpperCase();
}


function normalizeComparable_(
  value
) {
  return safeText_(value)
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '')
    .trim();
}


function formatLocalDate_(
  date
) {
  return Utilities.formatDate(
    date,
    KK_LINE_CONFIG.TIME_ZONE,
    'yyyy-MM-dd'
  );
}


function formatLocalTime_(
  date
) {
  return Utilities.formatDate(
    date,
    KK_LINE_CONFIG.TIME_ZONE,
    'HH:mm'
  );
}


function getLocalMinutes_(
  date
) {
  const hours =
    Number(
      Utilities.formatDate(
        date,
        KK_LINE_CONFIG.TIME_ZONE,
        'HH'
      )
    );

  const minutes =
    Number(
      Utilities.formatDate(
        date,
        KK_LINE_CONFIG.TIME_ZONE,
        'mm'
      )
    );

  return (
    hours * 60 +
    minutes
  );
}


function timeTextToMinutes_(
  timeText
) {
  const parts =
    String(timeText || '')
      .split(':');

  if (parts.length !== 2) {
    return 0;
  }

  return (
    Number(parts[0]) * 60 +
    Number(parts[1])
  );
}


function formatThaiDate_(
  date
) {
  return formatThaiDateFromYmd_(
    formatLocalDate_(date)
  );
}


function formatThaiDateFromYmd_(
  ymd
) {
  const parts =
    String(ymd || '')
      .split('-');

  if (parts.length !== 3) {
    return safeText_(ymd);
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  const thaiMonths = [
    '',
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.'
  ];

  if (
    !year ||
    !month ||
    !day ||
    !thaiMonths[month]
  ) {
    return safeText_(ymd);
  }

  return (
    `${day} ` +
    `${thaiMonths[month]} ` +
    `${year + 543}`
  );
}


function formatScanFinishedTime_(
  record
) {
  if (record.finishedAt) {
    const parsedDate =
      new Date(record.finishedAt);

    if (
      !isNaN(
        parsedDate.getTime()
      )
    ) {
      return (
        `${formatLocalTime_(parsedDate)} น.`
      );
    }

    return record.finishedAt;
  }

  return (
    `${record.scheduledRound} น.`
  );
}


function formatScanRecordTime_(
  record
) {
  const dateText =
    formatThaiDateFromYmd_(
      record.scanDate
    );

  const timeText =
    formatScanFinishedTime_(
      record
    );

  return (
    `${dateText} เวลา ${timeText}`
  );
}

/**
 * UAT ครั้งเดียว: ส่งแจ้งเตือนงานเดียวกับ Telegram ไป LINE
 * ใช้ข้อความจาก Telegram ledger row 32 แบบตรงกันและบันทึกใบรับส่งใน LINE row 31
 */
function sendNotificationLedgerLineUat() {
  throw new Error(
    'LEGACY_DIRECT_LINE_UAT_DISABLED_USE_CORE_V1_CONTROLLED_UAT'
  );

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('มีการส่ง UAT อื่นกำลังทำงาน');
  }

  const lineRowNumber = 31;
  const telegramRowNumber = 32;
  const ledgerSheetName = '_Notification_Ledger';

  try {
    const sheet = SpreadsheetApp
      .openById(KK_LINE_CONFIG.SPREADSHEET_ID)
      .getSheetByName(ledgerSheetName);

    if (!sheet) {
      throw new Error('ไม่พบชีต ' + ledgerSheetName);
    }

    const lineRow = sheet.getRange(lineRowNumber, 1, 1, 23).getValues()[0];
    const telegramRow = sheet.getRange(telegramRowNumber, 1, 1, 23).getValues()[0];

    const lineNotificationId = String(lineRow[0] || '');
    const lineTransport = String(lineRow[9] || '');
    const lineStatus = String(lineRow[10] || '');
    const telegramStatus = String(telegramRow[10] || '');

    if (lineNotificationId !== 'NOTIF|NONTENCORE|SOLDOUT|20260831T1232|LINE') {
      throw new Error('LINE UAT row ไม่ตรงกับ allowlist');
    }
    if (lineTransport !== 'LINE_OWNER_ALERTS') {
      throw new Error('LINE UAT transport ไม่ถูกต้อง');
    }
    if (lineStatus === 'SENT' || lineStatus === 'PENDING_CONFIRMATION') {
      throw new Error('รายการนี้ส่งหรืออยู่ระหว่างยืนยันแล้ว จึงไม่ส่งซ้ำ');
    }
    if (telegramStatus !== 'SENT') {
      throw new Error('Telegram คู่เทียบยังไม่มีหลักฐาน SENT');
    }

    [2, 3, 4, 5].forEach(function(index) {
      if (String(lineRow[index] || '') !== String(telegramRow[index] || '')) {
        throw new Error('คู่ LINE/Telegram ไม่ใช่งานเดียวกัน');
      }
    });

    const exactPayload = String(telegramRow[7] || '').trim();
    if (!exactPayload) {
      throw new Error('ไม่มีข้อความแจ้งเตือนที่ใช้ร่วมกัน');
    }

    const claimedAt = Utilities.formatDate(
      new Date(),
      KK_LINE_CONFIG.TIME_ZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );

    sheet.getRange(lineRowNumber, 8).setValue(exactPayload);
    sheet.getRange(lineRowNumber, 11).setValue('PENDING_CONFIRMATION');
    sheet.getRange(lineRowNumber, 13).setValue(claimedAt);
    sheet.getRange(lineRowNumber, 17).setValue(
      String(lineRow[16] || '') +
      '\n[LINE_SAME_ALERT_UAT_CLAIMED] ' + claimedAt
    );
    SpreadsheetApp.flush();

    const result = sendLineText_(exactPayload);
    const acceptedAt = Utilities.formatDate(
      new Date(),
      KK_LINE_CONFIG.TIME_ZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );

    let providerMessageId = '';
    try {
      const parsed = JSON.parse(result.responseText || '{}');
      providerMessageId =
        parsed &&
        parsed.sentMessages &&
        parsed.sentMessages[0] &&
        parsed.sentMessages[0].id
          ? String(parsed.sentMessages[0].id)
          : '';
    } catch (ignored) {}

    sheet.getRange(lineRowNumber, 11).setValue('SENT');
    sheet.getRange(lineRowNumber, 12).setValue(Number(lineRow[11] || 0) + 1);
    sheet.getRange(lineRowNumber, 13).setValue(acceptedAt);
    sheet.getRange(lineRowNumber, 14).setValue(
      'LINE_API_ACCEPTED|message_id=' + (providerMessageId || 'UNAVAILABLE')
    );
    sheet.getRange(lineRowNumber, 15).clearContent();
    sheet.getRange(lineRowNumber, 17).setValue(
      String(lineRow[16] || '') +
      '\n[LINE_SAME_ALERT_UAT_SENT] ' + acceptedAt
    );
    sheet.getRange(lineRowNumber, 18).setValue(result.statusCode);
    sheet.getRange(lineRowNumber, 19).setValue(providerMessageId);
    sheet.getRange(lineRowNumber, 20).setValue(acceptedAt);
    sheet.getRange(lineRowNumber, 21).setValue(acceptedAt);
    sheet.getRange(lineRowNumber, 22).clearContent();
    sheet.getRange(lineRowNumber, 23).setValue('APPS_SCRIPT_CONTROLLED_UAT');
    SpreadsheetApp.flush();

    console.log(
      'LINE_SAME_ALERT_UAT_SENT notification_id=' +
      lineNotificationId +
      ' http_status=' +
      result.statusCode +
      ' provider_message_id=' +
      providerMessageId
    );

    return {
      notificationId: lineNotificationId,
      status: 'SENT',
      httpStatus: result.statusCode,
      providerMessageId: providerMessageId
    };
  } catch (error) {
    console.error('LINE_SAME_ALERT_UAT_FAILED ' + error.message);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * KK Phone Rental — Core v1 owner notification transport.
 *
 * Installs in the Apps Script project attached to the Event Tracker workbook.
 * Scanner/verifier remains the source of truth. This adapter only sends rows
 * already written to _Notification_Ledger and never invents event facts.
 */

var CORE_V1 = Object.freeze({
  spreadsheetId: '1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo',
  ledgerSheet: '_Notification_Ledger',
  // The existing project already owns a timed runKKLineMonitor trigger.  The
  // bridge calls runCoreV1Notifier after a read-only scan-health snapshot, so
  // cutover can reuse one trigger instead of creating a competing scheduler.
  triggerHandler: 'runKKLineMonitor',
  triggerHandlers: ['runKKLineMonitor', 'runCoreV1Notifier'],
  triggerMinutes: 5,
  maxAttempts: 4,
  maxMessageChars: 3500,
  eligibleStatuses: ['QUEUED', 'RETRY_WAIT'],
  quietHoursOverrideChanges: ['CANCELLATION', 'POSTPONEMENT', 'DATE_CHANGE', 'VENUE_CHANGE']
});

/**
 * Safe first-time install. It creates one trigger and keeps transport OFF.
 * Credentials must be saved in Script Properties; never place them in cells.
 */
function setupCoreV1Notifier() {
  var properties = PropertiesService.getScriptProperties();
  var current = properties.getProperties();
  var defaults = {};

  // Setup is allowed to reconcile triggers only while every transport fuse is
  // visibly OFF.  This prevents a stale TRUE property from making deployment
  // itself an outbound side effect.
  if (String(current.CORE_V1_TRANSPORT_ENABLED || '').toUpperCase() === 'TRUE') {
    throw new Error('SETUP_REQUIRES_CORE_V1_TRANSPORT_DISABLED');
  }
  if (String(current.CORE_V1_UAT_ARMED || '').toUpperCase() === 'TRUE') {
    throw new Error('SETUP_REQUIRES_CORE_V1_UAT_DISARMED');
  }

  if (!current.CORE_V1_SPREADSHEET_ID) {
    defaults.CORE_V1_SPREADSHEET_ID = CORE_V1.spreadsheetId;
  }
  if (!current.CORE_V1_TRANSPORT_ENABLED) {
    defaults.CORE_V1_TRANSPORT_ENABLED = 'FALSE';
  }
  if (!current.CORE_V1_SEND_NOT_BEFORE) {
    defaults.CORE_V1_SEND_NOT_BEFORE = new Date().toISOString();
  }
  if (!current.CORE_V1_MAX_ATTEMPTS) {
    defaults.CORE_V1_MAX_ATTEMPTS = String(CORE_V1.maxAttempts);
  }
  if (!current.CORE_V1_UAT_ARMED) {
    defaults.CORE_V1_UAT_ARMED = 'FALSE';
  }
  if (Object.keys(defaults).length) {
    properties.setProperties(defaults, false);
  }

  var triggers = ScriptApp.getProjectTriggers();
  var matches = triggers.filter(function (trigger) {
    return CORE_V1.triggerHandlers.indexOf(trigger.getHandlerFunction()) >= 0;
  });
  var preferred = matches.filter(function (trigger) {
    return trigger.getHandlerFunction() === CORE_V1.triggerHandler;
  })[0] || matches[0];
  matches.forEach(function (trigger) {
    if (trigger !== preferred) ScriptApp.deleteTrigger(trigger);
  });
  if (!preferred) {
    ScriptApp.newTrigger(CORE_V1.triggerHandler)
      .timeBased()
      .everyMinutes(CORE_V1.triggerMinutes)
      .create();
  }

  return getCoreV1NotifierHealth();
}

/** Read-only health output. Secret values are never returned. */
function getCoreV1NotifierHealth() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  var ownerLineId = properties.LINE_OWNER_USER_ID || properties.LINE_USER_ID;
  var notifierTriggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return CORE_V1.triggerHandlers.indexOf(trigger.getHandlerFunction()) >= 0;
  });
  return {
      transport_enabled: String(properties.CORE_V1_TRANSPORT_ENABLED || '').toUpperCase() === 'TRUE',
      send_not_before: properties.CORE_V1_SEND_NOT_BEFORE || '',
      telegram_configured: Boolean(properties.TELEGRAM_BOT_TOKEN && properties.TELEGRAM_CHAT_ID),
      line_configured: Boolean(properties.LINE_CHANNEL_ACCESS_TOKEN && ownerLineId),
      uat_armed: String(properties.CORE_V1_UAT_ARMED || '').toUpperCase() === 'TRUE',
      uat_target_count: Object.keys(parseCsvSet_(properties.CORE_V1_UAT_NOTIFICATION_IDS)).length,
    trigger_count: notifierTriggers.length,
    trigger_handlers: notifierTriggers.map(function (trigger) {
      return trigger.getHandlerFunction();
    }),
    ledger_sheet: CORE_V1.ledgerSheet
  };
}

/** Read-only recovery queue. Never clears a claim or retries an uncertain send. */
function getCoreV1RecoveryPlan() {
  var context = openLedger_();
  var pending = [];
  for (var i = 1; i < context.values.length; i += 1) {
    var row = context.values[i];
    var status = normalizeText_(row[context.headers.Status]).toUpperCase();
    if (['SENDING', 'PROCESSING', 'RECOVERY_REQUIRED'].indexOf(status) < 0) continue;
    pending.push({
      row: i + 1,
      notification_id: normalizeText_(row[context.headers['Notification ID']]),
      status: status,
      provider_message_id: normalizeText_(row[context.headers['Provider Message ID']]),
      api_accepted_at: row[context.headers['API Accepted At']] || '',
      next_action: 'RECONCILE_PROVIDER_RECEIPT_AND_DEDUP_KEY_DO_NOT_RESEND'
    });
  }
  return pending;
}

/**
 * Read-only preview for UAT. Returns final Thai messages without transmitting.
 */
function previewCoreV1Alerts() {
  var context = openLedger_();
  var properties = PropertiesService.getScriptProperties().getProperties();
  var candidates = collectCandidates_(context.values, context.headers, properties, false);
  return takeLatest_(candidates, 10).map(function (candidate) {
    return {
      row: candidate.rowNumber,
      notification_id: candidate.notificationId,
      transport: candidate.transport,
      message: formatHumanAlert_(candidate.payload)
    };
  });
}

function takeLatest_(items, limit) {
  var start = Math.max(0, items.length - Number(limit || 0));
  return items.slice(start).reverse();
}

/**
 * Read-only plan for the controlled provider UAT. Target IDs are stored in
 * Script Properties and never in source code or ordinary spreadsheet cells.
 */
function getCoreV1ControlledUatPlan() {
  var context = openLedger_();
  var properties = PropertiesService.getScriptProperties().getProperties();
  var targetIds = parseCsvSet_(properties.CORE_V1_UAT_NOTIFICATION_IDS);
  var candidates = collectCandidates_(context.values, context.headers, properties, false, {
    controlledUatIds: targetIds
  })
    .filter(function (candidate) { return Boolean(targetIds[candidate.notificationId]); });
  return candidates.map(function (candidate) {
    return {
      row: candidate.rowNumber,
      notification_id: candidate.notificationId,
      transport: candidate.transport,
      message: formatHumanAlert_(candidate.payload),
      already_sent: candidate.alreadySent
    };
  });
}

function logCoreV1ControlledUatPlan() {
  console.log(JSON.stringify(getCoreV1ControlledUatPlan()));
}

/**
 * Selects normal queued rows, or explicitly supplied IDs, while keeping UAT
 * disarmed. A quarantined historical row is never selected implicitly.
 */
function prepareCoreV1ControlledUat(notificationIds) {
  var explicitIds = parseCsvSet_(notificationIds);
  var explicitCount = Object.keys(explicitIds).length;
  if (explicitCount < 1 || explicitCount > 2) throw new Error('UAT_EXPLICIT_TARGET_COUNT_INVALID');
  var context = openLedger_();
  var properties = PropertiesService.getScriptProperties().getProperties();
  var selected = collectCandidates_(context.values, context.headers, properties, false, {
    controlledUatIds: explicitIds, enforceQuietHours: true
  }).filter(function (candidate) { return Boolean(explicitIds[candidate.notificationId]) && candidate.controlledUat; });
  if (selected.length !== explicitCount) throw new Error('UAT_TARGET_NOT_ELIGIBLE');
  var seen = {};
  selected.forEach(function(candidate) {
    if (seen[candidate.transport]) throw new Error('UAT_DUPLICATE_TRANSPORT');
    seen[candidate.transport] = true;
  });
  var propertyStore = PropertiesService.getScriptProperties();
  propertyStore.setProperties({CORE_V1_UAT_NOTIFICATION_IDS: Object.keys(explicitIds).join(','), CORE_V1_UAT_ARMED:'FALSE'},false);
  propertyStore.deleteProperty('CORE_V1_UAT_CONFIRMATION');
  return getCoreV1ControlledUatPlan();
}

function selectLatestPerTransport_(candidates, transports) {
  var selected = [];
  var seen = {};
  var allowed = {};
  transports.forEach(function (transport) { allowed[transport] = true; });
  takeLatest_(candidates, candidates.length).forEach(function (candidate) {
    if (allowed[candidate.transport] && !seen[candidate.transport]) {
      selected.push(candidate);
      seen[candidate.transport] = true;
    }
  });
  return selected;
}

/**
 * Sends only explicitly allowlisted notification IDs while the global
 * transport gate stays OFF. The one-shot arm is cleared before side effects.
 */
function runCoreV1ControlledUat() {
  var scriptLock = LockService.getScriptLock();
  if (!scriptLock.tryLock(5000)) return { status: 'UAT_LOCK_BUSY', processed: 0 };
  try {
    var propertyStore = PropertiesService.getScriptProperties();
    var properties = propertyStore.getProperties();
    if (String(properties.CORE_V1_TRANSPORT_ENABLED || '').toUpperCase() === 'TRUE') {
      throw new Error('UAT_REQUIRES_GLOBAL_TRANSPORT_DISABLED');
    }
    if (String(properties.CORE_V1_UAT_ARMED || '').toUpperCase() !== 'TRUE') {
      return { status: 'UAT_NOT_ARMED', processed: 0 };
    }
    if (properties.CORE_V1_UAT_CONFIRMATION !== 'SEND_ALLOWLISTED_OWNER_ALERTS') {
      throw new Error('UAT_CONFIRMATION_MISSING');
    }

    var context = openLedger_();
    var targetIds = parseCsvSet_(properties.CORE_V1_UAT_NOTIFICATION_IDS);
    var targetCount = Object.keys(targetIds).length;
    if (targetCount < 1 || targetCount > 2) throw new Error('UAT_TARGET_COUNT_INVALID');

    var candidates = collectCandidates_(context.values, context.headers, properties, false, {
      controlledUatIds: targetIds,
      enforceQuietHours: true
    })
      .filter(function (candidate) { return Boolean(targetIds[candidate.notificationId]); });
    if (candidates.length !== targetCount) throw new Error('UAT_TARGET_NOT_ELIGIBLE');

    var seenTransports = Object.create(null);
    candidates.forEach(function (candidate) {
      if (['TELEGRAM_OWNER_ALERTS', 'LINE_OWNER_ALERTS'].indexOf(candidate.transport) < 0) {
        throw new Error('UAT_TRANSPORT_NOT_ALLOWED');
      }
      if (seenTransports[candidate.transport]) throw new Error('UAT_DUPLICATE_TRANSPORT');
      seenTransports[candidate.transport] = true;
      if (!candidate.controlledUat) throw new Error('UAT_EXACT_TEST_CLASSIFICATION_REQUIRED');
      messageForLedgerCandidate_(candidate);
    });

    // One-shot fuse: any retry requires an explicit re-arm after inspection.
    propertyStore.setProperty('CORE_V1_UAT_ARMED', 'FALSE');
    var results = candidates.map(function (candidate) {
      return processCandidate_(context.sheet, context.headers, candidate, properties);
    });
    return { status: 'UAT_EXECUTED', processed: results.length, results: results };
  } finally {
    scriptLock.releaseLock();
  }
}

function parseCsvSet_(value) {
  var result = Object.create(null);
  String(value || '').split(',').forEach(function (item) {
    // IDs are exact bytes. Whitespace is not silently removed from an identity.
    if (item) result[item] = true;
  });
  return result;
}

/** Editor helpers: log safe read-only output for installation/UAT evidence. */
function logCoreV1NotifierHealth() {
  console.log(JSON.stringify(getCoreV1NotifierHealth()));
}

function logCoreV1AlertPreview() {
  console.log(JSON.stringify(previewCoreV1Alerts()));
}

/** Main timed entry point. */
function runCoreV1Notifier() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  if (String(properties.CORE_V1_TRANSPORT_ENABLED || '').toUpperCase() !== 'TRUE') {
    return { status: 'TRANSPORT_DISABLED', processed: 0 };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return { status: 'RUNNER_BUSY', processed: 0 };
  }

  try {
    var context = openLedger_();
    var candidates = collectCandidates_(context.values, context.headers, properties, true);
    var processed = [];
    for (var i = 0; i < candidates.length; i += 1) {
      // Canonical Telegram has one writer: Make 6176241. Fence before Core claim.
      if (properties.KK_OWNER_CANONICAL_ENABLED==='TRUE' && candidates[i].transport==='TELEGRAM_OWNER_ALERTS') continue;
      processed.push(processCandidate_(context.sheet, context.headers, candidates[i], properties));
    }
    return { status: 'OK', processed: processed.length, results: processed };
  } finally {
    lock.releaseLock();
  }
}

function openLedger_() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  var spreadsheetId = properties.CORE_V1_SPREADSHEET_ID || CORE_V1.spreadsheetId;
  if (spreadsheetId !== CORE_V1.spreadsheetId) throw new Error('LEDGER_SCOPE_INVALID');
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(CORE_V1.ledgerSheet);
  if (!sheet) throw new Error('LEDGER_SHEET_NOT_FOUND');
  assertLedgerScope_(sheet);
  var values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('LEDGER_HEADER_NOT_FOUND');
  var headers = readHeaders_(values[0]);
  return { sheet: sheet, values: values, headers: headers };
}

function collectCandidates_(values, headers, properties, enforceEnabled, options) {
  options = options || {};
  var now = new Date();
  var notBefore = parseDate_(properties.CORE_V1_SEND_NOT_BEFORE);
  var candidates = [], sentDedup = Object.create(null), uncertainDedup = Object.create(null), batchDedup = Object.create(null);
  var controlledIds = options.controlledUatIds || Object.create(null);
  var controlledSelection = Object.keys(controlledIds).length > 0;
  for (var n = 1; n < values.length; n += 1) {
    var existing = values[n];
    var existingTransport = ledgerText_(existing[headers.Transport]);
    var existingDedup = ledgerText_(existing[headers['Dedup Key']]);
    var existingStatus = ledgerText_(existing[headers.Status]);
    var key = JSON.stringify([existingTransport,existingDedup]);
    if (existingDedup && ['SENT','API_ACCEPTED','DELIVERED'].indexOf(existingStatus)>=0) sentDedup[key]=true;
    if (existingDedup && ['SENDING','PROCESSING','RECOVERY_REQUIRED'].indexOf(existingStatus)>=0) uncertainDedup[key]=true;
    if (existingDedup && (hasLedgerValue_(existing[headers['Provider Message ID']]) || hasLedgerValue_(existing[headers['API Accepted At']])) &&
      ['SENT','API_ACCEPTED','DELIVERED'].indexOf(existingStatus)<0) uncertainDedup[key]=true;
  }
  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    var status = ledgerText_(row[headers.Status]);
    var id = ledgerText_(row[headers['Notification ID']]);
    var transport = ledgerText_(row[headers.Transport]);
    var dedup = ledgerText_(row[headers['Dedup Key']]);
    if (!controlledSelection && (row[headers['Change Type']]==='TRANSPORT_UAT' || row[headers['Quiet Hours Policy']]==='OWNER_CONTROLLED_UAT' || row[headers.Priority]==='TEST')) continue;
    if (controlledSelection && (!Object.prototype.hasOwnProperty.call(controlledIds,id) || controlledIds[id]!==true)) continue;
    if (!isEligibleStatus_(status)) continue; // No historical HOLD exception.
    var controlledUat = controlledSelection && isFreshControlledTransportUat_(row,headers,controlledIds,now);
    if (controlledSelection && !controlledUat) continue;
    if (enforceEnabled && String(properties.CORE_V1_TRANSPORT_ENABLED || '').toUpperCase()!=='TRUE') continue;
    var createdAt=parseDate_(row[headers['Created At']]);
    var nextRetryAt=parseDate_(row[headers['Next Retry At']]);
    if (enforceEnabled && notBefore && (!createdAt || createdAt<notBefore)) continue;
    if (status==='RETRY_WAIT' && !nextRetryAt) continue;
    if (nextRetryAt && nextRetryAt>now) continue;
    var quietCheck=enforceEnabled || options.enforceQuietHours;
    if (quietCheck && isQuietHours_(now) && !controlledUat && !canBypassQuietHours_(ledgerText_(row[headers.Priority]),ledgerText_(row[headers['Change Type']]))) continue;
    var scopedDedup=JSON.stringify([transport,dedup]);
    candidates.push({
      rowNumber:i+1,notificationId:id,payload:ledgerText_(row[headers.Payload]),transport:transport,status:status,
      attemptCount:Number(row[headers['Attempt Count']] || 0),dedupKey:dedup,notes:ledgerText_(row[headers.Notes]),
      sourceSnapshot:ledgerImmutableSnapshot_(row,headers),sourceRow:ledgerNamedRow_(row,headers),
      controlledUat:Boolean(controlledUat),enforceQuietHours:Boolean(quietCheck),
      alreadySent:Boolean(dedup && sentDedup[scopedDedup]),requiresReconciliation:Boolean(dedup && uncertainDedup[scopedDedup]),
      duplicateInBatch:Boolean(dedup && batchDedup[scopedDedup])
    });
    if (dedup) batchDedup[scopedDedup]=true;
  }
  return candidates;
}

function processCandidate_(sheet, headers, candidate, properties) {
  assertLedgerLock_();
  if (candidate.duplicateInBatch) return {notification_id:candidate.notificationId,status:'BATCH_DUPLICATE_SKIPPED'};
  if (candidate.alreadySent) return {notification_id:candidate.notificationId,status:'DEDUP_KEY_ALREADY_ACCEPTED'};
  if (candidate.requiresReconciliation) return {notification_id:candidate.notificationId,status:'DEDUP_KEY_REQUIRES_RECONCILIATION'};
  var message, claim;
  try {
    // Lookup and compare first, before even writing a validation failure.
    readExactLedgerCandidate_(sheet,candidate,null);
    if (!candidate.notificationId || !candidate.dedupKey) throw new Error('NOTIFICATION_ID_AND_DEDUP_KEY_REQUIRED');
    if (!isFinite(candidate.attemptCount) || candidate.attemptCount<0 || Math.floor(candidate.attemptCount)!==candidate.attemptCount ||
      candidate.attemptCount>=maximumAttempts_(properties)) throw new Error('ATTEMPT_COUNT_INVALID_OR_EXHAUSTED');
    message=messageForLedgerCandidate_(candidate);
    validateTransport_(candidate.transport,properties);
    claim=claimLedgerCandidate_(sheet,headers,candidate,properties);
  } catch (preflightError) {
    return {notification_id:candidate.notificationId,status:'RECOVERY_REQUIRED',reason:sanitizeError_(preflightError),transport:candidate.transport};
  }
  var result;
  try {
    if (candidate.transport==='TELEGRAM_OWNER_ALERTS') {
      result=KKOwnerTelegramBridge.send(candidate,claim,properties);
      // A prepared asynchronous Make operation is not provider acceptance.
      if (result && result.deferred===true) return {notification_id:candidate.notificationId,status:'SENDING',pending:true,transport:candidate.transport};
    } else if (candidate.transport==='LINE_OWNER_ALERTS') {
      result=sendLine_(message,properties);
    } else throw new Error('TRANSPORT_NOT_SUPPORTED');
  } catch (error) {
    var retrySafe=error.coreV1Disposition==='retry' && claim.attempt_count<maximumAttempts_(properties) && !candidate.controlledUat;
    var failedKnown=error.coreV1Disposition==='failed' || (error.coreV1Disposition==='retry' && !retrySafe);
    var fields={
      'Next Retry At':retrySafe?new Date(Date.now()+retryMinutes_(claim.attempt_count)*60000):'',
      'HTTP Status':error.coreV1HttpStatus || '', 'Last Error':error.coreV1Disposition?sanitizeError_(error):'TRANSPORT_OUTCOME_UNKNOWN',
      'Notes':appendLedgerNote_(claim.claimed_row.Notes,retrySafe?'REJECTED_RETRY_SAFE':failedKnown?'REJECTED_TERMINAL':'RECONCILE_BEFORE_ANY_RESEND'),
      'Status':retrySafe?'RETRY_WAIT':failedKnown?'FAILED':'RECOVERY_REQUIRED'
    };
    try { projectLedgerFields_(sheet,candidate,claim,fields); } catch (unavailable) {
      // An unconfirmed failure/retry projection is still an uncertain durable state.
      return {notification_id:candidate.notificationId,status:'RECOVERY_REQUIRED',reason:'REJECTION_PERSISTENCE_FAILED',transport:candidate.transport};
    }
    return {notification_id:candidate.notificationId,status:fields.Status,transport:candidate.transport};
  }
  try {
    return projectLedgerAcknowledgement_(sheet,headers,candidate,claim,result);
  } catch (persistenceError) {
    // Preserve actual receipt in the returned recovery artifact. Never send again.
    try { projectLedgerFields_(sheet,candidate,claim,{'Next Retry At':'','Last Error':'ACCEPTED_RECEIPT_PERSISTENCE_FAILED',
      'Notes':appendLedgerNote_(claim.claimed_row.Notes,'RECONCILE_ACCEPTED_RECEIPT_BEFORE_ANY_RESEND'),'Status':'RECOVERY_REQUIRED'}); } catch (unavailable) {}
    return {notification_id:candidate.notificationId,status:'RECOVERY_REQUIRED',reason:'ACCEPTED_RECEIPT_PERSISTENCE_FAILED',
      transport:candidate.transport,provider_message_id:result && result.providerMessageId || '',evidence:result && result.evidence};
  }
}


/** Fixed private Tracker schema; no general spreadsheet writer is exposed. */
function ledgerHeaders_() {
  return ['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID',
    'Transport','Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status','Provider Message ID',
    'API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'];
}
function ledgerText_(value) {
  if (value===null || value===undefined || value==='') return '';
  if (typeof value!=='string') throw new Error('LEDGER_TEXT_CELL_TYPE_INVALID');
  return value;
}
function hasLedgerValue_(value) { return value!=='' && value!==null && value!==undefined; }
function ledgerComparable_(value) {
  if (Object.prototype.toString.call(value)==='[object Date]') {
    if (!isFinite(value.getTime())) throw new Error('LEDGER_DATE_INVALID');
    return value.toISOString();
  }
  return value;
}
function ledgerNamedRow_(row,headers) {
  var result={}; ledgerHeaders_().forEach(function(name) { result[name]=row[headers[name]]; }); return result;
}
function ledgerRecordSnapshot_(record) {
  return ledgerHeaders_().map(function(name) { return ledgerComparable_(record[name]); });
}
function ledgerPatchedRecord_(record,fields) {
  var result={}; ledgerHeaders_().forEach(function(name) { result[name]=Object.prototype.hasOwnProperty.call(fields,name)?fields[name]:record[name]; }); return result;
}
function ledgerImmutableSnapshot_(row,headers) {
  return ['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Dedup Key']
    .map(function(name) { return ledgerComparable_(row[headers[name]]); });
}
function assertLedgerScope_(sheet) {
  if (!sheet || sheet.getName()!==CORE_V1.ledgerSheet || !sheet.getParent() || sheet.getParent().getId()!==CORE_V1.spreadsheetId) throw new Error('LEDGER_SCOPE_INVALID');
}
function assertLedgerLock_() {
  if (!LockService.getScriptLock().hasLock()) throw new Error('LEDGER_SCRIPT_LOCK_REQUIRED');
}
function appendLedgerNote_(existing,addition) { return existing?String(existing)+' | '+addition:addition; }
function isFreshControlledTransportUat_(row,headers,ids,now) {
  var id=ledgerText_(row[headers['Notification ID']]), created=parseDate_(row[headers['Created At']]);
  if (!Object.prototype.hasOwnProperty.call(ids,id) || ids[id]!==true || !created || now-created<0 || now-created>120000 || row[headers.Status]!=='QUEUED' ||
    (row[headers['Attempt Count']]!==0 && row[headers['Attempt Count']]!=='0')) return false;
  if (row[headers['Change Type']]!=='TRANSPORT_UAT' || row[headers['Quiet Hours Policy']]!=='OWNER_CONTROLLED_UAT' || row[headers.Priority]!=='TEST' ||
    row[headers['Event Family ID']]!=='' || row[headers['Show ID']]!=='' || row[headers['Audit Event ID']]!=='CONTROLLED_UAT|'+id ||
    row[headers.Notes]!=='OWNER_AUTHORIZED_TRANSPORT_UAT|'+id || typeof row[headers.Payload]!=='string' ||
    row[headers.Payload].indexOf('ทดสอบระบบแจ้งเตือน')!==0) return false;
  return ['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source']
    .every(function(name) { return !hasLedgerValue_(row[headers[name]]); });
}
function messageForLedgerCandidate_(candidate) {
  if (candidate.controlledUat) {
    if (!candidate.payload || candidate.payload.length>1500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(candidate.payload) || looksLikeRawJson_(candidate.payload)) throw new Error('UAT_TEST_MESSAGE_INVALID');
    return '🧪 ทดสอบระบบแจ้งเตือน KK Phone Rental\n\n'+candidate.payload;
  }
  var message=formatHumanAlert_(candidate.payload); validateHumanAlert_(message); return message;
}
/** Re-locate the exact source tuple on every phase; row numbers are hints only. */
function readExactLedgerCandidate_(sheet,candidate,claim) {
  assertLedgerScope_(sheet);
  var values=sheet.getDataRange().getValues();
  var headers=readHeaders_(values[0]), matches=[];
  for (var i=1;i<values.length;i+=1) {
    if (values[i][headers['Notification ID']]===candidate.notificationId && values[i][headers.Transport]===candidate.transport) matches.push(i);
  }
  if (matches.length!==1) throw new Error('LEDGER_EXACT_IDENTITY_AMBIGUOUS_OR_MISSING');
  var row=values[matches[0]];
  if (!candidate.sourceSnapshot || JSON.stringify(ledgerImmutableSnapshot_(row,headers))!==JSON.stringify(candidate.sourceSnapshot)) throw new Error('LEDGER_IMMUTABLE_SOURCE_CHANGED');
  for (var n=1;n<values.length;n+=1) {
    if (n!==matches[0] && values[n][headers.Transport]===candidate.transport && values[n][headers['Dedup Key']]===candidate.dedupKey) throw new Error('LEDGER_SCOPED_DEDUP_CONFLICT');
  }
  if (claim) {
    if (row[headers.Status]!=='SENDING' || Number(row[headers['Attempt Count']])!==claim.attempt_count ||
      ledgerComparable_(row[headers['Last Attempt At']])!==claim.attempted_at || row[headers.Notes]!==claim.claimed_row.Notes) throw new Error('LEDGER_CLAIM_FENCE_CHANGED');
    if (JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(row,headers)))!==JSON.stringify(ledgerRecordSnapshot_(claim.claimed_row))) throw new Error('LEDGER_CLAIM_STATE_CHANGED');
  } else {
    if (row[headers.Status]!==candidate.status || Number(row[headers['Attempt Count']] || 0)!==candidate.attemptCount || row[headers.Notes]!==candidate.notes) throw new Error('LEDGER_SOURCE_STATE_CHANGED');
    if (!candidate.sourceRow || JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(row,headers)))!==JSON.stringify(ledgerRecordSnapshot_(candidate.sourceRow))) throw new Error('LEDGER_SOURCE_STATE_CHANGED');
    if (['Delivery Evidence','Provider Message ID','API Accepted At','Delivery Confirmed At'].some(function(name) { return hasLedgerValue_(row[headers[name]]); })) throw new Error('LEDGER_EXISTING_PROVIDER_EVIDENCE');
  }
  return {rowNumber:matches[0]+1,row:row,headers:headers,record:ledgerNamedRow_(row,headers),sourceRows:values.slice(1)};
}
function verifyLedgerPatch_(sheet,candidate,fields,expectedRecord) {
  var values=sheet.getDataRange().getValues(),headers=readHeaders_(values[0]),matches=[];
  for (var i=1;i<values.length;i+=1) if (values[i][headers['Notification ID']]===candidate.notificationId && values[i][headers.Transport]===candidate.transport) matches.push(i);
  if (matches.length!==1) throw new Error('LEDGER_PATCH_READBACK_IDENTITY_INVALID');
  var row=values[matches[0]];
  if (JSON.stringify(ledgerImmutableSnapshot_(row,headers))!==JSON.stringify(candidate.sourceSnapshot)) throw new Error('LEDGER_PATCH_READBACK_SOURCE_CHANGED');
  Object.keys(fields).forEach(function(name) {
    if (ledgerComparable_(row[headers[name]])!==ledgerComparable_(fields[name])) throw new Error('LEDGER_PATCH_READBACK_MISMATCH:'+name);
  });
  if (expectedRecord && JSON.stringify(ledgerRecordSnapshot_(ledgerNamedRow_(row,headers)))!==JSON.stringify(ledgerRecordSnapshot_(expectedRecord))) throw new Error('LEDGER_PATCH_READBACK_STATE_CHANGED');
  return ledgerNamedRow_(row,headers);
}
function claimLedgerCandidate_(sheet,headers,candidate,properties) {
  assertLedgerLock_();
  var exact=readExactLedgerCandidate_(sheet,candidate,null);
  // Bound the independently attested complete source snapshot before any claim write.
  if (exact.sourceRows.length>128) throw new Error('LEDGER_SOURCE_SNAPSHOT_BOUNDS');
  var beforeRows=exact.sourceRows.map(function(row) { return ledgerNamedRow_(row,exact.headers); });
  if (Utilities.newBlob(JSON.stringify(beforeRows)).getBytes().length>262144) throw new Error('LEDGER_SOURCE_SNAPSHOT_BOUNDS');
  var started=new Date(), claimId='CLAIM|'+Utilities.getUuid();
  if (candidate.controlledUat && !isFreshControlledTransportUat_(exact.row,exact.headers,parseCsvSet_(candidate.notificationId),started)) throw new Error('UAT_FRESH_IDENTITY_REQUIRED');
  if (candidate.enforceQuietHours && isQuietHours_(started) && !candidate.controlledUat && !canBypassQuietHours_(exact.record.Priority,exact.record['Change Type'])) throw new Error('QUIET_HOURS_HOLD');
  var fields={'Status':'SENDING','Attempt Count':candidate.attemptCount+1,'Last Attempt At':started,'Notes':appendLedgerNote_(candidate.notes,claimId)};
  writeFields_(sheet,exact.headers,exact.rowNumber,fields); SpreadsheetApp.flush();
  var claimed=verifyLedgerPatch_(sheet,candidate,fields,ledgerPatchedRecord_(exact.record,fields));
  return {notification_id:candidate.notificationId,transport:candidate.transport,claim_id:claimId,attempt_count:fields['Attempt Count'],
    attempted_at:started.toISOString(),before_row:exact.record,before_rows:beforeRows,claimed_row:claimed};
}
function projectLedgerFields_(sheet,candidate,claim,fields) {
  assertLedgerLock_();
  var exact=readExactLedgerCandidate_(sheet,candidate,claim);
  writeFields_(sheet,exact.headers,exact.rowNumber,fields); SpreadsheetApp.flush();
  return verifyLedgerPatch_(sheet,candidate,fields,ledgerPatchedRecord_(exact.record,fields));
}
function projectLedgerAcknowledgement_(sheet,headers,candidate,claim,result) {
  assertLedgerLock_();
  var evidence=result && result.evidence;
  if (!result || typeof result.httpStatus!=='number' || result.httpStatus<200 || result.httpStatus>=300 || !evidence ||
    Math.floor(result.httpStatus)!==result.httpStatus) throw new Error('PROVIDER_ACCEPTANCE_EVIDENCE_REQUIRED');
  var messageId=result.providerMessageId || '';
  if (candidate.transport==='LINE_OWNER_ALERTS') {
    if (evidence.transport!=='LINE' || evidence.api_accepted!==true || typeof messageId!=='string' ||
      (messageId && !/^[0-9]{1,40}$/.test(messageId)) || evidence.message_id!==messageId ||
      (!messageId && (typeof evidence.request_id!=='string' || !/^[A-Za-z0-9_-]{8,128}$/.test(evidence.request_id)))) throw new Error('PROVIDER_ACCEPTANCE_EVIDENCE_MISMATCH');
  } else if (candidate.transport==='TELEGRAM_OWNER_ALERTS') {
    if (evidence.transport!=='TELEGRAM' || evidence.api_ok!==true || evidence.durable_ack!==true || evidence.consumer_id!=='6176241' ||
      typeof messageId!=='string' || !/^[0-9]{1,40}$/.test(messageId) || evidence.message_id!==messageId ||
      evidence.source_notification_id!==candidate.notificationId || !evidence.receipt_id) throw new Error('PROVIDER_ACCEPTANCE_EVIDENCE_MISMATCH');
  } else throw new Error('PROVIDER_ACCEPTANCE_EVIDENCE_TRANSPORT_INVALID');
  var completed=new Date();
  if (Object.prototype.hasOwnProperty.call(result,'apiAcceptedAt')) {
    var accepted=parseDate_(result.apiAcceptedAt),attempted=parseDate_(claim.attempted_at);
    if (!accepted || !attempted || accepted<attempted || accepted>completed) throw new Error('PROVIDER_ACCEPTANCE_TIMESTAMP_INVALID');
    completed=accepted;
  }
  var fields={'Delivery Evidence':JSON.stringify(evidence),'Next Retry At':'','HTTP Status':result.httpStatus,
    'Provider Message ID':result.providerMessageId || '','API Accepted At':completed,'Delivery Confirmed At':'','Last Error':'',
    'Notes':appendLedgerNote_(claim.claimed_row.Notes,'API_ACCEPTED'),'Status':'SENT'};
  var persisted=projectLedgerFields_(sheet,candidate,claim,fields);
  return {notification_id:candidate.notificationId,status:'SENT',transport:candidate.transport,provider_message_id:persisted['Provider Message ID'],
    api_accepted_at:ledgerComparable_(persisted['API Accepted At']),delivery_confirmed_at:'',claim_id:claim.claim_id};
}

function maximumAttempts_(properties) {
  var configured = Number(properties.CORE_V1_MAX_ATTEMPTS || CORE_V1.maxAttempts);
  return isFinite(configured) && configured >= 1 ? Math.min(CORE_V1.maxAttempts, Math.floor(configured)) : CORE_V1.maxAttempts;
}

function validateTransport_(transport, properties) {
  if (transport==='TELEGRAM_OWNER_ALERTS') {
    if (typeof KKOwnerTelegramBridge==='undefined' || typeof KKOwnerTelegramBridge.send!=='function') throw new Error('MAKE_6176241_BRIDGE_REQUIRED');
  } else if (transport==='LINE_OWNER_ALERTS') {
    if (!properties.LINE_CHANNEL_ACCESS_TOKEN || !(properties.LINE_OWNER_USER_ID || properties.LINE_USER_ID)) throw new Error('LINE_CREDENTIALS_NOT_CONFIGURED');
  } else throw new Error('TRANSPORT_NOT_SUPPORTED');
}

function providerError_(provider, httpStatus, explicitlyRejected) {
  var error = new Error(provider + (explicitlyRejected ? '_API_REJECTED_HTTP_' : '_OUTCOME_UNKNOWN_HTTP_') + httpStatus);
  error.coreV1HttpStatus = httpStatus;
  error.coreV1Disposition = explicitlyRejected ? (httpStatus === 429 ? 'retry' : 'failed') : 'reconcile';
  return error;
}

function isExplicitHttpRejection_(status) {
  return status >= 400 && status < 500 && [408, 409, 425].indexOf(status) < 0;
}

function sendTelegram_(message, properties) {
  // Policy binds Telegram delivery to Make6176241, never this Apps Script bot.
  throw new Error('DIRECT_TELEGRAM_SEND_FORBIDDEN_USE_MAKE_6176241');
}

function sendLine_(message, properties) {
  var ownerLineId=properties.LINE_OWNER_USER_ID || properties.LINE_USER_ID;
  if (!properties.LINE_CHANNEL_ACCESS_TOKEN || !ownerLineId) throw new Error('LINE_CREDENTIALS_NOT_CONFIGURED');
  var response=UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push',{
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+properties.LINE_CHANNEL_ACCESS_TOKEN},
    payload:JSON.stringify({to:ownerLineId,messages:[{type:'text',text:message}]}),muteHttpExceptions:true
  });
  var status=response.getResponseCode();
  if (status<200 || status>=300) throw providerError_('LINE',status,isExplicitHttpRejection_(status));
  var responseHeaders=response.getAllHeaders?response.getAllHeaders():{};
  var requestId='';
  Object.keys(responseHeaders).forEach(function(key) {
    if (key.toLowerCase()==='x-line-request-id' && typeof responseHeaders[key]==='string') requestId=responseHeaders[key];
  });
  var body=safeJson_(response.getContentText());
  var rawMessageId=body && body.sentMessages && body.sentMessages[0] && body.sentMessages[0].id;
  var messageId=typeof rawMessageId==='string' && /^[0-9]{1,40}$/.test(rawMessageId)?rawMessageId:'';
  if (rawMessageId!==undefined && rawMessageId!==null && !messageId) throw providerError_('LINE',status,false);
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) requestId='';
  if (!messageId && !requestId) throw providerError_('LINE',status,false);
  return {httpStatus:status,providerMessageId:messageId,deliveryConfirmed:false,
    evidence:{transport:'LINE',api_accepted:true,request_id:requestId,message_id:messageId,
      receipt_kind:messageId?'LINE_MESSAGE_ACCEPTANCE':'LINE_REQUEST_ACCEPTANCE'}};
}

/**
 * Converts ledger text to a concise owner-facing Thai notification.
 * It only restructures supplied text; it does not add event facts.
 */
function formatHumanAlert_(payload) {
  var text = normalizeText_(payload);
  if (!text) throw new Error('EMPTY_NOTIFICATION_PAYLOAD');
  if (/\[object Object\]|\bundefined\b|\bnull\b/i.test(text) || looksLikeRawJson_(text)) {
    throw new Error('MACHINE_GARBAGE_PAYLOAD_BLOCKED');
  }

  text = text
    .replace(/\s+·\s+/g, '\n')
    .replace(/^(🎟\s*[^📅\n]+?)\s+((?:\d{1,2}\s*[–-]\s*\d{1,2}|\d{1,2})\s+[^\s]+\s+\d{4})/i, '$1\n📅 $2')
    .replace(/\s+(📅|📍|🔗)\s*/g, '\n$1 ')
    .replace(/\s+(สถานะกดบัตร:|กดบัตรแล้ว:|แนะนำ:)\s*/g, '\n$1 ')
    .replace(/\s+(ทั้ง[^\n]*(?:SOLD OUT|เต็มแล้ว|เปิดขายแล้ว|เพิ่มรอบ)[^\n]*)/gi, '\n$1')
    .replace(/\s+(https?:\/\/\S+)/g, '\n$1');

  var rawLines = text.split(/\r?\n/).map(function (line) {
    return line.trim();
  }).filter(Boolean);
  var lines = [];
  var expectVenue = false;
  for (var i = 0; i < rawLines.length; i += 1) {
    var line = rawLines[i];
    if (i === 0) {
      line = line.replace(/^🎟\s*/, '').replace(/^งาน:\s*/, '');
      lines.push('🎟 งาน: ' + line);
      continue;
    }
    if (/^📅/.test(line)) {
      lines.push(line.replace(/^📅\s*/, '📅 วันที่: ').replace(/^📅 วันที่:\s*วันที่:\s*/, '📅 วันที่: '));
      expectVenue = true;
    } else if (/^📍/.test(line)) {
      lines.push(line.replace(/^📍\s*/, '📍 สถานที่: ').replace(/^📍 สถานที่:\s*สถานที่:\s*/, '📍 สถานที่: '));
      expectVenue = false;
    } else if (expectVenue && !/^https?:\/\//i.test(line) && !/^(สถานะกดบัตร:|กดบัตรแล้ว:|แนะนำ:|ทั้ง)/i.test(line)) {
      lines.push('📍 สถานที่: ' + line);
      expectVenue = false;
    } else if (/^https?:\/\//i.test(line)) {
      lines.push('🔗 ข้อมูลต้นทาง: ' + line);
    } else if (/^(สถานะกดบัตร:|กดบัตรแล้ว:)\s*ใช่/i.test(line)) {
      lines.push('ตรวจพบหน้าจำหน่ายบัตร: ใช่');
    } else if (/^ทั้ง/i.test(line)) {
      lines.push('อัปเดต: ' + line);
    } else {
      lines.push(line);
    }
  }

  var output = '🔔 แจ้งเตือนงานที่สแกนพบ\n\n' + lines.join('\n');
  if (output.length > CORE_V1.maxMessageChars) {
    throw new Error('NOTIFICATION_TOO_LONG');
  }
  return output;
}

function validateHumanAlert_(message) {
  if (!message || message.indexOf('🔔 แจ้งเตือนงานที่สแกนพบ') !== 0) {
    throw new Error('HUMAN_ALERT_HEADING_REQUIRED');
  }
  if (/\[object Object\]|\bundefined\b|\bnull\b/i.test(message)) {
    throw new Error('MACHINE_GARBAGE_PAYLOAD_BLOCKED');
  }
  if (!/https?:\/\//i.test(message)) {
    throw new Error('SOURCE_URL_REQUIRED');
  }
  if (!/แนะนำ:/.test(message)) {
    throw new Error('OWNER_ACTION_REQUIRED');
  }
}

function readHeaders_(headerRow) {
  var expected=ledgerHeaders_(), headers={};
  if (!headerRow || headerRow.length!==expected.length) throw new Error('LEDGER_HEADERS_INVALID');
  for (var i=0;i<expected.length;i+=1) {
    if (typeof headerRow[i]!=='string' || headerRow[i]!==expected[i] || headers[headerRow[i]]!==undefined) throw new Error('LEDGER_HEADERS_INVALID');
    headers[headerRow[i]]=i;
  }
  return headers;
}

function requireHeaders_(headers, required) {
  var missing = required.filter(function (name) { return headers[name] === undefined; });
  if (missing.length) throw new Error('LEDGER_HEADERS_MISSING:' + missing.join(','));
}

function writeFields_(sheet, headers, rowNumber, fields) {
  assertLedgerLock_();
  var owned=['Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Notes','HTTP Status',
    'Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error'];
  var keys=Object.keys(fields);
  keys.forEach(function(header) {
    if (headers[header]===undefined) throw new Error('LEDGER_WRITE_HEADER_MISSING');
    if (owned.indexOf(header)<0) throw new Error('LEDGER_WRITE_FIELD_FORBIDDEN');
  });
  // SENDING is a fail-closed fuse and is written before other claim fields.
  // All other statuses are written last, after the associated evidence cells.
  if (fields.Status==='SENDING') { sheet.getRange(rowNumber,headers.Status+1).setValue('SENDING'); }
  keys.forEach(function(header) { if (header!=='Status') sheet.getRange(rowNumber,headers[header]+1).setValue(fields[header]); });
  if (Object.prototype.hasOwnProperty.call(fields,'Status') && fields.Status!=='SENDING') sheet.getRange(rowNumber,headers.Status+1).setValue(fields.Status);
}

function isEligibleStatus_(status) {
  return CORE_V1.eligibleStatuses.indexOf(String(status || '').toUpperCase()) >= 0;
}

function isQuietHours_(date) {
  // Bangkok is UTC+07:00, independent of the Apps Script project time zone.
  var hour = new Date(date.getTime() + 7 * 60 * 60 * 1000).getUTCHours();
  return hour >= 23 || hour < 7;
}

function canBypassQuietHours_(priority, changeType) {
  // Generic MATERIAL_EVENT_UPDATE or a P0 label alone is insufficient. Missing
  // explicit subtype fails closed; never infer an override from payload text.
  return priority === 'P0' && CORE_V1.quietHoursOverrideChanges.indexOf(changeType) >= 0;
}

function retryMinutes_(attempt) {
  return Math.min(60, 5 * Math.pow(2, Math.max(0, Number(attempt) - 1)));
}

function parseDate_(value) {
  if (!value) return null;
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function normalizeText_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeRawJson_(text) {
  var trimmed = String(text || '').trim();
  if (!/^[\[{]/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch (ignore) {
    return false;
  }
}

function safeJson_(text) {
  try { return JSON.parse(text); } catch (ignore) { return {}; }
}

function sanitizeError_(error) {
  var message = error && error.message ? String(error.message) : 'UNKNOWN_TRANSPORT_ERROR';
  return message
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 500);
}

function appendNote_(existing, addition) {
  var left = normalizeText_(existing);
  return left ? left + ' | ' + addition : addition;
}
