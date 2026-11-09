'use strict';

// R9 synthetic Preview-only Admin Operations transport fixture.
// Never call Sheets/Bookings/LINE, never enabled on Production. No real identity or event.
const SOURCE='synthetic-preview-fixture-v1';

function enabled(env) {
  const e=env && typeof env==='object' ? env : {};
  const branch=String(e.KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH || '');
  return e.VERCEL_ENV==='preview'
    && e.KK_ADMIN_OPS_PREVIEW_FIXTURE==='1'
    && /^feat\/ops-[a-z0-9-]{5,100}$/.test(branch)
    && e.VERCEL_GIT_COMMIT_REF===branch;
}

function snapshot(now = new Date()) {
  const generated=now instanceof Date && Number.isFinite(now.getTime())
    ? now.toISOString() : new Date().toISOString();
  const readyId='EVT-20261203-PREVIEW-FIXTURE-READY';
  const fullId='EVT-20261205-PREVIEW-FIXTURE-FULL';
  const events=[
    {event_id:readyId,event_name:'SYNTHETIC — Preview Available',event_date:'2026-12-03',
      venue:'Synthetic Test Hall',status:'open',active_on_web:true,poster_url:''},
    {event_id:fullId,event_name:'SYNTHETIC — Preview Phone Sold Out',event_date:'2026-12-05',
      venue:'Synthetic Test Hall',status:'open',active_on_web:true,poster_url:''}
  ];
  const webReady=[
    {event_id:readyId,event_name:events[0].event_name,event_date:'2026-12-03',
      venue:events[0].venue,available_phone_count:1,available_lens_count:1,
      action_for_web:'show',poster_image_url:''},
    {event_id:fullId,event_name:events[1].event_name,event_date:'2026-12-05',
      venue:events[1].venue,available_phone_count:0,available_lens_count:1,
      action_for_web:'show_full',poster_image_url:''}
  ];
  const webPackages=[
    {package_id:'PK-SYNTH-READY-PHONE',event_id:readyId,package_type:'phone_only',
      available_count:1,price:590,package_status:'available'},
    {package_id:'PK-SYNTH-READY-BUNDLE',event_id:readyId,package_type:'phone_lens_bundle',
      available_count:1,price:690,package_status:'available'},
    {package_id:'PK-SYNTH-FULL-PHONE',event_id:fullId,package_type:'phone_only',
      available_count:0,price:790,package_status:'hidden'},
    {package_id:'PK-SYNTH-FULL-BUNDLE',event_id:fullId,package_type:'phone_lens_bundle',
      available_count:0,price:990,package_status:'hidden'}
  ];
  return {ok:true,data:{
    generated_at:generated,snapshot_source:SOURCE,fallback_reader:'synthetic-preview-only',
    events,web_ready:webReady,web_packages:webPackages,
    bookings:[{booking_id:'SYNTHETIC-BOOKING-ID-NOT-REAL',event_id:fullId,
      booking_status:'confirmed',customer_name:'SYNTHETIC_PRIVATE_MARKER_NOT_REAL'}],
    visibility_locks:[
      {event_id:readyId,lock_state:'SEEN_CORE'},
      {event_id:fullId,lock_state:'SEEN_CORE'}
    ]
  }};
}

module.exports={SOURCE,enabled,snapshot};
