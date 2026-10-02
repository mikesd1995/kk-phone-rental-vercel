'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','assets','kk-storefront-v5.css'),'utf8');
test('FAQ is promoted to header and removed from footer CTA',()=>{assert.match(html,/id="faq-open-btn"/);assert.match(html,/id="faqOverlay"/);assert.doesNotMatch(html,/footer-faq-btn/);});
test('theme switch is accessible and persisted',()=>{assert.match(html,/id="theme-toggle"[^>]+aria-pressed="false"/);assert.match(js,/kk_public_theme/);assert.match(js,/bindThemeToggle/);assert.match(js,/data-theme/);});
test('V6.3 includes dark theme and mobile hierarchy rules',()=>{assert.match(css,/html\[data-theme="dark"\],html\[data-theme="dark"\] body/);assert.match(css,/KK Storefront V6\.3/);assert.match(css,/\.header-faq-btn/);assert.match(css,/@media\(max-width:700px\)/);});
