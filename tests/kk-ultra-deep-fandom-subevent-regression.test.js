'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Subevent=require('../server/kk-ultra-deep-fandom-subevent.js');

test('generic parent venue accepts numbered child hall in same complex',()=>{
  const x=Subevent.classify(
    {event_date:'2026-10-09',venue:'Union Hall 2, Union Mall'},
    {event_id:'FANIVAL-09',event_date:'2026-10-09',venue:'Union Hall, Union Mall',active_on_web:true}
  );
  assert.equal(x.decision,'ATTACH_TO_PARENT');
});

test('hidden generic parent may receive evidence but is never reopened by child demand',()=>{
  const x=Subevent.classify(
    {event_date:'2026-10-11',venue:'Union Hall 2, Union Mall'},
    {event_id:'FANIVAL-11',event_date:'2026-10-11',venue:'Union Hall, Union Mall',active_on_web:false}
  );
  assert.equal(x.decision,'ATTACH_EVIDENCE_ONLY');
  assert.equal(x.may_reopen_parent,false);
});

test('two explicitly different numbered halls remain distinct operational venues',()=>{
  const x=Subevent.classify(
    {event_date:'2026-10-09',venue:'Union Hall 2, Union Mall'},
    {event_id:'PARENT',event_date:'2026-10-09',venue:'Union Hall 1, Union Mall',active_on_web:true}
  );
  assert.equal(x.decision,'SEPARATE_CANDIDATE');
});
