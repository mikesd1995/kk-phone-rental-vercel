'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Cli=require('../scripts/kk-poster-intelligence-audit.js');

const fixture=[
 'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web',
 'EVT-20261013-OLD,Old Show,13/10/2026,Bangkok,, ,2,2,เปิดจอง,show',
 'EVT-20261014-NOW,New Show,14/10/2026,Bangkok,, ,2,2,เปิดจอง,show',
 'EVT-20261015-HIDDEN,Hidden,15/10/2026,Bangkok,, ,2,2,ซ่อนจากเว็บ,hide'
].join('\n');
const fakeFetch=async()=>({ok:true,status:200,text:async()=>fixture});
test('command surface is bounded, does not support write or deploy switches',()=>{
 assert.equal(Cli.parseArgs(['--probe','--as-of=2026-10-14']).probe,true);
 assert.throws(()=>Cli.parseArgs(['--publish']),/UNRECOGNIZED_OPTION/);
 assert.throws(()=>Cli.parseArgs(['--write-sheets']),/UNRECOGNIZED_OPTION/);
 assert.throws(()=>Cli.parseArgs(['--as-of=2026-10-14','--as-of=2026-10-15']),/DUPLICATE_OPTION/);
});
test('Bangkok operating date uses local calendar day, not UTC day',()=>{
 const d=new Date('2026-10-13T18:30:00Z');
 assert.equal(Cli.bangkokDate(d),'2026-10-14');
});
test('production public feed read requires expected schema and GET-only read',async()=>{
 let requested='';
 const rows=await Cli.loadRows({},async(url,opts)=>{
  requested=url;
  assert.match(opts.headers['User-Agent'],/ReadOnly/);
  assert.equal(opts.method,undefined);
  return fakeFetch();
 });
 assert.match(requested,/08_Web_Ready/);
 assert.equal(rows.length,3);
 assert.equal(rows[0].poster_image_url,'');
 await assert.rejects(()=>Cli.loadRows({},async()=>({ok:true,text:async()=> 'oops,unexpected\n1,2'})),/UNEXPECTED_FEED_SCHEMA/);
});
test('CLI live-read offline mock excludes past and hidden, no write or model call',async()=>{
 const report=await Cli.run(['--as-of=2026-10-14'],{fetchImpl:fakeFetch});
 assert.equal(report.visible_events,1);
 assert.equal(report.missing_poster,1);
 assert.equal(report.as_of,'2026-10-14');
 assert.equal(report.safety.production_writes,0);
 assert.equal(report.ai_review_queue.length,0);
});
test('invalid date does not silently broaden audit scope',async()=>{
 await assert.rejects(()=>Cli.run(['--as-of=2026-02-30'],{fetchImpl:fakeFetch}),/INVALID_AS_OF_DATE/);
});

test('unavailable/empty feed never produces a false green audit',async()=>{
 await assert.rejects(()=>Cli.loadRows({},async()=>({ok:true,text:async()=>
  'event_id,event_name,poster_image_url,action_for_web\n'})),/EMPTY_PUBLIC_FEED/);
 const emptyVisibility='event_id,event_name,event_date_text,poster_image_url,action_for_web\n'+
  'EVT-20261014-OWNER-HIDDEN,Hidden,14/10/2026,,hide\n';
 await assert.rejects(()=>Cli.run(['--as-of=2026-10-14'],{
  fetchImpl:async()=>({ok:true,text:async()=>emptyVisibility})
 }),/NO_VISIBLE_FUTURE_EVENTS/);
});
