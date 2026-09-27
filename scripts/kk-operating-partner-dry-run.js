#!/usr/bin/env node
'use strict';

const Partner=require('../server/kk-operating-partner.js');

const input={
  opportunities:[
    {
      opportunity_id:'opp_event_a',
      type:'event_rental',
      subject_ref:'EVT-DEMO-A',
      title:'Demo Event A',
      evidence_confidence:88,
      signals:{demand_signal:92,competition_gap:78,margin_signal:80,inventory_fit:90,timing_urgency:82,content_reach:88}
    },
    {
      opportunity_id:'opp_content_b',
      type:'content_reach',
      subject_ref:'EVT-DEMO-B',
      title:'Seat View Demo B',
      evidence_confidence:80,
      signals:{demand_signal:76,competition_gap:60,timing_urgency:72,content_reach:95}
    }
  ],
  customer_actions:[{action_id:'cust_cohort_followup',title:'Follow up incomplete booking cohort',recommended_action:'PREPARE_CUSTOMER_FOLLOWUP',priority_score:76}],
  system_signals:[{action_id:'sys_health',title:'Review recurring admin warning',recommended_action:'RUN_RELIABILITY_REVIEW',severity:'P2'}],
  decision_history:[
    {decision_id:'dec_demo_0001',event_type:'RECOMMENDATION',decision_type:'content',recommendation_code:'SEAT_VIEW',confidence:85},
    {decision_id:'dec_demo_0001',event_type:'OWNER_DECISION',decision_type:'content',owner_action:'APPROVED'},
    {decision_id:'dec_demo_0001',event_type:'OUTCOME',decision_type:'content',outcome_score:82}
  ]
};
console.log(JSON.stringify(Partner.buildDailyBrief(input),null,2));
