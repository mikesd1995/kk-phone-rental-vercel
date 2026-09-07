'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function normalized(v){ return text(v).toLowerCase().replace(/\s+/g,' ').trim(); }

function stableIdentity(row={}){
  return {
    event_family_id:text(row.event_family_id || row.eventFamilyId || row['Event Family ID']),
    show_id:text(row.show_id || row.showId || row['Show ID']),
    work_packet_id:text(row.work_packet_id || row.workPacketId || row['Work Packet ID'])
  };
}

function deterministicWorkPacketId(showId, materialFingerprint){
  const show=text(showId), fp=text(materialFingerprint);
  if(!show || !fp) throw new Error('show_id and material_fingerprint are required');
  return `WP|${show}|${fp}`;
}

function handoffReadiness(candidate={}, packet={}){
  const c=stableIdentity(candidate), p=stableIdentity(packet);
  const reasons=[];
  if(!c.event_family_id || !c.show_id) reasons.push('CANDIDATE_IDENTITY_INCOMPLETE');
  if(!c.work_packet_id) reasons.push('CANDIDATE_WORK_PACKET_ID_MISSING');
  if(!p.work_packet_id) reasons.push('PACKET_WORK_PACKET_ID_MISSING');
  if(c.work_packet_id && p.work_packet_id && c.work_packet_id!==p.work_packet_id) reasons.push('WORK_PACKET_ID_MISMATCH');
  if(c.event_family_id && p.event_family_id && c.event_family_id!==p.event_family_id) reasons.push('EVENT_FAMILY_MISMATCH');
  if(c.show_id && p.show_id && c.show_id!==p.show_id) reasons.push('SHOW_ID_MISMATCH');
  if(upper(packet.packet_status || packet.packetStatus || packet['Packet Status'])!=='READY_FOR_VERIFIER') reasons.push('PACKET_NOT_READY');
  return {ready:reasons.length===0,reasons};
}

function orphanReadyCandidates(candidates=[], packets=[]){
  const readyPackets=new Map();
  for(const p of packets){
    if(upper(p.packet_status || p.packetStatus || p['Packet Status'])==='READY_FOR_VERIFIER'){
      const id=stableIdentity(p).work_packet_id;
      if(id) readyPackets.set(id,p);
    }
  }
  return candidates.filter(c=>{
    if(upper(c.status || c.Status)!=='READY_FOR_VERIFIER') return false;
    const id=stableIdentity(c).work_packet_id;
    const packet=readyPackets.get(id);
    return !packet || !handoffReadiness(c,packet).ready;
  });
}

function keyedMutationGate(expected={}, actual={}, options={}){
  const left=stableIdentity(expected), right=stableIdentity(actual);
  const mismatches=[];
  for(const key of ['event_family_id','show_id']){
    if(!left[key] || !right[key] || left[key]!==right[key]) mismatches.push(key);
  }
  if(options.require_work_packet){
    if(!left.work_packet_id || !right.work_packet_id || left.work_packet_id!==right.work_packet_id) mismatches.push('work_packet_id');
  }
  return {ok:mismatches.length===0,mismatches};
}

function verifierFinishClosure(input={}){
  const readyLineageGap=Number(input.ready_lineage_gap || 0);
  const canonicalMonthlyGap=Number(input.canonical_monthly_gap || 0);
  const unresolvedTx=Number(input.unresolved_prepared_committing || 0);
  const reasons=[];
  if(readyLineageGap!==0) reasons.push('READY_LINEAGE_GAP');
  if(canonicalMonthlyGap!==0) reasons.push('CANONICAL_MONTHLY_GAP');
  if(unresolvedTx!==0) reasons.push('UNRESOLVED_TRANSACTION');
  return {can_finish:reasons.length===0,reasons};
}

const REQUIRED_PASSES=['PASS_A_OFFICIAL_UNIVERSE','PASS_B_OPPORTUNITY_KEYWORDS','PASS_C_REVERSE_COMPETITOR','PASS_D_NEGATIVE_CROSS_SOURCE_AUDIT'];
function multipassCoverage(executed=[]){
  const set=new Set(executed.map(upper));
  const missing=REQUIRED_PASSES.filter(p=>!set.has(p));
  return {complete:missing.length===0,missing,status:missing.length?'PARTIAL':'FULL'};
}

function sourceSectionCoverage(input={}){
  const required=(input.required_sections||[]).map(text).filter(Boolean);
  const attempted=new Set((input.attempted_sections||[]).map(text).filter(Boolean));
  const blocked=new Set((input.blocked_sections||[]).map(text).filter(Boolean));
  const missing=required.filter(x=>!attempted.has(x) && !blocked.has(x));
  const blockedRequired=required.filter(x=>blocked.has(x));
  const full=required.length>0 && missing.length===0 && blockedRequired.length===0;
  return {status:full?'FULL':'PARTIAL',root_only:!!input.root_access&&required.length>0&&attempted.size===0,missing,blocked:blockedRequired};
}

