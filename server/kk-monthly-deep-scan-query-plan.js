'use strict';
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const VERSION='KK_MONTHLY_DEEP_SCAN_QUERY_PLAN_V4';
const TIER_TERMS={
 OFFICIAL:['concert fanmeeting fancon Bangkok','คอนเสิร์ต แฟนมีต กรุงเทพ'],
 TICKETING:['site:thaiticketmajor.com concert Bangkok','site:ticketmelon.com Bangkok event'],
 VENUE:['IMPACT Arena event concert','BITEC Live event concert','Union Hall concert'],
 ARTIST_AGENCY:['GMMTV event concert fanmeeting','artist agency Thailand fan meeting'],
 BRAND_SPONSOR:['exclusive event artist Bangkok brand','กิจกรรม ศิลปิน แบรนด์ กรุงเทพ'],
 SOCIAL:['concert fanmeeting Bangkok X Instagram','แฟนมีต คอนเสิร์ต กรุงเทพ'],
 COMPETITOR:['เช่ามือถือ คอนเสิร์ต vivo X300 Pro','เช่ามือถือ fanmeeting Bangkok'],
 PUBLIC_CALENDAR:['Bangkok concerts events calendar','Thailand concert calendar']
};
function text(v){return String(v==null?'':v).trim();}
function queryVariantsForTerm(term,range,location){
 const labels=SourceRegistry.monthLabels(range.month);
 // Search engines are substantially more reliable with short intent queries.
 // Keep the precise month/location forms, but add bounded broad fallbacks; the
 // verifier/date-window gate decides whether returned evidence belongs in-month.
 const compact=String(term).replace(/\s+/g,' ').trim();
 return [...new Set([
   compact+' '+labels.en+' Bangkok',
   compact+' '+labels.th+' กรุงเทพ',
   compact+' Bangkok',
   compact+' Thailand',
   compact
 ])].filter(Boolean);
}
function monthRange(input={}){
 const raw=text(input.month);let y,m;
 if(/^\d{4}-\d{2}$/.test(raw)){[y,m]=raw.split('-').map(Number);}else{
  const base=/^\d{4}-\d{2}-\d{2}$/.test(text(input.current_date))?new Date(text(input.current_date)+'T00:00:00Z'):new Date();
  y=base.getUTCFullYear();m=base.getUTCMonth()+2;if(m===13){m=1;y++;}
 }
 const last=new Date(Date.UTC(y,m,0)).getUTCDate();const mm=String(m).padStart(2,'0');
 return {month:y+'-'+mm,start_date:y+'-'+mm+'-01',end_date:y+'-'+mm+'-'+String(last).padStart(2,'0')};
}
function build(input={}){
 const range=monthRange(input);const location=text(input.location)||'Bangkok Thailand';const gap_tasks=[];
 for(const [source_tier,terms] of Object.entries(TIER_TERMS))for(const term of terms){const qs=queryVariantsForTerm(term,range,location);gap_tasks.push({source_tier,query:qs[0],query_variants:qs.slice(1),providers:['OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','DDGS_TRAFILATURA','DDG_HTML','BING_HTML','SEARXNG','CRAWL4AI','EXA'],stop_condition:'AT_LEAST_ONE_VALID_HTTPS_SOURCE',evidence_required:true,date_window:{start:range.start_date,end:range.end_date}});}
 const universe=SourceRegistry.buildUniversePlan({month:range.month,location});
 for(const task of universe.tasks){
   gap_tasks.push({source_tier:task.source_tier,source_id:task.source_id,query:task.query,providers:task.providers,stop_condition:'EXECUTE_AND_RECORD_RECEIPT',evidence_required:true,required:task.required,date_window:{start:range.start_date,end:range.end_date}});
 }
 return {version:VERSION,mode:'ULTRA_DEEP_MONTH',range,location,gap_tasks,source_universe_version:universe.version,source_universe_task_count:universe.tasks.length,required_tiers:Object.keys(TIER_TERMS),production_writes:0,authoritative:false,verifier_required:true};
}
module.exports={VERSION,TIER_TERMS,monthRange,queryVariantsForTerm,build};
