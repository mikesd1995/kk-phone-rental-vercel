'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../server/admin-sheet-fallback.js');

test('CSV parser preserves quoted commas and escaped quotes',()=>{
  const rows=F.parseCsv('"a","b"\n"1","hello, ""world"""\n');
  assert.deepEqual(rows,[['a','b'],['1','hello, "world"']]);
});

test('rowsAsObjects locates a header below title rows',()=>{
  const rows=F.rowsAsObjects('"title"\n\n"id","name"\n"1","A"\n','id');
  assert.equal(rows.length,1); assert.equal(rows[0].id,'1'); assert.equal(rows[0].name,'A');
});

test('buildFromRaw creates required arrays and forces degraded read-only mode',()=>{
  const raw={
    events:[{event_id:'EV1',event_name:'Test',event_date:'19/09/2026',venue:'X',event_status:'open',active_on_web:'TRUE'}],
    bookings:[{__row_number:5,booking_id:'BK1',booking_status:'confirmed',event_id:'EV1',customer_name:'A',package_type:'phone_only',phone_asset_id:'P1',pickup_time:'12:00',payment_status:'paid',amount_received:'690'}],
    assets:[{asset_id:'P1',asset_type:'phone',model_group:'VIVO_X300_PRO',status:'available',rentable_now:'TRUE'}],
    packages:[{template_id:'TPL1',model_group:'VIVO_X300_PRO',package_type:'phone_only',standard_price:'690',display_name:'Vivo X300 Pro',active:'TRUE'}],
    overrides:[],web_ready:[],web_packages:[],customers:[],health:[],
    model_master:[{model_group:'VIVO_X300_PRO',model_display:'Vivo X300 Pro',asset_type:'phone',active:'TRUE'}]
  };
  const s=F.buildFromRaw(raw,'sheet-1',Date.now());
  assert.equal(s.degraded_read_only,true);
  assert.equal(s.write_actions_enabled,false);
  assert.equal(s.events.length,1);
  assert.equal(s.bookings.length,1);
  assert.equal(s.current_bookings.length,1);
  assert.equal(s.assets.length,1);
  assert.equal(s.bookings[0].phone_model_display,'Vivo X300 Pro');
  assert.equal(s.spreadsheet_id,'sheet-1');
});

test('buildSnapshot rejects HTML or missing schema through mocked GViz reads',async()=>{
  const fetchImpl=async(url)=>({ok:true,status:200,text:async()=>url.includes('01_Events')?'<html>login</html>':'"x"\n'});
  await assert.rejects(()=>F.buildSnapshot({sheetId:'sheet',fetchImpl}),/returned HTML|schema header/i);
});
