'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

test('external Scanner dispatch stays witness-only and isolated from HF staging', () => {
  const source = fs.readFileSync(path.join(root, 'api/kk-scanner-dispatch.js'), 'utf8');

  assert.equal(source.includes('hf-scanner-adapter'), false);
  assert.equal(source.includes('hf-event-assist'), false);
  assert.match(source, /KK_EXTERNAL_SCANNER_MODE/);
  assert.match(source, /['"]witness['"]/);
  assert.match(source, /scanner_execution_started\s*:\s*false/);
  assert.match(source, /business_writes\s*:\s*0/);
});

test('HF adapter is not imported by production api/admin entrypoints', () => {
  const files = [];
  for (const top of ['api', 'admin']) {
    const start = path.join(root, top);
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
      }
    };
    walk(start);
  }

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      source.includes('hf-scanner-adapter'),
      false,
      `production entrypoint imports staged HF adapter: ${path.relative(root, file)}`
    );
  }
});

test('HF feature gate remains disabled when not explicitly enabled', () => {
  const HF = require('../server/hf-event-assist.js');
  assert.equal(HF.isEnabled({}), false);
  assert.equal(HF.isEnabled({HF_EVENT_ASSIST_ENABLED:'false'}), false);
});
