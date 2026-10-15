'use strict';

const VERSION='KK_CONTENT_QA_GATE_V3';
const SAFETY=Object.freeze({authority:'READ_ONLY_VALIDATOR',production_writes:0,publishes:0,human_approval_required:true});
const NEAR_DUPLICATE_THRESHOLD=0.78;
const RECENT_REPEAT_THRESHOLD=0.82;
const BRAND_LINE='📱 KK Phone Rental | #เช่ามือถือ';
const BOOKING_HOST='kk-phone-rental.vercel.app';

function text(v){return String(v===undefined||v===null?'':v).trim();}
function uniq(a){return [...new Set(a.filter(Boolean))];}
function hashtags(s){return uniq((text(s).match(/#[\p{L}\p{M}\p{N}_]+/gu)||[]).map(x=>x.toLowerCase()));}
function normalizeToken(s){return text(s).toLowerCase().replace(/[\s|,./\\\-–—:;()[\]{}'"“”‘’!?]+/g,'');}
function dateTokens(input={}){return uniq(['date_display','event_date_display','event_date'].map(k=>text(input[k])).filter(Boolean));}
function venueTokens(input={}){return uniq([text(input.venue_display),text(input.venue)].filter(Boolean));}
function occurrences(haystack,needle){const h=normalizeToken(haystack),n=normalizeToken(needle);if(!n)return 0;let count=0,pos=0;while((pos=h.indexOf(n,pos))>=0){count++;pos+=n.length;}return count;}
function verifiedHashtagSet(input={}){const raw=[];if(Array.isArray(input.verified_hashtags))raw.push(...input.verified_hashtags);if(text(input.official_event_hashtag))raw.push(input.official_event_hashtag);return uniq(raw.flatMap(hashtags));}

function commercialTruthRequired(input={}){
 if(text(input.requested_intent).toLowerCase()==='direct_rental_x')return true;
 if(input.commercial_truth_required===true)return true;
 if(input.commercial_truth_required===false)return false;
 if(text(input.sales_intent).toLowerCase()==='direct')return true;
 return input.verified_pricing!==undefined||input.inventory_available!==undefined||Boolean(text(input.price_display));
}

function eventTruthRequired(input={}){
 if(input.event_truth_required===true)return true;
 if(input.event_truth_required===false)return false;
 return Boolean(text(input.event)||text(input.official_event_hashtag)||dateTokens(input).length||venueTokens(input).length);
}

function validateHashtags(post,input={},options={}){
 const postTags=hashtags(post),verified=verifiedHashtagSet(input),eventTag=text(input.official_event_hashtag).toLowerCase();const errors=[];
 const required=options.required!==false;
 if(required&&verified.length===0)errors.push('HASHTAGS_NOT_VERIFIED');
 const official=eventTag?(eventTag.startsWith('#')?eventTag:'#'+eventTag):'';
 if(official&&!postTags.includes(official))errors.push('OFFICIAL_EVENT_HASHTAG_MISSING');
 const unverified=postTags.filter(tag=>tag!=='#เช่ามือถือ'&&!verified.includes(tag));if(unverified.length)errors.push('UNVERIFIED_HASHTAG_USED:'+unverified.join(','));
 const reach=postTags.filter(tag=>tag!=='#เช่ามือถือ'&&tag!==official);if(reach.length>5)errors.push('TOO_MANY_REACH_HASHTAGS');
 return {post_hashtags:postTags,verified_hashtags:verified,required,errors};
}

function validateDuplicateFacts(post,input={}){
 const errors=[],dates=dateTokens(input),venues=venueTokens(input);
 for(const d of dates){if(occurrences(post,d)>1)errors.push('DUPLICATE_DATE:'+d);}
 for(const v of venues){if(occurrences(post,v)>1)errors.push('DUPLICATE_VENUE:'+v);}
 return {dates,venues,errors};
}

function validateBusinessCritical(post,input={}){
 const errors=[],p=text(post),commercial=commercialTruthRequired(input);
 if(!p.startsWith(BRAND_LINE))errors.push('BRAND_NOT_FIRST');
 if(commercial){
   const price=text(input.price_display);
   if(!price) errors.push('PRICE_DISPLAY_MISSING');
   else if(occurrences(p,price)!==1) errors.push(occurrences(p,price)===0?'VERIFIED_PRICE_NOT_IN_COPY':'DUPLICATE_PRICE_BLOCK');
   const ctaLines=p.split(/\r?\n/).map(line=>line.trim()).filter(line=>/^👉\s*/u.test(line));
   if(ctaLines.length!==1 || !/(?:จอง|เช็กคิว|สำรอง)/u.test(ctaLines[0]) ||
      !p.includes(BOOKING_HOST))errors.push('BOOKING_CTA_MISSING');
   if(input.require_date_venue_copy!==false){
     for(const d of dateTokens(input)){if(occurrences(p,d)===0)errors.push('DATE_NOT_IN_COPY:'+d);}
     for(const v of venueTokens(input)){if(occurrences(p,v)===0)errors.push('VENUE_NOT_IN_COPY:'+v);}
   }
 }
 return {errors};
}

function creativeCore(post,input={}){
 const price=normalizeToken(input.price_display);
 const dates=dateTokens(input).map(normalizeToken);
 const venues=venueTokens(input).map(normalizeToken);
 const removablePrefixes=['💙','📍','☁️','🎁','👉','🎤'];
 const lines=text(post).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const kept=lines.filter(line=>{
   if(line===BRAND_LINE)return false;
   const n=normalizeToken(line);
   if(!n)return false;
   if(removablePrefixes.some(prefix=>line.startsWith(prefix)))return false;
   if(line.includes(BOOKING_HOST))return false;
   if(/^🔥?\s*(?:งาน\s*)?#[\p{L}\p{M}\p{N}_]+$/u.test(line))return false;
   if(/^#[\p{L}\p{M}\p{N}_]+(?:\s+#[\p{L}\p{M}\p{N}_]+)*$/u.test(line))return false;
   if(price&&n.includes(price))return false;
   if(dates.some(d=>d&&n.includes(d)))return false;
   if(venues.some(v=>v&&n.includes(v)))return false;
   return true;
 });
 return kept.join(' ');
}

function shingleSet(value,size=4){
 const s=normalizeToken(value);
 const out=new Set();
 if(!s)return out;
 if(s.length<=size){out.add(s);return out;}
 for(let i=0;i<=s.length-size;i++)out.add(s.slice(i,i+size));
 return out;
}

function similarity(a,b){
 const A=shingleSet(a),B=shingleSet(b);
 if(!A.size||!B.size)return 0;
 let intersection=0;
 for(const item of A)if(B.has(item))intersection++;
 return (2*intersection)/(A.size+B.size);
}

function validateAntiRepeat(post,input={}){
 const errors=[];
 const core=creativeCore(post,input);
 if(!core)errors.push('CREATIVE_CORE_MISSING');
 const recent=Array.isArray(input.recent_posts)?input.recent_posts:[];
 recent.forEach((item,index)=>{
   const recentText=typeof item==='string'?item:text(item&& (item.copy||item.text||item.hook||item.content));
   if(!recentText)return;
   const recentCore=creativeCore(recentText,input)||recentText;
   const score=similarity(core,recentCore);
   if(score>=RECENT_REPEAT_THRESHOLD)errors.push('RECENT_COPY_NEAR_DUPLICATE:'+(index+1)+':'+score.toFixed(2));
 });
 return {core,recent_count:recent.length,errors};
}

function validateStandardA(post,input={}){
 return validateBusinessCritical(post,input);
}

function validatePost(post,input={}){
 const errors=[];
 if(!text(post))errors.push('POST_EMPTY');
 const eventRequired=eventTruthRequired(input);
 const commercialRequired=commercialTruthRequired(input);
 if(eventRequired&&input.verified_event!==true)errors.push('EVENT_NOT_VERIFIED');
 if(commercialRequired&&input.verified_pricing!==true)errors.push('PRICING_NOT_VERIFIED');
 if(commercialRequired&&input.inventory_available!==true)errors.push('INVENTORY_NOT_CONFIRMED_AVAILABLE');
 const hashtagRequired=eventRequired||verifiedHashtagSet(input).length>0||Boolean(text(input.official_event_hashtag));
 const h=validateHashtags(post,input,{required:hashtagRequired});errors.push(...h.errors);
 const d=validateDuplicateFacts(post,input);errors.push(...d.errors);
 const b=validateBusinessCritical(post,input);errors.push(...b.errors);
 const a=validateAntiRepeat(post,input);errors.push(...a.errors);
 return {
   schema_version:VERSION,
   gate:errors.length?'BLOCKED':'PASS',
   publishable:errors.length===0,
   owner_review_required:true,
   commercial_truth_required:commercialRequired,
   event_truth_required:eventRequired,
   creative_layout_policy:'FLEXIBLE',
   hard_gate_policy:'FACTS_PRICE_INVENTORY_HASHTAGS_BRAND_CTA_ANTI_REPEAT',
   errors:uniq(errors),
   hashtag_check:h,
   duplicate_fact_check:d,
   business_critical_check:b,
   anti_repeat_check:a,
   safety:SAFETY
 };
}

function candidateCopy(item){
 if(item&&typeof item==='object') return text(item.copy);
 return text(item);
}

function validateVariants(posts=[],input={}){
 const list=Array.isArray(posts)?posts:[];
 const copies=list.map(candidateCopy);
 const results=copies.map(post=>validatePost(post,input));
 const errors=[];
 if(results.length!==3) errors.push('ALL_POSTS_REQUIRE_EXACTLY_3_INTERNAL_CANDIDATES');
 const uniqueCopies=new Set(copies.map(x=>normalizeToken(x)).filter(Boolean));
 if(copies.length===3&&uniqueCopies.size!==3) errors.push('DUPLICATE_INTERNAL_CANDIDATE_COPY');
 const objectCandidates=list.filter(x=>x&&typeof x==='object');
 if(objectCandidates.length===3){
   const angles=objectCandidates.map(x=>text(x.angle).toLowerCase());
   if(angles.some(x=>!x)) errors.push('CANDIDATE_ANGLE_MISSING');
   else if(new Set(angles).size!==3) errors.push('DUPLICATE_INTERNAL_CANDIDATE_ANGLE');
 }
 const cores=copies.map(copy=>creativeCore(copy,input));
 for(let i=0;i<cores.length;i++){
   for(let j=i+1;j<cores.length;j++){
     const score=similarity(cores[i],cores[j]);
     if(score>=NEAR_DUPLICATE_THRESHOLD)errors.push('NEAR_DUPLICATE_INTERNAL_CANDIDATES:'+(i+1)+'-'+(j+1)+':'+score.toFixed(2));
   }
 }
 results.forEach((r,i)=>r.errors.forEach(e=>errors.push('CANDIDATE_'+(i+1)+':'+e)));
 return {
   schema_version:VERSION,
   gate:errors.length?'BLOCKED':'PASS',
   publishable:errors.length===0,
   errors:uniq(errors),
   creative_cores:cores,
   near_duplicate_threshold:NEAR_DUPLICATE_THRESHOLD,
   results,
   safety:SAFETY
 };
}

module.exports={
 VERSION,SAFETY,NEAR_DUPLICATE_THRESHOLD,RECENT_REPEAT_THRESHOLD,BRAND_LINE,
 hashtags,dateTokens,venueTokens,occurrences,verifiedHashtagSet,
 commercialTruthRequired,eventTruthRequired,validateHashtags,validateDuplicateFacts,
 validateBusinessCritical,validateStandardA,creativeCore,similarity,validateAntiRepeat,
 validatePost,candidateCopy,validateVariants
};
