'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const Round=require('../server/make-owner-real-acceptance');
const manifest=()=>({version:'kk-owner-real-acceptance-round-v1',round_id:'11111111-1111-4111-8111-111111111111',source_sha:'a'.repeat(40),environment:'production',cutover_id:'22222222-2222-4222-8222-222222222222',activated_at:'2026-10-29T08:00:00.000Z',not_before:'2026-10-29T08:00:00.000Z',slot_id:'1',due_at:'2026-10-29T08:15:00.000Z',expires_at:'2026-10-29T08:17:00.000Z',attempt_budget:{TELEGRAM_OWNER_ALERTS:1,LINE_OWNER_ALERTS:1},provider_binding_sha256:'b'.repeat(64)});
const source=()=>({'Notification ID':'N_REAL_VECTOR_1','Created At':'2026-10-29T08:01:00.000Z','Event Family ID':'EVENT_1','Show ID':'SHOW_1','Change Type':'NEW_EVENT',Priority:'NORMAL','Quiet Hours Policy':'NORMAL',Payload:'ข้อความทดสอบเฉพาะหน่วย ไม่ส่งจริง','Audit Event ID':'AUDIT_1',Transport:'TELEGRAM_OWNER_ALERTS','Dedup Key':'DEDUP_TG_1'});
function gas(){
 const context=vm.createContext({Date,Utilities:{Charset:{UTF_8:'UTF_8'},DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_algorithm,s)=>Array.from(crypto.createHash('sha256').update(s,'utf8').digest()),newBlob:s=>({getBytes:()=>Array.from(Buffer.from(s))})}});
 for(const name of ['Code.gs','OwnerRealAcceptance.gs'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/kk-agent',name),'utf8'),context);
 return context;
}
test('GAS and gateway share fixed UTF8 manifest/source/claim UUID vectors without changing native schemas',()=>{
 const g=gas(),m=manifest(),r=source(),expectedDigest='f9c40a427f2c4e1e66a756974e467066047c799f576dd9d4d62758ade68c95ce',expectedSource='fb1a30b251486bc657e931582a389f7ab54945859065c62efcb4dad53a5ed531',expectedClaim='CLAIM|bb8fe257-66b7-5d53-a267-58121fb98e26';
 assert.equal(Round.digest(m),expectedDigest);assert.equal(g.realAcceptanceDigest_(m),expectedDigest);
 assert.equal(Round.immutableSourceHash(r),expectedSource);assert.equal(g.realAcceptanceSourceHash_(r),expectedSource);
 assert.equal(Round.claimId(m,r.Transport,expectedSource),expectedClaim);assert.equal(g.realAcceptanceClaimId_(expectedDigest,r.Transport,expectedSource),expectedClaim);
});
test('manifest digest is independent of object key order but binds both channel budgets',()=>{
 const g=gas(),m=manifest(),reverse=Object.fromEntries(Object.entries(m).reverse());
 assert.equal(g.realAcceptanceDigest_(reverse),Round.digest(m));
 for(const channel of ['TELEGRAM_OWNER_ALERTS','LINE_OWNER_ALERTS']){const bad=structuredClone(m);bad.attempt_budget[channel]=2;assert.throws(()=>Round.digest(bad));assert.throws(()=>g.realAcceptanceDigest_(bad));}
});
test('source identity hashing preserves whitespace and normalizes valid Date cells exactly',()=>{
 const g=gas(),r=source(),dated={...r,'Created At':new Date(r['Created At'])};
 assert.equal(g.realAcceptanceSourceHash_(dated),Round.immutableSourceHash(r));assert.equal(Round.immutableSourceHash(dated),Round.immutableSourceHash(r));
 const changed={...r,Payload:' '+r.Payload};assert.notEqual(Round.immutableSourceHash(changed),Round.immutableSourceHash(r));assert.equal(g.realAcceptanceSourceHash_(changed),Round.immutableSourceHash(changed));
});
test('claim binding changes for a different round, channel, source or approved source SHA',()=>{
 const g=gas(),m=manifest(),s=Round.immutableSourceHash(source()),base=Round.claimId(m,'TELEGRAM_OWNER_ALERTS',s);
 const variants=[[{...m,round_id:'33333333-3333-4333-8333-333333333333'},'TELEGRAM_OWNER_ALERTS',s],[m,'LINE_OWNER_ALERTS',s],[m,'TELEGRAM_OWNER_ALERTS','c'.repeat(64)],[{...m,source_sha:'d'.repeat(40)},'TELEGRAM_OWNER_ALERTS',s]];
 for(const [round,channel,hash] of variants){const id=Round.claimId(round,channel,hash);assert.notEqual(id,base);assert.equal(g.realAcceptanceClaimId_(Round.digest(round),channel,hash),id);}
});
