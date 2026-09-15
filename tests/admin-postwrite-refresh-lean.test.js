const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','admin','admin.js'),'utf8');

function createEventBlock(){
  const start=src.indexOf('const eventForm=$("#eventForm")');
  const end=src.indexOf('const resetCreateEventPrices=$("#resetCreateEventPrices")',start);
  assert.ok(start>=0 && end>start,'createEvent handler block must exist');
  return src.slice(start,end);
}

test('createEvent no longer blocks success UI on full snapshot refresh',()=>{
  const block=createEventBlock();
  assert.match(block,/const res=await api\("createEvent",p\)/);
  assert.match(block,/schedulePostWriteRefresh\("createEvent"\)/);
  assert.doesNotMatch(block,/await refresh\(\)/);
  assert.ok(block.indexOf('schedulePostWriteRefresh("createEvent")') < block.indexOf('showNotice("สร้างงานสำเร็จ"'));
});

test('post-write refresh is bounded, fail-visible, and keeps snapshot safety state',()=>{
  assert.match(src,/function schedulePostWriteRefresh\(reason="write", attempt=0\)/);
  assert.match(src,/if\(attempt<8\) return schedulePostWriteRefresh\(reason,attempt\+1\)/);
  assert.match(src,/snapshotState\.writePending=true/);
  assert.match(src,/Snapshot ยังไม่ Sync อัตโนมัติ กรุณากด Refresh/);
  assert.match(src,/Sync หน้าจอล่าสุดไม่สำเร็จ กรุณากด Refresh/);
});

test('refresh started before the latest write cannot clear pending state',()=>{
  assert.match(src,/writeGeneration:\s*0/);
  assert.match(src,/const writeGenerationAtStart=Number\(snapshotState\.writeGeneration\|\|0\)/);
  assert.match(src,/if\(attempt===0\) snapshotState\.writeGeneration=Number\(snapshotState\.writeGeneration\|\|0\)\+1/);
  assert.match(src,/if\(writeGenerationAtStart>=Number\(snapshotState\.writeGeneration\|\|0\)\)\{\s*snapshotState\.writePending=false;\s*snapshotState\.writePendingReason="";/);
});

test('verified refresh clears the pending marker and status exposes background convergence',()=>{
  assert.match(src,/snapshotState\.goodAt=snapshotState\.checkedAt/);
  assert.match(src,/กำลัง Sync Snapshot เบื้องหลัง/);
});
