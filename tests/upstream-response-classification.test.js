const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../server/upstream-response.js');

test('classifies Google auth HTML before generic Google/HTML matches',()=>{
  const x=U.classifyNonJsonResponse('<html><head><title>Sign in</title></head><body>accounts.google.com ServiceLogin</body></html>','text/html','script.google.com');
  assert.equal(x.code,'GOOGLE_AUTH_HTML');
  assert.match(x.message,/sign-in\/auth page/i);
});

test('classifies Drive/Docs responses separately from generic HTML',()=>{
  const x=U.classifyNonJsonResponse('<html><body>https://docs.google.com/spreadsheets/d/abc</body></html>','text/html','script.google.com');
  assert.equal(x.code,'GOOGLE_DRIVE_DOCS_HTML');
  assert.match(x.suggestion,/macros\/s\/\.\.\.\/exec/);
});

test('classifies missing Apps Script deployment separately from generic HTML',()=>{
  const x=U.classifyNonJsonResponse('<html><head><title>Page not found</title></head><body>Not Found</body></html>','text/html','script.google.com',404);
  assert.equal(x.code,'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND');
  assert.match(x.message,/HTTP 404/i);
  assert.match(x.suggestion,/KK_ADMIN_SCRIPT_URL/);
  assert.match(x.suggestion,/9_5_8/);
});

test('classifies generic HTML and opaque non-JSON responses',()=>{
  const html=U.classifyNonJsonResponse('<html><title>Temporary Error</title></html>','text/html','script.google.com');
  assert.equal(html.code,'GENERIC_HTML_RESPONSE');
  const opaque=U.classifyNonJsonResponse('not-json','text/plain','script.google.com');
  assert.equal(opaque.code,'NON_JSON_RESPONSE');
});

test('safe protocol log excludes response body and truncates fields',()=>{
  const x=U.safeProtocolLog({code:'X',status:502,content_type:'text/html',host:'script.google.com',action:'snapshot',body:'SECRET'});
  assert.deepEqual(Object.keys(x).sort(),['action','code','content_type','host','status']);
  assert.equal(x.status,502);
});
