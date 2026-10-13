'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');
const css=fs.readFileSync('admin/admin.css','utf8');

test('Health tab exposes root-cause triage instead of only raw CHECK rows',()=>{
  assert.match(html,/id="healthTriageCard"/);
  assert.match(html,/id="healthTriageSummary"/);
  assert.match(html,/id="healthTriageList"/);
  assert.match(html,/id="copyHealthTriageBtn"/);
  assert.match(js,/function healthTriageRows\(\)/);
  assert.match(js,/function renderHealthTriage\(\)/);
});

test('timezone and atomic timing are consolidated into one external-auth root cause',()=>{
  assert.match(js,/c==="spreadsheet timezone" \|\| c==="atomic reservation timing readiness"/);
  assert.match(js,/key:"apps_script_timing_authority"/);
  assert.match(js,/gate:"EXTERNAL_AUTH"/);
  assert.match(js,/Project Settings → Time zone/);
  assert.match(js,/ห้ามเปลี่ยน timezone, reinstall trigger หรือ deploy repo Code\.gs/);
});

test('accessory capacity remains a physical-stock decision and is never auto-fixed',()=>{
  assert.match(js,/c==="accessory kit capacity shortfall"/);
  assert.match(js,/key:"accessory_kit_capacity"/);
  assert.match(js,/gate:"PHYSICAL_STOCK"/);
  assert.match(js,/06_Accessory_Stock/);
  assert.match(js,/ห้ามเพิ่มตัวเลขเดาเพื่อปิด CHECK/);
});

test('overview attention counts triaged root causes, not duplicated raw health rows',()=>{
  assert.match(js,/function healthAttentionRows\(\)\{\s*return healthTriageRows\(\);/);
  assert.match(js,/root cause ที่ควรตรวจ/);
  assert.match(js,/renderHealthTriage\(\);\s*renderOperationalAttention\(\);/);
});

test('root-cause checklist is copyable without a write action',()=>{
  assert.match(js,/function healthTriageClipboardText\(\)/);
  assert.match(js,/copyHealthTriageBtn/);
  assert.match(js,/navigator\.clipboard\.writeText\(text\)/);
  assert.doesNotMatch(js,/copyHealthTriageBtn[\s\S]{0,500}api\(/);
});

test('smart health triage assets are cache-busted and mobile readable',()=>{
  assert.match(html,/admin\.css\?v=health-triage-20260926/);
  assert.match(html,/admin\.js\?v=diagnostic-evidence-authority-20261013/);
  assert.match(css,/Smart Health Root-Cause Triage/);
  assert.match(css,/\.health-triage-list/);
  assert.match(css,/@media\(max-width:640px\)/);
});
