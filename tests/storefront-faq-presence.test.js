'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','assets','kk-storefront-v5.css'),'utf8');

test('FAQ remains discoverable from both header and footer',()=>{
  assert.match(html,/id="faq-open-btn"/);
  assert.match(html,/class="footer-faq-btn"[^>]*data-open-faq/);
  assert.match(html,/id="faqOverlay"/);
  assert.match(html,/FAQ · คำถามที่พบบ่อย/);
});

test('FAQ runtime keeps open close and accordion bindings',()=>{
  assert.match(js,/faq-open-btn/);
  assert.match(js,/data-open-faq/);
  assert.match(js,/faqOverlay/);
  assert.match(js,/faq-q/);
});

test('FAQ footer affordance is explicitly styled in V5',()=>{
  assert.match(css,/\.footer-faq-btn\s*\{/);
  assert.match(css,/\.footer-faq-btn:focus-visible/);
});
