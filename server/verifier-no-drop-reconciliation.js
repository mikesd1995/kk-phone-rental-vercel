'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function pick(row,names){
  for(const name of names){
    if(row && Object.prototype.hasOwnProperty.call(row,name) && row[name] != null) return row[name];
  }
  return '';
}
function normalizeDate(v){
  const raw=text(v);
  let m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return raw;
  m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    let y=Number(m[3]); if(y>=2400) y-=543;
    return [String(y).padStart(4,'0'),String(Number(m[2])).padStart(2,'0'),String(Number(m[1])).padStart(2,'0')].join('-');
  }
  m=raw.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? m[1]+'-'+m[2]+'-'+m[3] : raw;
}
function packetStatus(row){ return text(pick(row,['Packet Status','packet_status'])).toUpperCase(); }
function workPacketId(row){ return text(pick(row,['Work Packet ID','work_packet_id'])); }
function showId(row){ return text(pick(row,['Show ID','show_id','tracker_show_id'])); }
function familyId(row){ return text(pick(row,['Event Family ID','event_family_id'])); }
function eventDate(row){ return normalizeDate(pick(row,['Event Date','event_date','Suspected Event Date','show_date'])); }
function candidateStatus(row){ return text(pick(row,['Status','status'])).toUpperCase(); }

function operationalReadyPackets(aiRows){
  return (aiRows||[]).filter(row=>workPacketId(row) && packetStatus(row)==='READY_FOR_VERIFIER');
}

function joinCandidate(packet,candidateRows){
  const pShow=showId(packet);
  if(pShow){
    const exact=(candidateRows||[]).filter(row=>showId(row)===pShow);
    if(exact.length===1) return {candidate:exact[0],method:'SHOW_ID',debt:null};
    if(exact.length>1) return {candidate:null,method:'SHOW_ID',debt:'MULTIPLE_CANDIDATE_SHOW_ID_MATCHES'};
  }
  const pFam=familyId(packet), pDate=eventDate(packet);
  if(pFam && pDate){
    const exact=(candidateRows||[]).filter(row=>familyId(row)===pFam && eventDate(row)===pDate);
    if(exact.length===1) return {candidate:exact[0],method:'FAMILY_DATE',debt:null};
    if(exact.length>1) return {candidate:null,method:'FAMILY_DATE',debt:'MULTIPLE_CANDIDATE_FAMILY_DATE_MATCHES'};
  }
  return {candidate:null,method:null,debt:'CANDIDATE_PAIR_MISSING'};
}

function auditReadyPairing(aiRows,candidateRows){
  const ready=operationalReadyPackets(aiRows);
  const pairs=ready.map(packet=>{
    const joined=joinCandidate(packet,candidateRows);
    return {
      work_packet_id:workPacketId(packet),
      show_id:showId(packet),
      event_family_id:familyId(packet),
      event_date:eventDate(packet),
      candidate_status:joined.candidate ? candidateStatus(joined.candidate) : '',
      join_method:joined.method,
      debt:joined.debt
    };
  });
  return {
    ready_count:ready.length,
    paired_count:pairs.filter(x=>!x.debt).length,
    pairing_debt_count:pairs.filter(x=>x.debt).length,
    pairs,
    production_writes:0
  };
}

function aiPacketsForCandidate(candidate,aiRows){
  const cShow=showId(candidate);
  if(cShow){
    const exact=(aiRows||[]).filter(row=>workPacketId(row) && showId(row)===cShow);
    if(exact.length) return {packets:exact,method:'SHOW_ID'};
  }
  const cFam=familyId(candidate), cDate=eventDate(candidate);
  if(cFam && cDate){
    const exact=(aiRows||[]).filter(row=>workPacketId(row) && familyId(row)===cFam && eventDate(row)===cDate);
    if(exact.length) return {packets:exact,method:'FAMILY_DATE'};
  }
  return {packets:[],method:null};
}

