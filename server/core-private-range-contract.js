'use strict';

// Preparation contract, not a new reader or a public projection allowlist.
// A parity test binds these exact pairs to the existing Apps Script allowlist.
const PUBLIC_EVENTS=Object.freeze(['event_id','event_name','event_date_text','venue','poster_image_url','event_note','available_phone_count','available_lens_count','booking_status_for_web','action_for_web','line_message_template']);
const PUBLIC_PACKAGES=Object.freeze(['package_id','event_id','package_type','model_group','model_display','lens_group','lens_display','price','available_count','package_status','sort_order','web_note','raw_available_count','use_case']);
function spec(dataset,sheet,range,header,width,consumers,orderedHeaders){
  return Object.freeze({dataset,sheet,range,header,width,
    consumers:Object.freeze(consumers),
    ...(orderedHeaders?{orderedHeaders:Object.freeze(orderedHeaders)}:{})});
}
const RANGE_SPECS=Object.freeze([
  spec('events','01_Events','A4:I','event_id',9,['admin_snapshot']),
  spec('events_analytics','01_Events','A4:Z','event_id',26,['rental_analytics']),
  spec('bookings','00_Master_Booking','A4:X','booking_id',24,['admin_snapshot','canonical_quote_gated']),
  spec('assets','02_Assets','A4:G','asset_id',7,['admin_snapshot']),
  spec('packages','03_Packages','A4:J','template_id',10,['admin_snapshot']),
  spec('overrides','04_Event_Overrides','A4:G','event_id',7,['admin_snapshot']),
  spec('web_ready','08_Web_Ready','A4:K','event_id',11,['admin_snapshot','public_events_projection'],PUBLIC_EVENTS.slice()),
  spec('web_ready_lean','08_Web_Ready','A4:J500','event_id',10,['admin_guard'],PUBLIC_EVENTS.slice(0,10)),
  spec('web_packages','09_Web_Packages','A4:N','package_id',14,['admin_snapshot','public_packages_projection'],PUBLIC_PACKAGES.slice()),
  spec('web_packages_m','09_Web_Packages','A4:M','package_id',13,['public_packages_projection'],PUBLIC_PACKAGES.slice(0,13)),
  spec('web_packages_l','09_Web_Packages','A4:L','package_id',12,['public_packages_projection'],PUBLIC_PACKAGES.slice(0,12)),
  spec('customers','11_Customer_Stats','A1:H','customer_key',8,['admin_snapshot']),
  spec('health','10_Admin_Health_Check','A4:D','Check',4,['admin_snapshot']),
  spec('health_lean','10_Admin_Health_Check','A4:B40','Check',2,['admin_guard']),
  spec('model_master','Model_Master','A4:E','model_group',5,['admin_snapshot']),
  spec('visibility_locks','18_Event_Visibility_Locks','A1:N','lock_id',14,['admin_snapshot']),
  spec('visibility_locks_lean','18_Event_Visibility_Locks','A1:N500','lock_id',14,['admin_guard']),
  spec('rental_dashboard_data','_Rental_Dashboard_Data','A1:O','Booking ID',15,['rental_analytics']),
  spec('event_archive','13_Event_Archive','A1:Z','archived_at',26,['rental_analytics'])
]);

function schemaResult(values,specification){
  // Accept Google display values only, within the existing bounded read sizes.
  // This applies equally to injected fixtures and either existing transport.
  if(!Array.isArray(values)||values.length===0||values.length>4000||
      values.some(row=>!Array.isArray(row)||row.length>specification.width||row.some(cell=>typeof cell!=='string')))
    return {ok:false,classification:'PRIVATE_SCHEMA_INVALID'};
  const header=values[0].map(v=>v.trim());
  if(!header.includes(specification.header))return {ok:false,classification:'PRIVATE_SCHEMA_INVALID'};
  if(specification.orderedHeaders){
    if(header.length!==specification.orderedHeaders.length||header.some((name,i)=>
      name.toLowerCase()!==specification.orderedHeaders[i]&&
      !(specification.sheet==='09_Web_Packages'&&i===11&&name.toLowerCase()==='package_note')))
      return {ok:false,classification:'PRIVATE_SCHEMA_INVALID'};
  }
  const hasData=values.slice(1).some(row=>row.some(cell=>cell.trim()!==''));
  return {ok:true,classification:hasData?'PRIVATE_RANGE_SCHEMA_OK':'PRIVATE_RANGE_SCHEMA_EMPTY'};
}

module.exports={RANGE_SPECS,schemaResult};
