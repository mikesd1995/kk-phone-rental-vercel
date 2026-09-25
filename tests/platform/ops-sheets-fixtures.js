'use strict';
const {PLAN,HEADERS}=require('../../platform/ops/sheets-collector');
const {snapshot,NOW}=require('./ops-fixtures');
function fixture(){
 const s=snapshot();const data={metadata:{},ranges:{}};
 for(const [k,p]of Object.entries(PLAN)){
  const m=data.metadata[p.spreadsheetId]??={spreadsheetId:p.spreadsheetId,sheets:[]};m.sheets.push({properties:{sheetId:p.sheetId,title:p.sheetName,gridProperties:{rowCount:k==='canonical'?4995:p.endRow,columnCount:p.columns}}});
  data.ranges[k]={range:`'${p.sheetName}'!${p.range}`,majorDimension:'ROWS',values:[[...HEADERS[k]]]};
 }
 const policy=Array(14).fill('');Object.assign(policy,{0:'POLICY_VERSION',6:'v4.9.36',7:'2026-09-24T12:00:00.000Z',8:'TRUE'});data.ranges.policy.values.push(policy);
 const c=Array(40).fill('');Object.assign(c,{0:s.scope.family_id,1:'Sample',2:s.surfaces.canonical.rows[0].tracker_show_id,3:'10/10/2026',13:'80',17:'VERIFIED',18:'external prose must not be copied'});data.ranges.canonical.values.push(c);
 const l=s.surfaces.lineage.rows[0];data.ranges.lineage.values.push([l.lineage_key,l.mapping_version,l.event_family_id,l.tracker_show_id,l.show_instance_id,l.event_date,l.core_event_id,l.ticket_lifecycle,l.rental_lifecycle,l.mapping_status,'untrusted notes']);
 data.ranges.core.values.push(['EVT-SAMPLE','Sample','10/10/2026','','','','TRUE','private note']);
 data.ranges.web_ready.values.push(['EVT-SAMPLE','Sample','10/10/2026','','','internal note','2','2','','show','outbound text']);
 return data;
}
function reader(data,calls=[]){return {getMetadata:async request=>{calls.push({method:'getMetadata',...request});return structuredClone(data.metadata[request.spreadsheetId]);},getRange:async request=>{calls.push({method:'getRange',...request});const k=Object.keys(PLAN).find(k=>PLAN[k].spreadsheetId===request.spreadsheetId&&PLAN[k].sheetName===request.sheetName&&PLAN[k].range===request.range);if(!k)throw Error('unbounded request');return structuredClone(data.ranges[k]);}};}
const args={familyId:'FAM|sample|20261010',eventIds:['EVT-SAMPLE'],expectedPolicyVersion:'v4.9.36',now:NOW};
module.exports={fixture,reader,args};
