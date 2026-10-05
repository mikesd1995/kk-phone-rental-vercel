'use strict';

const VERSION='KK_ULTRA_DEEP_PHASE3_LEARNING_AGENT_V1';

function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function uniq(v){return [...new Set(arr(v).map(text).filter(Boolean))];}
function candidateId(row={}){return text(row.candidate_id||row.event_key||row.id);}
function candidateMap(candidates=[]){return new Map(arr(candidates).map(c=>[candidateId(c),c]));}

function queriesFor(candidate={},missClass=''){
 const title=text(candidate.title||candidate.event_name);
 const date=text(candidate.event_date);
 const artist=arr(candidate.artist||candidate.artists).map(text).filter(Boolean);
 const fandom=arr(candidate.fandom).map(text).filter(Boolean);
 const type=text(candidate.event_type);
 const venue=text(candidate.venue);
 const common=[
  `"${title}" เช่ามือถือ vivo X300 Pro ราคา`,
  `"${title}" เช่าโทรศัพท์ เครื่อง ราคา`,
  `"${title}" vivo X300 Pro Lens ราคา`,
  `site:x.com "${title}" เช่ามือถือ`
 ];
 switch(text(missClass).toUpperCase()){
  case 'STALE_PRICE_GAP':
  case 'PRICE_FRESHNESS_UNKNOWN':
    return uniq([...common,`"${title}" ${date} เช่า ราคา ล่าสุด`,`"${title}" latest phone rental price`]);
  case 'PACKAGE_AMBIGUITY':
  case 'PACKAGE_PARITY_GAP':
    return uniq([...common,`"${title}" เครื่องอย่างเดียว ราคา`,`"${title}" พร้อมเลนส์ ราคา`,`"${title}" Lens + ราคา`]);
  case 'COMPETITOR_IDENTITY_GAP':
    return uniq([...common,`"${title}" ร้านเช่ามือถือ x300`,`"${title}" phone rental Bangkok`]);
  case 'OUTLIER_PRICE_GAP':
  case 'COMPETITOR_COVERAGE_THIN':
    return uniq([...common,`"${title}" เช่า x300 690 790 890 990`]);
  case 'COMPARABLE_GAP':
    return uniq([
      ...artist.map(a=>`"${a}" ${type||'fan event'} เช่ามือถือ ราคา`),
      ...fandom.map(f=>`"${f}" ${type||'event'} phone rental ราคา`),
      venue?`"${venue}" ${type||'event'} เช่ามือถือ`:'',
      ...common
    ]);
  case 'NO_EXACT_PRICE_GAP':
  default:
    return common;
 }
}
function learn(input={}){
 const misses=arr(input.misses);
 const byId=candidateMap(input.candidates);
 const extra_queries_by_candidate={};
 const miss_classes=uniq(misses.map(x=>text(x.miss_class).toUpperCase()));
 for(const miss of misses){
  const id=text(miss.candidate_id);const candidate=byId.get(id)||{candidate_id:id,title:text(miss.title)};
  extra_queries_by_candidate[id]=uniq([...(extra_queries_by_candidate[id]||[]),...queriesFor(candidate,miss.miss_class)]);
 }
 const expansions=[];
 if(miss_classes.some(x=>['NO_EXACT_PRICE_GAP','COMPETITOR_IDENTITY_GAP','COMPETITOR_COVERAGE_THIN'].includes(x)))expansions.push('EXPAND_COMPETITOR_UNIVERSE');
 if(miss_classes.some(x=>['STALE_PRICE_GAP','PRICE_FRESHNESS_UNKNOWN'].includes(x)))expansions.push('FRESH_PRICE_TIMESTAMP_RECOVERY');
 if(miss_classes.some(x=>['PACKAGE_AMBIGUITY','PACKAGE_PARITY_GAP'].includes(x)))expansions.push('PACKAGE_SEMANTIC_RECONCILIATION');
 if(miss_classes.includes('OUTLIER_PRICE_GAP'))expansions.push('OUTLIER_CROSSCHECK_MORE_SHOPS');
 if(miss_classes.includes('COMPARABLE_GAP'))expansions.push('COMPARABLE_GRAPH_EXPANSION');
 return {
  version:VERSION,
  miss_count:misses.length,
  miss_classes,
  extra_queries_by_candidate,
  mandatory_expansion:uniq(expansions),
  production_writes:0
 };
}
module.exports={VERSION,text,arr,uniq,candidateId,candidateMap,queriesFor,learn};
