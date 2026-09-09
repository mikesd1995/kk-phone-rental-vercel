'use strict';
const assert=require('assert');
const c=require('../lib/kk-owner-notification-contract');
let n=0;const ok=(v,m)=>{assert(v,m);n++;};const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

let p=c.classifyPriceChange({event_key:'e',competitor_key:'a',package_key:'x',price:590},{event_key:'e',competitor_key:'a',package_key:'x',price:550});
ok(p.price_changed&&p.delta===-40,'same event shop package delta is price change');
p=c.classifyPriceChange({event_key:'e',competitor_key:'a',package_key:'x',price:590},{event_key:'e',competitor_key:'b',package_key:'x',price:550});
ok(!p.price_changed&&p.new_market_evidence,'new competitor is market evidence not price change');

let b=c.morningBriefPlan({bangkok_date:'2026-09-07',counts:{new_events:0,new_p0_p1:0,competitor_price_changed:0,ticket_state_changed:0,other_material:0,scan_health:1}});
ok(b.line_required&&b.zero_change&&!b.telegram_detail_required,'zero change still requires one LINE proof and no Telegram details');
eq(b.line_notification_id,'KK-BRIEF-20260907-AM','morning brief id deterministic');
b=c.morningBriefPlan({bangkok_date:'2026-09-07',counts:{new_events:1,new_p0_p1:0,competitor_price_changed:0,ticket_state_changed:0,other_material:0}});ok(b.telegram_detail_required&&!b.zero_change,'verified business change enables Telegram detail');

eq(c.ownerRoute('CANCELLED').critical,true,'cancelled is critical dual route');eq(c.ownerRoute('COMPETITOR_PRICE_CHANGED').critical,false,'routine price change is morning route');

let t=c.providerAckTransition({prior_status:'QUEUED',attempt_count:0,provider_message_id:'194',accepted_at:'2026-09-07T05:00:00+07:00'});eq(t.status,'SENT','provider id plus accepted timestamp permits SENT');eq(t.attempt_count,1,'first provider attempt increments to one');
t=c.providerAckTransition({prior_status:'QUEUED',attempt_count:2,error:'HTTP_500'});eq(t.status,'RETRY_WAIT','provider failure becomes retry wait');eq(t.attempt_count,3,'retry attempt increments instead of reset');
t=c.providerAckTransition({prior_status:'QUEUED',attempt_count:0});eq(t.status,'RETRY_WAIT','missing provider ack never becomes SENT');

let d=c.telegramConsumerDesignAudit({ledger_only:true,queued_only:true,provider_id_on_sent:true,failure_updates_retry_wait:true,attempt_count_increments:true});ok(d.pass,'complete consumer design passes');
d=c.telegramConsumerDesignAudit({ledger_only:true,queued_only:true,provider_id_on_sent:true,failure_updates_retry_wait:false,attempt_count_increments:false});ok(!d.pass&&d.reasons.includes('NO_FAILURE_TO_RETRY_WAIT_PATH')&&d.reasons.includes('ATTEMPT_COUNT_NOT_INCREMENTAL'),'missing retry path and hard reset attempt are defects');

console.log(`kk-owner-notification-contract: ${n}/${n} PASS`);
