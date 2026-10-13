'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const storefront=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8').replace(/\r\n/g,'\n');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
const admin=fs.readFileSync(path.join(__dirname,'..','admin','admin.js'),'utf8');

test('storefront search filters name, venue, date and event note and persists q in URL',()=>{
  assert.match(html,/id="event-search"/);
  assert.match(storefront,/var currentSearch = String\(URL_PARAMS\.get\("q"\)/);
  assert.match(storefront,/\[c\.name,c\.venue,c\.date,c\.webNote\]\.join\(" "\)/);
  assert.match(storefront,/u\.searchParams\.set\("q",currentSearch\)/);
  assert.match(storefront,/search_results/);
});

test('storefront keeps search controls iOS-safe to prevent persistent focus zoom',()=>{
  assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(style,/\.event-search\{[^}]*font-size:16px/);
  assert.match(style,/@media\(max-width:600px\)\{[\s\S]*?\.event-search\{[^}]*font-size:16px/);
  assert.match(style,/@media\(max-width:768px\)\{\.month-select\{font-size:16px/);
  assert.match(style,/-webkit-text-size-adjust:100%/);
});

test('event modal URL updates preserve active browse state instead of rebuilding from home',()=>{
  assert.match(storefront,/var u=new URL\(window\.location\.href\);\n    u\.searchParams\.delete\("e"\);\n    u\.searchParams\.set\("event"/);
  assert.match(storefront,/u\.searchParams\.delete\("event"\);\n    u\.searchParams\.delete\("e"\)/);
});

test('storefront package and FAQ dialogs manage initial focus, tab trap and focus return',()=>{
  assert.match(storefront,/var packageFocusReturn=null/);
  assert.match(storefront,/var faqFocusReturn=null/);
  assert.match(storefront,/focusDialog\(el,"#modal-x-btn"\)/);
  assert.match(storefront,/focusDialog\(el,"#faq-x-btn"\)/);
  assert.match(storefront,/if\(e\.key==="Tab"\)/);
  assert.match(storefront,/restoreFocus\(packageFocusReturn\)/);
  assert.match(storefront,/restoreFocus\(faqFocusReturn\)/);
});

test('event name lint catches display-quality mistakes without treating apostrophes as quote pairs',()=>{
  const start=admin.indexOf('function eventNameLint(value)');
  const end=admin.indexOf('function confirmEventNameLint(value)');
  assert.ok(start>=0&&end>start);
  const code=admin.slice(start,end)+'\nglobalThis.eventNameLint=eventNameLint;';
  const context={};
  vm.createContext(context);
  vm.runInContext(code,context);
  assert.deepEqual(Array.from(context.eventNameLint("DON'T BE TOO EMOTIONAL")),[]);
  assert.ok(context.eventNameLint('PROXIE Fan Gathering “รวมพลคนขี้แง').some(x=>/คำพูด/.test(x)));
  assert.ok(context.eventNameLint('Event (Bangkok').some(x=>/วงเล็บ/.test(x)));
  assert.ok(context.eventNameLint('Event  Name').some(x=>/ช่องว่าง/.test(x)));
});

test('create and update Event flows require lint acknowledgement before API write',()=>{
  assert.match(admin,/if\(!confirmEventNameLint\(p\.event_name\)\) return/);
  assert.match(admin,/if\(p\.event_name && !confirmEventNameLint\(p\.event_name\)\) return/);
});

test('System Guard renders dedicated storefront integrity rows',()=>{
  for(const label of [
    'Storefront · Package identity',
    'Storefront · Event/package mapping',
    'Storefront · Availability',
    'Storefront · Published event quality',
    'Storefront · Venue canonicalization'
  ]) assert.ok(admin.includes(label),label);
  assert.match(admin,/rows\.push\(\.\.\.storefrontGuardRows\(h\.storefront_integrity\)\)/);
  assert.match(admin,/snap&&snap\.storefront_integrity/);
});