function auditCandidateReverseOrphans(aiRows,candidateRows){
  const readyCandidates=(candidateRows||[]).filter(row=>candidateStatus(row)==='READY_FOR_VERIFIER');
  const items=readyCandidates.map(candidate=>{
    const matched=aiPacketsForCandidate(candidate,aiRows);
    const statuses=matched.packets.map(packetStatus).filter(Boolean);
    const hasOperational=statuses.includes('READY_FOR_VERIFIER');
    const debt=!matched.packets.length
      ? 'CANDIDATE_READY_ORPHAN_NO_AI_PACKET'
      : (hasOperational ? null : 'STALE_CANDIDATE_READY_AFTER_AI_TERMINAL');
    return {
      show_id:showId(candidate),
      event_family_id:familyId(candidate),
      event_date:eventDate(candidate),
      join_method:matched.method,
      matched_ai_packet_count:matched.packets.length,
      matched_ai_packet_statuses:[...new Set(statuses)].sort(),
      state:!matched.packets.length ? 'ORPHAN' : (hasOperational ? 'PAIRED_OPERATIONAL' : 'STALE_READY'),
      debt
    };
  });
  return {
    candidate_ready_count:readyCandidates.length,
    operational_pair_count:items.filter(x=>x.state==='PAIRED_OPERATIONAL').length,
    candidate_orphan_count:items.filter(x=>x.state==='ORPHAN').length,
    stale_candidate_ready_count:items.filter(x=>x.state==='STALE_READY').length,
    items,
    production_writes:0
  };
}

function dispositionKey(row){
  const sid=showId(row);
  if(sid) return sid+'|'+eventDate(row);
  const fam=familyId(row);
  return fam ? fam+'|'+eventDate(row) : '';
}

function auditFamilyCompleteness(aiRows,candidateRows,monthlyDispositions,lineageRows,debtRows){
  const readyOrKnown=(aiRows||[]).filter(row=>workPacketId(row));
  const families=new Map();
  for(const packet of readyOrKnown){
    const joined=joinCandidate(packet,candidateRows);
    const candidate=joined.candidate;
    const fam=familyId(packet)||familyId(candidate);
    const key=dispositionKey(packet)||dispositionKey(candidate);
    if(!fam||!key) continue;
    if(!families.has(fam)) families.set(fam,new Set());
    families.get(fam).add(key);
  }
  const monthly=new Set((monthlyDispositions||[]).map(dispositionKey).filter(Boolean));
  const coreDisposition=new Set([...(lineageRows||[]),...(debtRows||[])].map(dispositionKey).filter(Boolean));
  const results=[];
  for(const [fam,expected] of families){
    if(expected.size<2) continue;
    const expectedKeys=[...expected].sort();
    const monthlyCount=expectedKeys.filter(k=>monthly.has(k)).length;
    const coreCount=expectedKeys.filter(k=>coreDisposition.has(k)).length;
    results.push({
      event_family_id:fam,
      expected_day_count:expectedKeys.length,
      monthly_disposition_count:monthlyCount,
      core_lineage_or_debt_count:coreCount,
      missing_monthly:expectedKeys.filter(k=>!monthly.has(k)),
      missing_core_lineage_or_debt:expectedKeys.filter(k=>!coreDisposition.has(k)),
      status:(monthlyCount===expectedKeys.length && coreCount===expectedKeys.length)?'COMPLETE':'FAMILY_COMPLETENESS_DEBT'
    });
  }
  return {families:results,production_writes:0};
}

function coreEventId(row){ return text(pick(row,['Core Event ID','core_event_id','event_id'])); }
function auditCoreReverseOrphans(coreRows,lineageRows){
  const mapped=new Set((lineageRows||[]).map(coreEventId).filter(Boolean));
  const current=(coreRows||[]).filter(row=>coreEventId(row));
  const orphans=current.filter(row=>!mapped.has(coreEventId(row))).map(row=>({
    core_event_id:coreEventId(row),
    event_name:text(pick(row,['event_name','Event Name'])),
    event_date:eventDate(row),
    debt:'REVERSE_CORE_ORPHAN'
  }));
  return {core_count:current.length,reverse_orphan_count:orphans.length,orphans,production_writes:0};
}

function auditNoDrop(input={}){
  return {
    packet_pairing:auditReadyPairing(input.ai_rows,input.candidate_rows),
    candidate_reverse:auditCandidateReverseOrphans(input.ai_rows,input.candidate_rows),
    family_completeness:auditFamilyCompleteness(
      input.ai_rows,input.candidate_rows,input.monthly_dispositions,input.lineage_rows,input.debt_rows
    ),
    reverse_core:auditCoreReverseOrphans(input.core_rows,input.lineage_rows),
    production_writes:0
  };
}

module.exports={
  operationalReadyPackets,
  joinCandidate,
  auditReadyPairing,
  auditCandidateReverseOrphans,
  auditFamilyCompleteness,
  auditCoreReverseOrphans,
  auditNoDrop,
  normalizeDate
};
