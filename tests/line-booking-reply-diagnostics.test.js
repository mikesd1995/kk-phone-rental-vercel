'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const { _test }=require('../server/line-booking-webhook');

test('sanitized LINE reply diagnostics distinguish provider status without provider PII',()=>{
  const cases=[
    [400,'INVALID_REQUEST_OR_REPLY_TOKEN'],
    [401,'PROVIDER_AUTH_OR_PERMISSION'],
    [403,'PROVIDER_AUTH_OR_PERMISSION'],
    [404,'PROVIDER_CLIENT_FAILURE'],
    [429,'PROVIDER_RATE_LIMIT'],
    [500,'PROVIDER_SERVER_FAILURE'],
    [503,'PROVIDER_SERVER_FAILURE']
  ];
  for(const [status,category] of cases){
    const err=Object.assign(new Error('SYNTHETIC_PHONE_0999999999 TOKEN_SUPER_SECRET'),{
      code:'LINE_BOOKING_REPLY_FAILED',status,
      providerBody:'SYNTHETIC_CUSTOMER_PRIVATE',
      replyToken:'SYNTHETIC_TOKEN'
    });
    const out=_test.safeLineReplyDiagnostic(err);
    assert.deepEqual(out,{code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:status,provider_category:category});
    assert.doesNotMatch(JSON.stringify(out),/0999999999|SUPER_SECRET|SYNTHETIC_CUSTOMER_PRIVATE|SYNTHETIC_TOKEN/);
  }
});

test('transport and malformed status fail closed without arbitrary error details',()=>{
  const original='CUSTOMER_PRIVATE_DETAILS_AND_ACCESS_TOKEN';
  assert.deepEqual(
    _test.safeLineReplyDiagnostic({code:'LINE_BOOKING_REPLY_TRANSPORT_FAILED',message:original,status:503}),
    {code:'LINE_BOOKING_REPLY_TRANSPORT_FAILED',provider_http_status:null,provider_category:'TRANSPORT_ERROR'}
  );
  for(const status of [null,undefined,0,600,'401',NaN,Infinity,-1]){
    const output=_test.safeLineReplyDiagnostic({code:'LINE_BOOKING_REPLY_FAILED',status,message:original});
    assert.deepEqual(output,{code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:null,provider_category:'UNKNOWN_REPLY_FAILURE'});
  }
  for(const malicious of [null,undefined,{},new Error(original),{code:'ATTACK_'+original,status:429,message:original}]){
    const output=_test.safeLineReplyDiagnostic(malicious);
    assert.deepEqual(output,{code:'WEBHOOK_PROCESSING_FAILED',provider_http_status:null,provider_category:'OTHER'});
    assert.doesNotMatch(JSON.stringify(output),/CUSTOMER_PRIVATE|ACCESS_TOKEN/);
  }
});

test('LINE Reply API response status is preserved for redacted logging without reading response body',async()=>{
  let bodyReads=0;
  await assert.rejects(
    ()=>_test.replyFlex('SYNTHETIC_REPLY',{type:'text',text:'demo'},'SYNTHETIC_ACCESS_TOKEN',async()=>({
      ok:false,status:429,text:async()=>{bodyReads++;return 'PRIVATE_RESPONSE_TOKEN';}
    })),
    err=>{
      assert.deepEqual(_test.safeLineReplyDiagnostic(err),{
        code:'LINE_BOOKING_REPLY_FAILED',provider_http_status:429,provider_category:'PROVIDER_RATE_LIMIT'
      });
      assert.doesNotMatch(JSON.stringify(_test.safeLineReplyDiagnostic(err)),/PRIVATE_RESPONSE_TOKEN|SYNTHETIC_REPLY/);
      return true;
    }
  );
  assert.equal(bodyReads,0,'never consume untrusted LINE response bodies');
});
