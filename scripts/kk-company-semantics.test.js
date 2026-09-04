'use strict';
const assert=require('assert');
const {MODE,resolveEventCompany}=require('../lib/kk-company-semantics');

(function thaiUsesAffiliation(){
  const o=resolveEventCompany({performer_origin:'THAI',talent_affiliation:'LOVEiS Entertainment',organizer:'Example Promoter'});
  assert.equal(o.company,'LOVEiS Entertainment');
  assert.equal(o.company_basis,'TALENT_AFFILIATION');
  assert.equal(o.organizer,'Example Promoter');
  assert.equal(o.heuristic_inference_used,false);
})();
(function foreignUsesLocalOrganizer(){
  const o=resolveEventCompany({performer_origin:'FOREIGN',talent_affiliation:'Foreign Artist Label',organizer:'iMe Thailand'});
  assert.equal(o.company,'iMe Thailand');
  assert.equal(o.company_basis,'EVENT_ORGANIZER');
  assert.equal(o.talent_affiliation,'Foreign Artist Label');
})();
(function thaiRequiresAffiliation(){ assert.throws(()=>resolveEventCompany({performer_origin:'THAI',organizer:'Promoter'}),/requires talent_affiliation/); })();
(function foreignRequiresOrganizer(){ assert.throws(()=>resolveEventCompany({performer_origin:'FOREIGN',talent_affiliation:'Label'}),/requires organizer\/promoter/); })();
(function unknownFailsClosed(){ assert.throws(()=>resolveEventCompany({performer_origin:'UNKNOWN',talent_affiliation:'X',organizer:'Y'}),/must be THAI or FOREIGN/); })();
(function modeExact(){ assert.equal(MODE,'THAI_TALENT_AFFILIATION|FOREIGN_EVENT_ORGANIZER'); })();

console.log('kk-company-semantics: 6/6 PASS');
