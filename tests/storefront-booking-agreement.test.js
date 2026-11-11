'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const logic=fs.readFileSync(path.join(root,'assets/kk-booking-agreement.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/kk-booking-agreement.css'),'utf8');
const js=fs.readFileSync(path.join(root,'script.js'),'utf8');

test('first-visit Terms prompt has an unchecked explicit confirmation and does not auto-open LINE',()=>{
  assert.match(html,/id="kk-booking-agreement" hidden/);
  assert.match(html,/id="kk-booking-terms-check" type="checkbox" autocomplete="off" required/);
  assert.doesNotMatch(html,/id="kk-booking-terms-check"[^>]*checked/);
  assert.match(html,/id="kk-booking-terms-continue"[^>]*disabled>ยืนยันและเลือกงาน/);
  assert.doesNotMatch(html,/id="kk-booking-terms-cancel"/);
  assert.match(html,/<a href="\/terms\/" target="_blank" rel="noopener">เงื่อนไขการใช้บริการ<\/a>/);
  assert.match(html,/<a href="\/privacy\/" target="_blank" rel="noopener">นโยบายความเป็นส่วนตัว<\/a>/);
  assert.match(html,/จำการกดยืนยันสำหรับเบราว์เซอร์/);
  assert.match(html,/script\.js\?v=first-visit-terms-20261111/);
  assert.match(html,/kk-booking-agreement\.js\?v=first-visit-terms-20261111/);
  assert.doesNotMatch(html,/ยินยอม(?:การตลาด|ให้ใช้ข้อมูลส่วนบุคคลทุก)/);
});

test('LINE booking and waitlist links preserve existing business data but no longer carry legal boilerplate',()=>{
  assert.match(js,/bookBtn.href=getBookingUrl\(c,p\)/);
  assert.match(js,/waitBtn.href=getWaitlistUrl\(c,null\)/);
  const booking=js.slice(js.indexOf('function buildBookingMsg'),js.indexOf('function getBookingUrl'));
  const waitlist=js.slice(js.indexOf('function buildWaitlistMsg'),js.indexOf('function getWaitlistUrl'));
  for(const src of [booking,waitlist]){
    assert.doesNotMatch(src,/ยืนยันยอมรับเงื่อนไข|รับทราบนโยบายความเป็นส่วนตัว|KK-TERMS-2026-11-06/);
    assert.match(src,/tr\("line_event"\)/);
    assert.match(src,/tr\("line_date"\)/);
    assert.match(src,/tr\("line_venue"\)/);
  }
  assert.match(logic,/openAgreement\(\);/);
  assert.match(logic,/confirm\.disabled = !check\.checked/);
  assert.match(logic,/window\.localStorage\.getItem\(promptKey\)/);
  assert.match(logic,/window\.localStorage\.setItem\(promptKey, termsVersion\)/);
  assert.match(logic,/document\.cookie/);
  assert.match(logic,/SameSite=Lax; Secure/);
  assert.match(logic,/Max-Age=/);
  assert.doesNotMatch(logic,/link\.click\(\)/);
  assert.doesNotMatch(logic,/sessionStorage|fetch\(|sendBeacon|XMLHttpRequest/i);
  assert.doesNotMatch(logic,/customer_id|line_user_id|phone_number|marketing_consent|termsAccepted=true/i);
});

test('footer retains public legal and booking links and modal remains responsive',()=>{
  const footer=html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1]||'';
  for(const href of ['/privacy/','/terms/','#booking-journey','https://line.me/R/ti/p/%40827blnmo']){
    assert.ok(footer.includes('href="'+href+'"'),'missing '+href);
  }
  assert.doesNotMatch(footer,/Google Sheets|Apps Script|Supabase|Telegram|private_key/i);
  assert.match(footer,/class="kk-footer-main"/);
  assert.match(css,/\.kk-booking-agreement-backdrop\[hidden\]/);
  assert.match(css,/\.kk-booking-terms-continue:disabled/);
  assert.match(css,/\.kk-public-footer/);
});
