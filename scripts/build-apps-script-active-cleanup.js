'use strict';
const fs = require('node:fs');
const path = require('node:path');
const date = require('./build-apps-script-date-hotfix');
function replaceOne(text, from, to) {
  if (text.split(from).length !== 2) throw Error('SOURCE_ANCHOR_NOT_UNIQUE');
  return text.replace(from, to);
}
function buildCandidate(source = fs.readFileSync(date.BASE_PATH, 'utf8')) {
  let result = date.buildCandidate(source);
  const start = result.indexOf('function kkCleanupOldData30Days_() {');
  const end = result.indexOf('\nfunction kkCleanupOldData30Days() {', start);
  if (start < 0 || end < 0) throw Error('CLEANUP_ANCHOR_MISSING');
  result = result.slice(0,start) + fs.readFileSync(path.join(__dirname,'../apps-script/fragments/active-cleanup-v1.gs'),'utf8').replace(/\r\n/g,'\n') + result.slice(end);
  // Both existing creators keep their validation, asset selection and response contracts.
  for (const name of ['kkAddQuickBookingFromDashboard', 'kkApiCreateBooking_']) {
    const a = result.indexOf('function ' + name + '(');
    const b = result.indexOf('\nfunction ', a + 1);
    let fn = result.slice(a,b);
    fn = replaceOne(fn, '    const row = kkFirstEmptyRow_(KK.bookings, 4, 5, 2, 19);\n    kkSheet_(KK.bookings).getRange(row, 2, 1, 19).setValues([[', '    const created = kkActiveCreateBookingRow_([');
    fn = replaceOne(fn, '    ]]);', '    ], event.event_date);\n    const row = created.row_number;');
    if (name === 'kkAddQuickBookingFromDashboard') {
      fn = replaceOne(fn, 'function kkAddQuickBookingFromDashboard() {', "function kkAddQuickBookingFromDashboard() {\n  const lock = kkAcquireDocumentLock_('write operation', 12000);");
      fn = replaceOne(fn, '  }\n}', '  } finally {\n    lock.releaseLock();\n  }\n}');
    }
    // Block before compatibility helpers or any other creator-side mutation.
    fn = replaceOne(fn, '  try {', '  try {\n    kkActiveAssertNoPending_();');
    result = result.slice(0,a) + fn + result.slice(b);
  }
  return result;
}
if(require.main === module) {
  if(!process.argv[2]) throw Error('Usage: node scripts/build-apps-script-active-cleanup.js <new-output.gs>');
  const candidate=buildCandidate(); fs.writeFileSync(process.argv[2],candidate,{flag:'wx'});
  console.log(JSON.stringify({status:'LOCAL_CANDIDATE_DEFAULT_OFF',base_sha256:date.BASE_SHA256,candidate_sha256:date.sha256(candidate),output:process.argv[2]}));
}
module.exports={buildCandidate,BASE_SHA256:date.BASE_SHA256};
