/**
 * KK Phone Rental — Archive old bookings safely every 3 months
 * Copy to Google Sheets > Extensions > Apps Script, then run installQuarterlyArchiveTrigger() once.
 * v13.2 audit fix: copy values to Archive_Bookings, then clear only input columns B:T.
 * This keeps formula columns in 00_Master_Booking intact.
 */
const MASTER_SHEET = '00_Master_Booking';
const ARCHIVE_SHEET = 'Archive_Bookings';
const HEADER_ROW = 4;
const DATA_START_ROW = 5;
const DAYS_TO_KEEP = 90;
const CLEAR_START_COL = 2;  // B: created_at
const CLEAR_END_COL = 20;   // T: staff_note

function installQuarterlyArchiveTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'archiveOldBookings')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('archiveOldBookings')
    .timeBased()
    .everyMonths(3)
    .onMonthDay(1)
    .atHour(3)
    .create();
}

function archiveOldBookings() {
  const ss = SpreadsheetApp.getActive();
  const master = ss.getSheetByName(MASTER_SHEET);
  const archive = ss.getSheetByName(ARCHIVE_SHEET);
  if (!master || !archive) throw new Error('Missing master/archive sheet');

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();
  if (lastRow < DATA_START_ROW) return;

  const headers = master.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
  const statusCol = headers.indexOf('booking_status') + 1;
  const eventDateCol = headers.indexOf('event_date') + 1;
  const returnTimeCol = headers.indexOf('return_time') + 1;
  if (!statusCol || !eventDateCol) throw new Error('Missing booking_status/event_date header');

  const values = master.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, lastCol).getValues();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP);
  cutoff.setHours(0, 0, 0, 0);

  const rowsToArchive = [];
  const rowNumbersToClear = [];

  values.forEach((row, i) => {
    const status = String(row[statusCol - 1] || '').toLowerCase().trim();
    if (!['returned', 'cancelled', 'no_show'].includes(status)) return;

    const rawDate = (returnTimeCol ? row[returnTimeCol - 1] : '') || row[eventDateCol - 1];
    const bookingDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (isNaN(bookingDate.getTime())) return;

    bookingDate.setHours(0, 0, 0, 0);
    if (bookingDate <= cutoff) {
      rowsToArchive.push(row);
      rowNumbersToClear.push(DATA_START_ROW + i);
    }
  });

  if (!rowsToArchive.length) return;

  const appendRow = getAppendRow_(archive, 1, HEADER_ROW);
  archive.getRange(appendRow, 1, rowsToArchive.length, lastCol).setValues(rowsToArchive);

  const clearWidth = CLEAR_END_COL - CLEAR_START_COL + 1;
  rowNumbersToClear.forEach(rowNumber => {
    master.getRange(rowNumber, CLEAR_START_COL, 1, clearWidth).clearContent();
  });
}

function getAppendRow_(sheet, keyCol, headerRow) {
  const lastRow = Math.max(sheet.getLastRow(), headerRow);
  if (lastRow <= headerRow) return headerRow + 1;
  const values = sheet.getRange(headerRow + 1, keyCol, lastRow - headerRow, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || '').trim() !== '') return headerRow + 1 + i + 1;
  }
  return headerRow + 1;
}
