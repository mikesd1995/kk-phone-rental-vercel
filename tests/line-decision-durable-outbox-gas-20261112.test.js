'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');

const BOOKING='BK-20261112-001';
const CUSTOMER='U'+'a'.repeat(32);
const REQUEST='line:'+'a'.repeat(48);
const VERSION='KK_LINE_DECISION_OUTBOX_V1';

function makeGas(opts={}){
  const full=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  const start=full.indexOf('// Source-staged delivery outbox.');
  const end=full.indexOf('\nfunction kkApiCreateBooking_(payload) {',start);
  assert.ok(start>=0&&end>start,'extract exact Apps Script state machine');
  const source=full.slice(start,end);
  const values=[
    BOOKING,new Date('2026-11-12T00:00:00Z'),'pending','EV-1','customer',CUSTOMER,
    '', 'LINE','phone_lens_bundle','','','','','unpaid',0,'','','',0,
    'LINE webhook intake [KK_REQ:'+REQUEST+']'
  ];
  values[2]=opts.initialStatus||'pending';
  let row=values;
  const properties=new Map([['KK_LINE_DECISION_OUTBOX_V1_ENABLED',opts.gasModeOff?'false':'true']]),writes=[],lockEvents=[];
  const props={
    getProperty:k=>properties.get(k)||null,
    setProperty:(k,v)=>{
      if(opts.rejectWrite)throw Error('synthetic property quota exceeded');
      properties.set(k,v);
    }
  };
  const scope={
    KK:{bookings:'bookings'},
    PropertiesService:{getScriptProperties:()=>props},
    SpreadsheetApp:{flush:()=>{
      if(opts.crashAfterBookingWrite){
        opts.crashAfterBookingWrite=false;
        throw Error('simulated post-commit crash');
      }
    }},
    Utilities:{
      DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
      computeDigest:(_algo,id)=>Array.from(crypto.createHash('sha256').update(id).digest())
        .map(n=>n>127?n-256:n),
      getUuid:()=>crypto.randomUUID()
    },
    kkAcquireDocumentLock_:(reason)=>{
      lockEvents.push('acquire:'+reason);
      return {releaseLock(){lockEvents.push('release')}};
    },
    kkFindBookingRow_:(_row,id)=>{assert.equal(id,BOOKING);return 5},
    kkSheet_:()=>({getRange:(r,c,h,w)=>{
      assert.equal(r,5);assert.equal(c,1);assert.equal(h,1);assert.equal(w,20);
      return {
        getValues:()=>[row.slice()],
        setValues:(rows)=>{row=rows[0].slice();writes.push(row.slice())}
      };
    }}),
    kkBookingRequestIdFromNote_:note=>{
      const match=String(note).match(/\[KK_REQ:([A-Za-z0-9._:-]+)\]/);
      return match?match[1]:'';
    },
    Date
  };
  const accessors='\n;({decide:kkApiDecideLineBookingPending_,claim:kkApiClaimLineBookingDecisionDelivery_,ack:kkApiAckLineBookingDecisionDelivery_,uncertain:kkApiMarkLineBookingDecisionUncertain_,inspect:kkApiInspectLineBookingDecisionDelivery_,readiness:kkApiLineDecisionOutboxReadiness_,outbox:kkLineDecisionOutboxRead_})';
  const fn=vm.runInNewContext(source+accessors,scope);
  return {...fn,properties,writes,lockEvents,
    row:()=>row.slice(),state:()=>fn.outbox(BOOKING)};
}

