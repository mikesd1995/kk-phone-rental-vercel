'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const logic=fs.readFileSync(path.join(root,'assets/kk-booking-agreement.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/kk-booking-agreement.css'),'utf8');

test('booking acknowledgement is opt-in, visible at checkout and independent of PDPA marketing consent',()=>{
  assert.match(html, /id="kk-booking-agreement" hidden/);
  assert.match(html, /id="kk-booking-terms-check" type="checkbox" autocomplete="off" required/);
  assert.doesNotMatch(html, /id="kk-booking-terms-check"[^>]*checked/);
  assert.match(html, /id="kk-booking-terms-continue"[^>]*disabled/);
  assert.match(html, /<a href="\/terms\/" target="_blank" rel="noopener">เงื่อนไขการใช้บริการ<\/a>/);
  assert.match(html, /<a href="\/privacy\/" target="_blank" rel="noopener">นโยบายความเป็นส่วนตัว<\/a>/);
  assert.match(html, /ลูกค้าต้องตรวจสอบและกดส่งเอง/);
  assert.match(html, /คิวยังไม่สำเร็จจนกว่าร้านยืนยัน/);
  assert.match(html, /ฉบับ 6 พ.ย. 2569/);
  assert.match(html, /src="\/assets\/kk-booking-agreement.js\?v=terms-cookie-20261111" defer/);
  assert.match(html, /href="\/assets\/kk-booking-agreement.css"/);
  assert.doesNotMatch(html, /ยินยอม(?:การตลาด|ให้ใช้ข้อมูลส่วนบุคคลทุก)/);
});

test('existing package, waitlist and sticky booking URLs are retained, but client enforces gate',()=>{
  const js=fs.readFileSync(path.join(root,'script.js'),'utf8');
  assert.match(js, /bookBtn.href=getBookingUrl\(c,p\)/);
  assert.match(js, /waitBtn.href=getWaitlistUrl\(c,null\)/);
  assert.match(logic, /a\.book-pill, a\.waitlist-line-btn, a\.sticky-line, a\.line-btn/);
  assert.match(logic, /event\.preventDefault\(\);[\s\S]*?event\.stopImmediatePropagation\(\);[\s\S]*?openAgreement\(link\)/);
  assert.match(logic, /confirm\.disabled = !check\.checked/);
  assert.match(logic, /if \(!check\.checked \|\| confirm\.disabled \|\| !pending/);
  assert.match(logic, /approved = link/);
  assert.match(logic, /try \{ link\.click\(\); \}/);
  assert.match(logic, /check\.checked = false/);
  assert.match(logic, /window\.localStorage\.getItem\(promptKey\)/);
  assert.match(logic, /window\.localStorage\.setItem\(promptKey, termsVersion\)/);
  assert.match(logic, /if \(approved === link \|\| hasSeenCurrentTermsPrompt\(\)\) return/);
  assert.match(logic, /document\.cookie/);
  assert.match(logic, /SameSite=Lax; Secure/);
  assert.match(logic, /Max-Age=/);
  assert.doesNotMatch(logic, /sessionStorage|fetch\(|sendBeacon|XMLHttpRequest/i);
  assert.doesNotMatch(logic, /customer_id|line_user_id|phone_number|marketing_consent|termsAccepted=true/i);
});

test('footer focuses on customer contact and clear legal links without admin implementation notes',()=>{
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
