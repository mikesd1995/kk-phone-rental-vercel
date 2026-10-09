'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const poster=path.join(__dirname,'../assets/event-posters/siam-halloween-2026-nov01-owner-original.webp');
const expectedSha='e9e73bb06b61721b6ddab9bf2ad643e32d47a816627ffae833b13ee13dd5a723';

test('Nov 1 Siam Halloween poster is the preserved full-size owner-supplied raster, never a screenshot substitute',()=>{
 const bytes=fs.readFileSync(poster);
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 assert.equal(bytes.subarray(12,16).toString(),'VP8 ');
 assert.equal(bytes.readUInt16LE(26)&0x3fff,1638);
 assert.equal(bytes.readUInt16LE(28)&0x3fff,2048);
 assert.ok(bytes.length>500000,'lossless provenance: exact media bytes are pinned by checksum; size must be credible');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expectedSha);
});
