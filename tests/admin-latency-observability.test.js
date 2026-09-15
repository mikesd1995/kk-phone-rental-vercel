const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const guard=require('../api/kk-admin-guard.js');
const instrumentLegacyTiming=guard._test.instrumentLegacyTiming;

function fakeResponse(){
  const headers={};
  return {headers,setHeader(k,v){headers[k]=String(v);},writeHead(){return this;},write(){return true;},end(){return this;}};
}

test('delegate timing stamps segmented headers before response starts',()=>{
  const realNow=Date.now; let now=1000; Date.now=()=>now;
  try{
    const res=fakeResponse();
    instrumentLegacyTiming(res,{requestStartedAt:900,action:'createEvent',preflightMs:25});
    now=1200; res.writeHead(200);
    assert.equal(res.headers['X-KK-Admin-Action'],'createEvent');
    assert.equal(res.headers['X-KK-Admin-Preflight-MS'],'25');
    assert.equal(res.headers['X-KK-Admin-Upstream-MS'],'200');
    assert.equal(res.headers['X-KK-Admin-Total-MS'],'300');
    assert.equal(res.headers['Server-Timing'],'preflight;dur=25, upstream;dur=200, total;dur=300');
  } finally { Date.now=realNow; }
});

test('timing stamp is idempotent across writeHead/write/end',()=>{
  const realNow=Date.now; let now=2000; Date.now=()=>now;
  try{
    const res=fakeResponse();
    instrumentLegacyTiming(res,{requestStartedAt:1900,action:'createBooking',preflightMs:50});
    now=2100; res.write('x'); now=2600; res.end();
    assert.equal(res.headers['X-KK-Admin-Upstream-MS'],'100');
    assert.equal(res.headers['X-KK-Admin-Total-MS'],'200');
  } finally { Date.now=realNow; }
});

test('guarded event and booking paths both install delegate telemetry',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','api','kk-admin-guard.js'),'utf8');
  const calls=[...src.matchAll(/instrumentLegacyTiming\(res,\{requestStartedAt,action,preflightMs(?::bookingPreflightMs)?\}\)/g)];
  assert.equal(calls.length,2);
  assert.match(src,/X-KK-Booking-Preflight-MS/);
  assert.match(src,/X-KK-Admin-Upstream-MS/);
  assert.match(src,/X-KK-Admin-Total-MS/);
  assert.match(src,/Server-Timing/);
});