test('GAS write-ahead PREPARED survives post-commit crash and canonical replay resumes safely',()=>{
  const gas=makeGas({crashAfterBookingWrite:true});
  assert.throws(()=>gas.decide({booking_id:BOOKING,decision:'approve'}),/post-commit crash/);
  assert.equal(gas.row()[2],'confirmed');
  assert.equal(gas.state().state,'PREPARED');
  const retry=gas.decide({booking_id:BOOKING,decision:'approve'});
  assert.equal(retry.idempotent_replay,true);
  assert.equal(retry.outbox_version,VERSION);
  assert.equal(retry.delivery_state,'PREPARED');
  const first=gas.claim({booking_id:BOOKING,decision:'approve'});
  const second=gas.claim({booking_id:BOOKING,decision:'approve'});
  assert.equal(first.claimed,true);
  assert.equal(second.claimed,false);
  assert.equal(second.delivery_state,'CLAIMED');
  const ack=gas.ack({booking_id:BOOKING,decision:'approve',
    claim_id:first.claim_id,provider_message_id:'line_msg_123'});
  assert.equal(ack.delivery_state,'SENT');
  assert.equal(gas.claim({booking_id:BOOKING,decision:'approve'}).claimed,false);
  assert.equal(gas.state().provider_message_id,'line_msg_123');
  assert.equal(gas.row()[19], 'LINE webhook intake [KK_REQ:'+REQUEST+']');
  assert.equal(gas.lockEvents.filter(x=>x.startsWith('acquire')).length,
    gas.lockEvents.filter(x=>x==='release').length);
});

test('GAS ledger persistence failure prevents booking status mutation',()=>{
  const gas=makeGas({rejectWrite:true});
  assert.throws(()=>gas.decide({booking_id:BOOKING,decision:'approve'}),/quota/);
  assert.equal(gas.row()[2],'pending');
  assert.equal(gas.writes.length,0);
});

test('GAS uncertain claim stays non-retriable and rejects forged provider receipt',()=>{
  const gas=makeGas();
  const decided=gas.decide({booking_id:BOOKING,decision:'approve'});
  assert.equal(decided.delivery_state,'PREPARED');
  const claimed=gas.claim({booking_id:BOOKING,decision:'approve'});
  assert.throws(()=>gas.ack({booking_id:BOOKING,decision:'approve',
    claim_id:'234e4567-e89b-42d3-a456-426614174000',provider_message_id:'fake'}),/mismatch/);
  const unknown=gas.uncertain({
    booking_id:BOOKING,decision:'approve',claim_id:claimed.claim_id
  });
  assert.equal(unknown.delivery_state,'UNCERTAIN');
  assert.equal(gas.claim({booking_id:BOOKING,decision:'approve'}).claimed,false);
  assert.throws(()=>gas.ack({
    booking_id:BOOKING,decision:'approve',claim_id:claimed.claim_id,provider_message_id:'line_msg_123'
  }),/cannot be acknowledged/);
});

test('legacy booking already confirmed without outbox never prepares a second send',()=>{
  const gas=makeGas({initialStatus:'confirmed'});
  const result=gas.decide({booking_id:BOOKING,decision:'approve'});
  assert.equal(result.idempotent_replay,true);
  assert.equal(result.outbox_version,'');
  assert.equal(result.delivery_state,'LEGACY_UNVERIFIED');
  assert.equal(gas.state(),null);
  assert.throws(()=>gas.claim({booking_id:BOOKING,decision:'approve'}),/intent missing/);
});

test('one canonical booking cannot change decision or a completed provider receipt',()=>{
  const gas=makeGas();
  gas.decide({booking_id:BOOKING,decision:'approve'});
  assert.throws(()=>gas.decide({booking_id:BOOKING,decision:'reject'}),/already bound/);
  const claim=gas.claim({booking_id:BOOKING,decision:'approve'});
  const receipt={
    booking_id:BOOKING,decision:'approve',
    claim_id:claim.claim_id,provider_message_id:'line_msg_123'
  };
  assert.equal(gas.ack(receipt).delivery_state,'SENT');
  assert.equal(gas.ack(receipt).idempotent_replay,true);
  assert.throws(()=>gas.ack({...receipt,provider_message_id:'fake_msg_999'}),/cannot be acknowledged/);
  assert.equal(gas.uncertain({
    booking_id:BOOKING,decision:'approve',claim_id:claim.claim_id
  }).delivery_state,'SENT');
  for(const stored of gas.properties.values()){
    assert.equal(stored.includes(CUSTOMER),false,'ledger stores no customer LINE identity');
  }
});

