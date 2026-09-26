'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const adminHtml=fs.readFileSync('admin/index.html','utf8');
const adminJs=fs.readFileSync('admin/admin.js','utf8');

test('Admin client recovery offers retry instead of only telling operator to refresh',()=>{
  assert.match(adminHtml,/id="adminClientRecovery"/);
  assert.match(adminHtml,/id="adminClientRetryBtn"/);
  assert.match(adminJs,/function showAdminClientRecovery\(id,kind\)/);
  assert.match(adminJs,/await refresh\(\)/);
  assert.match(adminJs,/showNotice\("โหลดข้อมูลใหม่สำเร็จ"\)/);
  assert.match(adminJs,/hideAdminClientRecovery\(\)/);
});

test('Admin direct localStorage access remains confined to guarded helpers',()=>{
  const matches=[...adminJs.matchAll(/\blocalStorage\.(getItem|setItem|removeItem)\(/g)];
  assert.equal(matches.length,3);
  assert.match(adminJs,/function safeLocalGet\(key\)/);
  assert.match(adminJs,/function safeLocalSet\(key,value\)/);
  assert.match(adminJs,/function safeLocalRemove\(key\)/);
});


test('server query parsing avoids Vercel IncomingMessage query getter',()=>{
  const adminSession=fs.readFileSync('server/admin-session.js','utf8');
  const publicData=fs.readFileSync('api/kk-data.js','utf8');
  const scanner=fs.readFileSync('api/kk-scanner-dispatch.js','utf8');
  assert.doesNotMatch(adminSession,/\breq\.query\b/);
  assert.doesNotMatch(publicData,/\breq\.query\b/);
  assert.doesNotMatch(scanner,/\breq\.query\b/);
  assert.match(adminSession,/new URL\(String\(req&&req\.url\|\|'\/ '\)|new URL\(String\(req&&req\.url\|\|'\/'\)/);
  assert.match(publicData,/function requestQueryValue\(req, key\)/);
  assert.match(scanner,/new URL\(String\(req&&req\.url\|\|'\/'\),/);
});
