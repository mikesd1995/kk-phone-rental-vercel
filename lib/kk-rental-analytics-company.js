'use strict';

const UNKNOWN='ยังไม่ระบุ / Unknown';
function text(v){ return String(v==null?'':v).trim(); }
function norm(v){ return text(v).toLowerCase().replace(/\s+/g,' '); }
function parseNoteFields(note){
  const out={};
  const s=text(note);
  if(!s) return out;
  for(const part of s.split(/[;|\n]+/)){
    const m=part.match(/^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/);
    if(!m) continue;
    const key=norm(m[1]).replace(/[\s-]+/g,'_');
    if(key && !out[key]) out[key]=text(m[2]);
  }
  return out;
}
function firstField(fields,keys){ for(const k of keys){ if(text(fields[k])) return text(fields[k]); } return ''; }
function normalizeOrigin(v){
  const s=norm(v);
  if(!s) return 'UNKNOWN';
  if(['thai','thailand','th','ไทย','ศิลปินไทย','นักแสดงไทย'].includes(s)) return 'THAI';
  if(['foreign','international','overseas','ต่างประเทศ','ศิลปินต่างประเทศ','นักแสดงต่างประเทศ'].includes(s)) return 'FOREIGN';
  return 'UNKNOWN';
}
function aliasMatches(eventName,alias){
  const hay=norm(eventName), needle=norm(alias);
  if(!hay || !needle || needle.length<3) return false;
  const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`,'iu');
  return re.test(hay);
}
function uniqueRegistryMatch(eventName,rules){
  const hits=[];
  for(const r of rules||[]){
    const affiliation=text(r.affiliation);
    if(!affiliation) continue;
    if((r.aliases||[]).some(a=>aliasMatches(eventName,a))) hits.push(affiliation);
  }
  const unique=[...new Set(hits)];
  return unique.length===1?{value:unique[0],ambiguous:false}:unique.length>1?{value:'',ambiguous:true}:{value:'',ambiguous:false};
}
function resolveCompany({eventName,note='',explicitAffiliation='',explicitOrganizer='',origin='',registryRules=[]}={}){
  const fields=parseNoteFields(note);
  const resolvedOrigin=normalizeOrigin(origin || firstField(fields,['performer_origin','artist_origin','nationality','performer_nationality']));
  const talent=text(explicitAffiliation) || firstField(fields,['talent_affiliation','artist_agency','artist_label','affiliation','สังกัดศิลปิน','สังกัดนักแสดง','สังกัด','ค่ายศิลปิน']);
  const organizer=text(explicitOrganizer) || firstField(fields,['local_organizer','local_promoter','organizer','promoter','ผู้จัดในไทย','ผู้จัดงาน']);
  const registry=uniqueRegistryMatch(eventName,registryRules);

  if(resolvedOrigin==='FOREIGN'){
    if(organizer) return {company:organizer,source:'explicit_local_organizer',semantics:'LOCAL_ORGANIZER_PROMOTER',origin:resolvedOrigin,ambiguous:false};
    return {company:UNKNOWN,source:registry.ambiguous?'ambiguous_registry_not_applicable':'unknown',semantics:'LOCAL_ORGANIZER_PROMOTER',origin:resolvedOrigin,ambiguous:registry.ambiguous};
  }
  if(talent) return {company:talent,source:'explicit_talent_affiliation',semantics:'TALENT_AFFILIATION',origin:resolvedOrigin,ambiguous:false};
  if(registry.value) return {company:registry.value,source:'artist_registry',semantics:'TALENT_AFFILIATION',origin:resolvedOrigin,ambiguous:false};
  return {company:UNKNOWN,source:registry.ambiguous?'ambiguous_artist_registry':'unknown',semantics:resolvedOrigin==='THAI'?'TALENT_AFFILIATION':'UNKNOWN',origin:resolvedOrigin,ambiguous:registry.ambiguous};
}
module.exports={UNKNOWN,parseNoteFields,resolveCompany,uniqueRegistryMatch,normalizeOrigin};