test('GAS API routes require all guarded delivery actions and document locks',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  for(const action of [
    'claimLineBookingDecisionDelivery',
    'ackLineBookingDecisionDelivery',
    'markLineBookingDecisionUncertain',
    'inspectLineBookingDecisionDelivery',
    'lineDecisionOutboxReadiness'
  ]){
    assert.ok(source.includes("case '"+action+"':"),'action routing '+action);
  }
  assert.match(source,/kkAcquireDocumentLock_\('LINE decision delivery claim', 12000\)/);
  assert.match(source,/state:'PREPARED'/);
});

test('GAS code deployment alone stays legacy until owner enables private paired writer gate',()=>{
  const gas=makeGas({gasModeOff:true});
  const result=gas.decide({booking_id:BOOKING,decision:'approve'});
  assert.equal(result.booking_status,'confirmed');
  assert.equal(result.outbox_version,'');
  assert.equal(result.delivery_state,'LEGACY_DISABLED');
  assert.equal(gas.state(),null);
  assert.throws(()=>gas.claim({booking_id:BOOKING,decision:'approve'}),/disabled/);
});

test('owner-only GAS inspection reports state without customer contact, claim ID, or receipt ID',()=>{
  const gas=makeGas();
  const before=gas.inspect({booking_id:BOOKING});
  assert.equal(before.delivery_state,'LEGACY_UNVERIFIED');
  assert.equal(before.requires_manual_review,true);
  const intent=gas.decide({booking_id:BOOKING,decision:'approve'});
  assert.equal(intent.delivery_state,'PREPARED');
  const prepared=gas.inspect({booking_id:BOOKING});
  assert.equal(prepared.delivery_state,'PREPARED');
  assert.equal(prepared.provider_receipt_recorded,false);
  const claim=gas.claim({booking_id:BOOKING,decision:'approve'});
  assert.equal(gas.inspect({booking_id:BOOKING}).requires_manual_review,true);
  gas.ack({booking_id:BOOKING,decision:'approve',claim_id:claim.claim_id,provider_message_id:'line_msg_123'});
  const writesBefore=gas.writes.length;
  const inspected=gas.inspect({booking_id:BOOKING});
  assert.equal(inspected.delivery_state,'SENT');
  assert.equal(inspected.provider_receipt_recorded,true);
  assert.equal(inspected.requires_manual_review,false);
  assert.equal(gas.writes.length,writesBefore);
  const serial=JSON.stringify(inspected);
  assert.equal(serial.includes(CUSTOMER),false);
  assert.equal(serial.includes(claim.claim_id),false);
  assert.equal(serial.includes('line_msg_123'),false);
});

test('GAS zero-write readiness proves private owner flag and does not audit or mutate booking',()=>{
  for(const off of [false,true]){
    const gas=makeGas({gasModeOff:off});
    const before=gas.row();
    const receipt=gas.readiness();
    assert.equal(receipt.outbox_version,VERSION);
    assert.equal(receipt.enabled,!off);
    assert.equal(receipt.readonly,true);
    assert.deepEqual(gas.row(),before);
    assert.equal(gas.writes.length,0);
  }
  const full=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
  assert.match(full,/action !== 'privateCoreRead'|privateCoreRead/);
  for(const action of ['lineDecisionOutboxReadiness','inspectLineBookingDecisionDelivery']){
    const auditGuard=full.split('\n').find(line=>line.includes('includes(action)) kkAuditLog_(action, payload, result, startedAt)'))||'';
    const errorGuard=full.split('\n').find(line=>line.includes('kkErrorLog_(action || (payload && payload.action) ||'))||'';
    assert.ok(auditGuard.includes(action),'read-only action must skip write-audit');
    assert.ok(errorGuard.includes(action),'read-only action must skip error-audit');
  }
});
