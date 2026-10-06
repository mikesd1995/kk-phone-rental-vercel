'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const scanner=require('../api/kk-scanner-dispatch.js');

test('verifier diagnostic exposes counts and blocker histogram only',()=>{
  const d=scanner._test.verifierDiagnostic({
    status:'HOLD_NO_VERIFIED_CANDIDATES',
    input_count:4,
    fetched_count:3,
    verified_count:0,
    hold_count:4,
    holds:[
      {title:'secret title',source_url:'https://secret.example/a',blockers:['EVENT_DATE_REQUIRED','EVENT_DATE_REQUIRED']},
      {title:'another',source_url:'https://secret.example/b',blockers:['AUTHORITATIVE_EVENT_SOURCE_REQUIRED']},
      {blockers:['SOURCE_FETCH_FAILED']},
      {blockers:['EVENT_DATE_REQUIRED']}
    ]
  });
  assert.deepEqual(d,{
    status:'HOLD_NO_VERIFIED_CANDIDATES',
    input_count:4,
    fetched_count:3,
    verified_count:0,
    hold_count:4,
    blocker_histogram:{
      EVENT_DATE_REQUIRED:3,
      AUTHORITATIVE_EVENT_SOURCE_REQUIRED:1,
      SOURCE_FETCH_FAILED:1
    },
    privacy:'COUNTS_ONLY_NO_TITLE_URL_PAYLOAD',
    production_writes:0
  });
  assert.doesNotMatch(JSON.stringify(d),/secret|https?:/i);
});
