'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../server/kk-ultra-deep-known-miss-regression.js');
const Runtime=require('../server/kk-ultra-deep-runtime-runner.js');
const Production=require('../server/kk-ultra-deep-production-runtime.js');
const Learning=require('../server/kk-ultra-deep-learning-loop.js');
const baiLu=K.CORPUS.find(row=>row.case_id==='bai-lu-meet-love-20261025');
const gongTitle='GONG YOO THE LONG TAKE Bangkok Fan Meeting 2026';
const gongSource='https://www.thailandexhibition.com/en/thai-event-details/2026-gong-yoo-asia-fanmeeting-tour-the-long-take-/33922';
// Its date is unknown in sealed discovery. Any same-day value below is a
// SYNTHETIC_ADVERSARIAL_DATE_COLLISION, never a live observation or repair.
const syntheticWrongArtist=()=>({title:gongTitle,event_date:baiLu.event_date,source_url:gongSource});

test('actual undated different artist is not the Bai Lu known-miss identity',()=>{
 assert.equal(K.sameCase({title:gongTitle,event_date:null,source_url:gongSource},baiLu),false);
 assert.equal(K.fuzzyAliasMatch('GONG YOO THE LONG TAKE Bangkok Fan Meeting 2026','bailu fan meeting bangkok'),false);
});
test('another actual official Gong Yoo title spelling remains a different identity',()=>{
 assert.equal(K.sameCase({title:'2026 Gong Yoo Asia Fanmeeting Tour "The Long Take" in Bangkok',event_date:null},baiLu),false);
});
test('generic reverse alias containment cannot supply a missing artist',()=>{
 assert.equal(K.fuzzyAliasMatch('fan meeting bangkok','bailu fan meeting bangkok'),false);
});
test('an alias made only of format location date and ordinal words has no identity',()=>{
 for(const alias of ['fan meeting bangkok','2026 25 October 1st Fanmeeting Bangkok','special official concert tour']){
  assert.equal(K.fuzzyAliasMatch(alias,alias),false,alias);
 }
});
test('partial whole-word performer prefix cannot match forward alias containment',()=>{
 for(const title of ['notbailu fan meeting bangkok','bailunot fan meeting bangkok','not bailunot fan meeting bangkok']){
  assert.equal(K.fuzzyAliasMatch(title,'bailu fan meeting bangkok'),false,title);
 }
});
test('short name identity remains required despite three generic format words',()=>{
 assert.equal(K.fuzzyAliasMatch('Bai official fanmeeting Bangkok','bai lu special fanmeeting'),false);
 assert.equal(K.fuzzyAliasMatch('Special Fanmeeting Bangkok','lu special fanmeeting bangkok'),false);
});
test('genuine adjacent split and joined names match in either direction',()=>{
 for(const [title,alias] of [
  ['BAILU special fanmeeting Bangkok','bai lu special fanmeeting'],
  ['Bai Lu fan meeting Bangkok','bailu fan meeting bangkok'],
  ['Tutor Yim FANMEETING','tutoryim'],
  ['TutorYim FANMEETING','tutor yim']
 ])assert.equal(K.fuzzyAliasMatch(title,alias),true,title+' / '+alias);
});
test('joined identity cannot be formed by reversing or skipping title words',()=>{
 for(const title of ['Lu Bai fan meeting Bangkok','Bai other Lu fan meeting Bangkok','notbai Lu fan meeting Bangkok']){
  assert.equal(K.fuzzyAliasMatch(title,'bailu fan meeting bangkok'),false,title);
 }
 assert.equal(K.fuzzyAliasMatch('Firstone other Tle fanmeeting','tlefirstone'),false);
});
test('joined alias identity cannot be found inside another longer performer token',()=>{
 assert.equal(K.fuzzyAliasMatch('notTutorYim concert','tutor yim'),false);
 assert.equal(K.fuzzyAliasMatch('FORTTREASUREx concert','forttreasure concert'),false);
});
test('joining a generic format or article onto a name cannot supply whole-word identity',()=>{
 assert.equal(K.fuzzyAliasMatch('BailuFan meeting Bangkok','bailu fan meeting bangkok'),false);
 assert.equal(K.fuzzyAliasMatch('TheBailu special fanmeeting','the bailu special fanmeeting'),false);
 assert.equal(K.fuzzyAliasMatch('Bai fan Lu meeting Bangkok','bailu fan meeting bangkok'),false);
});
test('NCT numeric group identity cannot be changed or omitted',()=>{
 for(const title of ['NCT 128 REDLINE Bangkok','NCT DREAM REDLINE TOUR Bangkok','NCT REDLINE TOUR Bangkok']){
  assert.equal(K.fuzzyAliasMatch(title,'nct 127 redline bangkok'),false,title);
 }
 for(const title of ['NCT127 REDLINE Bangkok','NCT 127 REDLINE Bangkok']){
  assert.equal(K.fuzzyAliasMatch(title,'nct 127 redline bangkok'),true,title);
  assert.equal(K.fuzzyAliasMatch(title,'nct127 redline bangkok'),true,title);
 }
});
test('numeric prefix in 0WAVE is identity rather than a removable day marker',()=>{
 assert.equal(K.fuzzyAliasMatch('0WAVE LIVE IN BANGKOK 2026','0wave live bangkok 2026'),true);
 assert.equal(K.fuzzyAliasMatch('WAVE LIVE IN BANGKOK 2026','0wave live bangkok 2026'),false);
 assert.equal(K.fuzzyAliasMatch('not0wave LIVE IN BANGKOK 2026','0wave live bangkok 2026'),false);
});
test('synthetic matching-date wrong artist cannot receive strict live recall credit',()=>{
 const out=K.evaluate([syntheticWrongArtist()],[],{month:'2026-10',strict_live:true});
 assert.ok(out.missing_cases.includes(baiLu.case_id));
 assert.equal(out.results.find(row=>row.case_id===baiLu.case_id).proof,'MISSING');
 assert.equal(out.production_writes,0);
});
test('genuine identity retains strict live unknown wrong date and missing source gates',()=>{
 for(const candidate of [
  {title:baiLu.title,event_date:null,source_url:'https://example.com/official'},
  {title:baiLu.title,event_date:'2026-10-24',source_url:'https://example.com/official'},
  {title:baiLu.title,event_date:baiLu.event_date,source_url:null}
 ])assert.ok(K.evaluate([candidate],[],{month:'2026-10',strict_live:true}).missing_cases.includes(baiLu.case_id));
 const out=K.evaluate([{title:baiLu.title,event_date:baiLu.event_date,source_url:'https://example.com/official'}],[],{month:'2026-10',strict_live:true});
 assert.ok(!out.missing_cases.includes(baiLu.case_id));
});
test('known-miss reference alignment keeps Bai Lu when only synthetic same-day Gong Yoo is discovered',()=>{
 const reference={title:'Bai Lu fan meeting Bangkok',event_date:baiLu.event_date,source_url:'https://example.com/bailu'};
 assert.deepEqual(Runtime.alignKnownMissReferences([syntheticWrongArtist()],[reference]),[reference]);
});
test('production known-miss dedup does not merge different synthetic same-day artists',()=>{
 assert.equal(Production.sameKnownMiss(syntheticWrongArtist(),{title:baiLu.title,event_date:baiLu.event_date}),false);
});
test('learning does not suppress a different verified identity because of a synthetic date collision',()=>{
 const out=Learning.learnKnownMiss({...syntheticWrongArtist(),verified_event:true,was_missed:true,
  aliases:['gong yoo the long take'],search_queries:['Gong Yoo The Long Take Bangkok']});
 assert.equal(out.status,'PROPOSED_REGRESSION_CASE');
 assert.ok(!out.blockers.includes('KNOWN_MISS_ALREADY_COVERED'));
 assert.equal(out.authority.production_writes,0);assert.equal(out.authority.auto_apply,false);
});
test('existing Thai punctuated and observed Bai Lu alias forms retain identity compatibility',()=>{
 for(const [title,alias] of [
  ['ปล่อยปลาฉลาม Meet TutorYim updated date','ปล่อยปลาฉลาม'],
  ['FORTREASURE : BEYOND THE HORIZON CONCERT','fortreasure concert'],
  ['blue on X: "#bailu’s 林深时见鹿 personal fan meeting in bangkok"','bailu personal fan meeting bangkok'],
  ['WeSpark_ official | 48H COUNTDOWN for MEET&LOVE BAILU SPECIAL BANGKOK','bailu wespark']
 ])assert.equal(K.fuzzyAliasMatch(title,alias),true,title);
});
test('all forty-one historical fixture identities remain compatible without claiming live recall',()=>{
 for(const row of K.CORPUS){
  const fixture=K.FIXTURE_EVIDENCE[row.case_id]||{};
  assert.equal(K.sameCase({title:fixture.title||row.title,event_date:row.event_date},row),true,row.case_id);
 }
 assert.equal(K.evaluateFixtureRegression().passed,41);
 assert.equal(K.evaluateFixtureRegression().proof_type,'DETERMINISTIC_HISTORICAL_FIXTURE');
});
test('public normalization and token APIs retain their prior behavior',()=>{
 assert.equal(K.norm('Bai-Lu & 127 กรุงเทพ'),'bai lu 127 กรุงเทพ');
 assert.deepEqual(K.tokens('Bai Lu NCT 127 0WAVE 2026'),['bai','nct','127','0wave','2026']);
});
