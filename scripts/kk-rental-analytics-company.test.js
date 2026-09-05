'use strict';
const assert=require('assert');
const {UNKNOWN,resolveCompany,parseNoteFields}=require('../lib/kk-rental-analytics-company');
const rules=[{affiliation:'LOVEiS Entertainment',aliases:['NONT TANONT','นนท์ ธนนท์']},{affiliation:'GMMTV',aliases:['POND PHUWIN','GEMINI FOURTH']},{affiliation:'OTHER',aliases:['NONT']}];
let n=0;function t(name,fn){fn();n++;}
t('explicit Thai affiliation',()=>{const o=resolveCompany({eventName:'X',origin:'THAI',explicitAffiliation:'LOVEiS'});assert.equal(o.company,'LOVEiS');assert.equal(o.semantics,'TALENT_AFFILIATION');});
t('Thai registry unique',()=>{const o=resolveCompany({eventName:'GEMINI FOURTH FANCON',origin:'THAI',registryRules:rules});assert.equal(o.company,'GMMTV');assert.equal(o.source,'artist_registry');});
t('foreign uses local organizer',()=>{const o=resolveCompany({eventName:'BTS WORLD TOUR',origin:'FOREIGN',explicitAffiliation:'BIGHIT',explicitOrganizer:'Live Nation Tero',registryRules:[{affiliation:'BIGHIT',aliases:['BTS']}]});assert.equal(o.company,'Live Nation Tero');assert.equal(o.semantics,'LOCAL_ORGANIZER_PROMOTER');});
t('foreign label not substituted',()=>{const o=resolveCompany({eventName:'BTS WORLD TOUR',origin:'FOREIGN',registryRules:[{affiliation:'BIGHIT',aliases:['BTS']}]});assert.equal(o.company,UNKNOWN);});
t('unknown origin explicit talent allowed',()=>{const o=resolveCompany({eventName:'Event',explicitAffiliation:'Verified Label'});assert.equal(o.company,'Verified Label');assert.equal(o.semantics,'TALENT_AFFILIATION');});
t('unknown origin organizer alone not promoted',()=>{const o=resolveCompany({eventName:'Event',explicitOrganizer:'Organizer Co'});assert.equal(o.company,UNKNOWN);});
t('note talent parsed',()=>{const o=resolveCompany({eventName:'Event',note:'talent_affiliation: Label A; performer_origin=thai'});assert.equal(o.company,'Label A');});
t('note foreign organizer parsed',()=>{const o=resolveCompany({eventName:'Event',note:'performer_origin=foreign; local_organizer: 411 Entertainment'});assert.equal(o.company,'411 Entertainment');});
t('ambiguous registry unknown',()=>{const o=resolveCompany({eventName:'NONT TANONT',registryRules:rules});assert.equal(o.company,UNKNOWN);assert.equal(o.ambiguous,true);});
t('no event-name heuristic',()=>{const o=resolveCompany({eventName:'NCT DREAM CONCERT',registryRules:[]});assert.equal(o.company,UNKNOWN);});
t('alias boundary prevents substring',()=>{const o=resolveCompany({eventName:'NONTSENSE FEST',registryRules:[{affiliation:'X',aliases:['NONT']}]});assert.equal(o.company,UNKNOWN);});
t('Thai text origin parsed',()=>{const o=resolveCompany({eventName:'งาน',note:'performer_origin=ศิลปินไทย; สังกัดศิลปิน=ค่ายทดสอบ'});assert.equal(o.company,'ค่ายทดสอบ');});
t('parse fields stable',()=>{const f=parseNoteFields('performer_origin=foreign | local_promoter: ABC');assert.equal(f.performer_origin,'foreign');assert.equal(f.local_promoter,'ABC');});
console.log(`kk-rental-analytics-company: ${n}/${n} PASS`);
