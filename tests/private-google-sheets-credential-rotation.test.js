'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Sheets=require('../api/lib/private-google-sheets.js');

test('OAuth token cache credential fingerprint includes the entire service-account key',()=>{
 const prefix='-----BEGIN PRIVATE KEY-----\\n'+'A'.repeat(130);
 const creds={email:'reader@example.invalid',privateKey:prefix+'KEY_A'};
 const changed={...creds,privateKey:prefix+'KEY_B'};
 assert.notEqual(Sheets.credentialFingerprint(creds),Sheets.credentialFingerprint(changed));
 assert.notEqual(Sheets.credentialFingerprint(creds),Sheets.credentialFingerprint({...creds,email:'another@example.invalid'}));
 assert.equal(Sheets.credentialFingerprint(creds),Sheets.credentialFingerprint({...creds}));
 assert.match(Sheets.credentialFingerprint(creds),/^[0-9a-f]{64}$/);
});
