'use strict';

const crypto=require('node:crypto');

const VERSION='KK_MARKETING_ATTRIBUTION_V1';
const COMPLETED_STATUSES=new Set(['completed']);
const FUTURE_STATUSES=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
const SAFETY=Object.freeze({
  authority:'READ_ONLY_SHADOW',
  human_approval_required:true,
  auto_publish:false,
  auto_spend:false,
  price_writes:false,
  inventory_writes:false,
  machine_sot_writes:false,
  production_writes:0
});

function text(v){return String(v==null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;}
function slug(v){return text(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);}
function campaignId(input={}){
  const eventId=text(input.event_id);
  const eventDate=text(input.event_date);
  const channel=text(input.channel||'x').toLowerCase();
  const objective=text(input.objective||'awareness').toLowerCase();
  if(!eventId||!eventDate) return '';
  const digest=crypto.createHash('sha256').update([eventId,eventDate,channel,objective].join('|')).digest('hex').slice(0,12);
  return ['kk',slug(eventId)||'event',eventDate.replace(/[^0-9]/g,''),channel,digest].join('-');
}

function queueEligibility(input={}){
  const blockers=[];
  if(input.verified_event!==true) blockers.push('EVENT_NOT_VERIFIED');
  if(input.verified_pricing!==true) blockers.push('PRICING_NOT_VERIFIED');
  if(input.storefront_ready!==true) blockers.push('STOREFRONT_NOT_READY');
  if(input.owner_hidden===true||input.tombstoned===true) blockers.push('OWNER_HIDDEN_OR_TOMBSTONED');
  if(input.date_blocked===true) blockers.push('DATE_BLOCKED_BY_OWNER_RULE');
  const phoneAvailable=input.inventory_available===true&&num(input.inventory_remaining)>0;
  const lensOnly=input.lens_inventory_available===true&&!phoneAvailable;
  if(!phoneAvailable&&!lensOnly) blockers.push('NO_RENTABLE_INVENTORY');
  return {
    eligible:blockers.length===0,
    mode:lensOnly?'LENS_ONLY':phoneAvailable?'PHONE_RENTAL':'BLOCKED',
    blockers,
    upstream_authority:'ULTRA_DEEP_VERIFIED_BUSINESS_TRUTH'
  };
}

function buildQueueItem(input={}){
  const eligibility=queueEligibility(input);
  const id=campaignId(input);
  const blockers=[...eligibility.blockers];
  if(!text(input.event_id)) blockers.push('EVENT_ID_REQUIRED');
  if(!text(input.event_date)) blockers.push('EVENT_DATE_REQUIRED');
  if(!id) blockers.push('CAMPAIGN_ID_UNRESOLVED');
  return {
    schema_version:VERSION,
    campaign_id:id,
    event_id:text(input.event_id),
    event:text(input.event||input.name||input.title),
    event_date:text(input.event_date),
    channel:text(input.channel||'x').toLowerCase(),
    objective:text(input.objective||'awareness').toLowerCase(),
    status:blockers.length?'BLOCKED':'READY_FOR_OWNER_REVIEW',
    eligibility:{...eligibility,eligible:blockers.length===0,blockers},
    safety:SAFETY
  };
}

function normalizeTouch(row={}){
  return {
    campaign_id:text(row.campaign_id),
    kind:text(row.kind||row.event_type).toLowerCase(),
    occurred_at:text(row.occurred_at),
    booking_id:text(row.booking_id),
    booking_status:text(row.booking_status||row.status).toLowerCase(),
    revenue_thb:num(row.revenue_thb||row.revenue)
  };
}

function summarizeAttribution(rows=[],options={}){
  const campaign=text(options.campaign_id);
  if(!campaign) return {schema_version:VERSION,status:'BLOCKED_CAMPAIGN_ID_REQUIRED',campaign_id:'',safety:SAFETY};
  const touches=(Array.isArray(rows)?rows:[]).map(normalizeTouch).filter(x=>x.campaign_id===campaign);
  const count=kind=>touches.filter(x=>x.kind===kind).length;
  const bookingTouches=touches.filter(x=>x.kind==='booking'&&x.booking_id);
  const byBooking=new Map();
  for(const row of bookingTouches) byBooking.set(row.booking_id,row);
  const bookings=[...byBooking.values()];
  const completed=bookings.filter(x=>COMPLETED_STATUSES.has(x.booking_status));
  const future=bookings.filter(x=>FUTURE_STATUSES.has(x.booking_status));
  return {
    schema_version:VERSION,
    status:'READY',
    campaign_id:campaign,
    funnel:{
      x_post:count('x_post'),
      storefront_visit:count('storefront_visit'),
      line_conversation:count('line_conversation'),
      bookings:bookings.length,
      completed_bookings:completed.length
    },
    revenue:{
      actual_thb:completed.reduce((s,x)=>s+x.revenue_thb,0),
      future_thb:future.reduce((s,x)=>s+x.revenue_thb,0),
      forecast_thb:completed.reduce((s,x)=>s+x.revenue_thb,0)+future.reduce((s,x)=>s+x.revenue_thb,0)
    },
    conversion:{
      visit_to_line:count('storefront_visit')?count('line_conversation')/count('storefront_visit'):0,
      line_to_booking:count('line_conversation')?bookings.length/count('line_conversation'):0,
      visit_to_booking:count('storefront_visit')?bookings.length/count('storefront_visit'):0
    },
    evidence_rule:'Bookings and revenue count only when an explicit campaign_id and booking_id linkage exists. Never infer attribution from timing alone.',
    safety:SAFETY
  };
}

function learningSummary(campaignSummaries=[],options={}){
  const min=Math.max(3,Number(options.min_campaigns)||3);
  const rows=(Array.isArray(campaignSummaries)?campaignSummaries:[]).filter(x=>x&&x.status==='READY');
  if(rows.length<min) return {
    schema_version:VERSION,
    status:'RULE_BASED_COLD_START',
    measured_campaigns:rows.length,
    minimum_campaigns:min,
    recommendations:[],
    safety:SAFETY
  };
  const ranked=rows.slice().sort((a,b)=>{
    const ar=num(a.revenue&&a.revenue.actual_thb), br=num(b.revenue&&b.revenue.actual_thb);
    if(br!==ar)return br-ar;
    return num(b.conversion&&b.conversion.visit_to_booking)-num(a.conversion&&a.conversion.visit_to_booking);
  });
  return {
    schema_version:VERSION,
    status:'EVIDENCE_AVAILABLE',
    measured_campaigns:rows.length,
    minimum_campaigns:min,
    recommendations:[{
      type:'PRIORITY_NUDGE',
      campaign_id:ranked[0].campaign_id,
      reason:'highest_completed_revenue_then_visit_to_booking',
      authority:'ADVISORY_ONLY'
    }],
    interpretation_rule:'Learning may reprioritize marketing review only. It cannot mutate event truth, price, inventory, visibility, publishing, or Machine SOT.',
    safety:SAFETY
  };
}

module.exports={VERSION,SAFETY,COMPLETED_STATUSES,FUTURE_STATUSES,campaignId,queueEligibility,buildQueueItem,normalizeTouch,summarizeAttribution,learningSummary};
