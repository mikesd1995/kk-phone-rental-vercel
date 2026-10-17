'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Check = require('../scripts/kk-rea-stylesheet-safety.cjs');

const VALID = '<link rel="stylesheet" href="style.css?v=1"><link href="/assets/kk-storefront-v5.css?v=2" rel="stylesheet">';
test('recognizes the two KK stylesheets in their exact source order', () => {
  const report = Check.inspect(VALID);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.active_screen_stylesheets, ['style.css', '/assets/kk-storefront-v5.css']);
});
test('blocked if primary stylesheet is missing, repeated or misordered', () => {
  for (const html of ['', '<link rel="stylesheet" href="style.css">', VALID + '<link rel="stylesheet" href="style.css">', VALID.split('><').reverse().join('><')]) {
    assert.equal(Check.inspect(html).status, 'BLOCKED');
  }
});
test('alternate, disabled and print-only stylesheets do not prove effective screen styles', () => {
  for (const marker of ['rel="alternate stylesheet"', 'rel="stylesheet" disabled', 'rel="stylesheet" media="print"', 'rel="stylesheet" media="(max-width: 100px)"', 'rel="stylesheet" media="screen and (max-width: 1px)"']) {
    const html = '<link rel="stylesheet" href="style.css"><link href="/assets/kk-storefront-v5.css" ' + marker + '>';
    assert.equal(Check.inspect(html).status, 'BLOCKED', marker);
  }
});
test('handles upper/lower case, comments, rel order and query/hash in href', () => {
  const html = '<!-- ' + VALID + ' --><LINK HREF="/style.css?x=1#i" REL="StyleSheet"><link media="screen" href="/assets/kk-storefront-v5.css?v=2" rel="stylesheet">';
  assert.equal(Check.inspect(html).status, 'PASS');
});
test('preload and remote lookalike links cannot satisfy contract', () => {
  const html = '<link rel="preload" as="style" href="style.css"><link rel="stylesheet" href="https://evil.example/assets/kk-storefront-v5.css">';
  assert.equal(Check.inspect(html).status, 'BLOCKED');
});