function competitorConsensusAlarms(signals=[], trackedEventKeys=[]){
  const tracked=new Set(trackedEventKeys.map(normalized));
  const groups=new Map();
  for(const s of signals){
    if(s.is_own_shop) continue;
    const event=normalized(s.event_key || s.eventKey);
    const business=normalized(s.competitor_business_id || s.competitorBusinessId);
    if(!event || !business || tracked.has(event)) continue;
    const set=groups.get(event)||new Set(); set.add(business); groups.set(event,set);
  }
  return Array.from(groups.entries()).filter(([,businesses])=>businesses.size>=2).map(([event_key,businesses])=>({event_key,independent_competitor_count:businesses.size,severity:'P0'})).sort((a,b)=>a.event_key.localeCompare(b.event_key));
}

const RESOLUTION_KINDS=new Set(['EXISTING_LINK','CANDIDATE_PACKET','DUPLICATE','OUT_OF_AREA','EXPLICIT_HOLD','EXPLICIT_SUPPRESS']);
function signalAccounting(signals=[], resolutions=[]){
  const resolved=new Map();
  for(const r of resolutions){ const id=text(r.signal_id || r.signalId), kind=upper(r.kind || r.resolution); if(id&&RESOLUTION_KINDS.has(kind)) resolved.set(id,kind); }
  const unaccounted=signals.filter(s=>s.in_area!==false).map(s=>text(s.signal_id || s.signalId)).filter(Boolean).filter(id=>!resolved.has(id));
  return {zero_unaccounted:unaccounted.length===0,unaccounted};
}

function yearEndCompletion(input={}){
  const pass=multipassCoverage(input.executed_passes||[]);
  const unaccounted=Number(input.unaccounted_signals||0), backlog=Number(input.unresolved_high_priority_backlog||0), projection=Number(input.cross_projection_gaps||0);
  if(!pass.complete||unaccounted||backlog||projection) return {status:'PARTIAL',complete:false,reasons:[...(pass.complete?[]:['MULTIPASS_INCOMPLETE']),...(unaccounted?['UNACCOUNTED_SIGNALS']:[]),...(backlog?['BACKLOG_NOT_DRAINED']:[]),...(projection?['CROSS_PROJECTION_GAP']:[])]};
  if(input.external_coverage_partial) return {status:'PASS_WITH_PARTIAL_EXTERNAL_COVERAGE',complete:true,reasons:['EXTERNAL_ACCESS_PARTIAL']};
  return {status:'PASS',complete:true,reasons:[]};
}

function nightlyUltraDeepCompletion(input={}){
  const pass=multipassCoverage(input.executed_passes||[]);
  const required=Math.max(0,Number(input.required_source_family_attempts||0));
  const accounted=Math.max(0,Number(input.accounted_source_family_attempts||0));
  const blocked=Math.max(0,Number(input.blocked_required_routes||0));
  const unaccounted=Math.max(0,Number(input.unaccounted_signals||0));
  const missing=Math.max(0,required-accounted);
  const reasons=[];
  if(!pass.complete) reasons.push('MULTIPASS_INCOMPLETE');
  if(missing) reasons.push('REQUIRED_SOURCE_ATTEMPT_GAP');
  if(blocked) reasons.push('BLOCKED_REQUIRED_ROUTE_DEBT');
  if(unaccounted) reasons.push('UNACCOUNTED_SIGNALS');
  const complete=reasons.length===0;
  return {complete,status:complete?'FULL':'PARTIAL',reasons,missing_source_attempts:missing,coverage_debt:missing+blocked};
}

function nightlySourceDebtRetry(input={}){
  const debt=Math.max(0,Number(input.coverage_debt||0));
  if(!debt) return {required:false,next_windows:[]};
  return {required:true,next_windows:['03:00_FALLBACK_DELTA_OR_DUE_RETRY','06:00_VENUE_TICKET_NEGATIVE_RETRY']};
}

function morningRevenueClosure(input={}){
  const hidden=Math.max(0,Number(input.hidden_high_value_signals||0));
  const holdMissingWatch=Math.max(0,Number(input.explicit_hold_missing_next_watch||0));
  const holdOverdueWatch=Math.max(0,Number(input.explicit_hold_overdue_next_watch || input.overdue_next_watch || 0));
  const tx=Math.max(0,Number(input.unresolved_prepared_committing||0));
  const reasons=[];
  if(hidden) reasons.push('HIDDEN_HIGH_VALUE_BACKLOG');
  if(holdMissingWatch) reasons.push('HOLD_WITHOUT_NEXT_WATCH');
  if(holdOverdueWatch) reasons.push('HOLD_NEXT_WATCH_OVERDUE');
  if(tx) reasons.push('UNRESOLVED_TRANSACTION');
  return {ready:reasons.length===0,status:reasons.length?'HOLD':'READY',reasons};
}

function nightlyPriceRefreshRequired(input={}){
  const severity=upper(input.priority_class||input.severity);
  const material=!!(input.is_new_event||input.material_change);
  const days=Number(input.days_until_event);
  const marketMissingOrStale=!!(input.exact_bundle_missing||input.exact_bundle_stale);
  return material&&(severity==='P0'||severity==='P1')&&Number.isFinite(days)&&days>=0&&days<=14&&marketMissingOrStale;
}

module.exports={stableIdentity,deterministicWorkPacketId,handoffReadiness,orphanReadyCandidates,keyedMutationGate,verifierFinishClosure,multipassCoverage,sourceSectionCoverage,competitorConsensusAlarms,signalAccounting,yearEndCompletion,nightlyUltraDeepCompletion,nightlySourceDebtRetry,morningRevenueClosure,nightlyPriceRefreshRequired};
