'use strict';

const R=require('../server/kk-ultra-deep-production-runtime.js');

function baseSnapshot(){
 return {
  events:[],
  web_ready:[],
  web_packages:[],
  packages:[{template_id:'TPL-VIVO-X300-PRO-PHONE',package_type:'phone_only',standard_price:790,active:true}],
  assets:[
   {asset_id:'PHONE-1',asset_type:'phone',status:'available'},
   {asset_id:'PHONE-2',asset_type:'phone',status:'available'}
  ],
  bookings:[],
  visibility_locks:[]
 };
}

function run(){
 const checks=[];

 {
  const s=baseSnapshot();
  s.events=[{event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-11-01',venue:'Old Hall',poster_url:'https://img/old.jpg',active_on_web:false}];
  s.web_ready=[{event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-11-01',venue:'Old Hall',poster_image_url:'https://img/old.jpg',action_for_web:'hide'}];
  s.visibility_locks=[{event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-11-01',venue:'Old Hall',lock_state:'LOCKED',lock_reason:'OWNER_DO_NOT_AUTO_REOPEN',explicit_reopen_required:true}];
  const out=R.reconcileCandidates([{event_key:'HID-NEW-DATE',title:'Hidden Fan Meeting',event_date:'2026-11-20',venue:'New Hall',official_poster_url:'https://img/new.jpg',source_url:'https://official.example/event'}],s);
  const d=out.dispositions[0]||{};
  checks.push({
   name:'LOCKED_RESCHEDULE_REMAINS_SUPPRESSED',
   pass:out.safe_candidates.length===0&&d.status==='SKIPPED_EVENT_HISTORY'&&d.history_match_kind==='LOCKED_NAME_DATE_DRIFT'&&d.suppression_preserved===true&&d.material_update_detected===true&&JSON.stringify((d.observed_changes||[]).map(x=>x.field))===JSON.stringify(['event_date','venue','poster_url']),
   disposition:d
  });
 }

 {
  const s=baseSnapshot();
  s.events=[{event_id:'EVT-EX',event_name:'Existing Concert',event_date:'2026-11-15',venue:'IMPACT Arena',poster_url:'https://img/ex.jpg',active_on_web:true}];
  s.web_ready=[{event_id:'EVT-EX',event_name:'Existing Concert',event_date:'2026-11-15',venue:'IMPACT Arena',poster_image_url:'https://img/ex.jpg',action_for_web:'show'}];
  s.visibility_locks=[{event_id:'EVT-EX',event_name:'Existing Concert',event_date:'2026-11-15',venue:'IMPACT Arena',lock_state:'SEEN_CORE'}];
  s.bookings=[
   {booking_id:'F1',event_date:'2026-11-15',booking_status:'confirmed'},
   {booking_id:'F2',event_date:'2026-11-15',booking_status:'pending'}
  ];
  const out=R.reconcileCandidates([{event_key:'EX',title:'Existing Concert',event_date:'2026-11-15',venue:'IMPACT Arena',poster_url:'https://img/ex-new.jpg'}],s);
  const d=out.dispositions[0]||{};
  checks.push({
   name:'SEEN_CORE_EXISTING_METADATA_REMAINS_RECONCILABLE_WHEN_FULL',
   pass:out.safe_candidates.length===1&&out.safe_candidates[0].existing_event_id==='EVT-EX'&&d.status==='SAFE_EXISTING'&&d.history_state==='SEEN_CORE',
   disposition:d
  });
 }

 {
  const s=baseSnapshot();
  s.visibility_locks=[{event_id:'EVT-OLD',event_name:'Annual Fan Meeting',event_date:'2026-01-10',venue:'Hall A',lock_state:'LOCKED',explicit_reopen_required:true}];
  const out=R.reconcileCandidates([{event_key:'ANNUAL-NEW',title:'Annual Fan Meeting',event_date:'2027-01-10',venue:'Hall A'}],s);
  const d=out.dispositions[0]||{};
  checks.push({
   name:'DISTANT_ANNUAL_EVENT_NOT_FALSELY_TOMBSTONED',
   pass:d.status==='SAFE_NEW'&&out.safe_candidates.length===1,
   disposition:d
  });
 }

 {
  const s=baseSnapshot();
  s.visibility_locks=[{event_id:'EVT-HIST',event_name:'Historical Concert',event_date:'2026-11-28',venue:'BITEC',lock_state:'SEEN_CORE'}];
  const out=R.reconcileCandidates([{event_key:'HISTORY',title:'Historical Concert',event_date:'2026-11-28',venue:'BITEC'}],s);
  const d=out.dispositions[0]||{};
  checks.push({
   name:'SEEN_CORE_WITHOUT_CURRENT_CORE_STILL_BLOCKS_RECREATE',
   pass:out.safe_candidates.length===0&&d.status==='SKIPPED_EVENT_HISTORY'&&d.history_state==='SEEN_CORE',
   disposition:d
  });
 }

 return {ok:checks.every(x=>x.pass),version:R.VERSION,checks};
}

module.exports=(req,res)=>{
 if(process.env.VERCEL_ENV!=='preview'){
  res.statusCode=404;
  return res.end('not found');
 }
 const result=run();
 res.statusCode=result.ok?200:500;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','no-store');
 res.end(JSON.stringify(result,null,2));
};
