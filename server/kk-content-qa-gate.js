'use strict';

const VERSION='KK_CONTENT_QA_GATE_V1';
const SAFETY=Object.freeze({authority:'READ_ONLY_VALIDATOR',production_writes:0,publishes:0,human_approval_required:true});
function text(v){return String(v===undefined||v===null?'':v).trim();}
function uniq(a){return [...new Set(a.filter(Boolean))];}
function hashtags(s){return uniq((text(s).match(/#[\p{L}\p{N}_]+/gu)||[]).map(x=>x.toLowerCase()));}
function normalizeToken(s){return text(s).toLowerCase().replace(/[\s|,./\-–—]+/g,'');}
function dateTokens(input={}){return uniq(['date_display','event_date_display','event_date'].map(k=>text(input[k])).filter(Boolean));}
function venueTokens(input={}){return uniq([text(input.venue_display),text(input.venue)].filter(Boolean));}
function occurrences(haystack,needle){const h=normalizeToken(haystack),n=normalizeToken(needle);if(!n)return 0;let count=0,pos=0;while((pos=h.indexOf(n,pos))>=0){count++;pos+=n.length;}return count;}
function verifiedHashtagSet(input={}){const raw=[];if(Array.isArray(input.verified_hashtags))raw.push(...input.verified_hashtags);if(text(input.official_event_hashtag))raw.push(input.official_event_hashtag);return uniq(raw.flatMap(hashtags));}
function validateHashtags(post,input={}){
 const postTags=hashtags(post),verified=verifiedHashtagSet(input),eventTag=text(input.official_event_hashtag).toLowerCase();const errors=[];
 if(verified.length===0)errors.push('HASHTAGS_NOT_VERIFIED');
 const official=eventTag?(eventTag.startsWith('#')?eventTag:'#'+eventTag):'';
 if(official&&!postTags.includes(official))errors.push('OFFICIAL_EVENT_HASHTAG_MISSING');
 const unverified=postTags.filter(tag=>tag!=='#เช่ามือถือ'&&!verified.includes(tag));if(unverified.length)errors.push('UNVERIFIED_HASHTAG_USED:'+unverified.join(','));
 const reach=postTags.filter(tag=>tag!=='#เช่ามือถือ'&&tag!==official);if(reach.length>5)errors.push('TOO_MANY_REACH_HASHTAGS');
 return {post_hashtags:postTags,verified_hashtags:verified,errors};
}
function validateDuplicateFacts(post,input={}){
 const errors=[],dates=dateTokens(input),venues=venueTokens(input);
 for(const d of dates){if(occurrences(post,d)>1)errors.push('DUPLICATE_DATE:'+d);}
 for(const v of venues){if(occurrences(post,v)>1)errors.push('DUPLICATE_VENUE:'+v);}
 return {dates,venues,errors};
}
function validateStandardA(post,input={}){
 const errors=[],p=text(post),brand='📱 KK Phone Rental | #เช่ามือถือ';
 if(!p.startsWith(brand))errors.push('STANDARD_A_BRAND_NOT_FIRST');
 const eventTag=text(input.official_event_hashtag);
 if(eventTag){const b=p.indexOf(brand),e=p.indexOf(eventTag),price=p.search(/vivo\s+X300\s+Pro/i);if(e<0)errors.push('STANDARD_A_EVENT_HASHTAG_MISSING');else if(price>=0&&!(b<=e&&e<price))errors.push('STANDARD_A_EVENT_HASHTAG_ORDER');}
 if(!/👉\s*จองคิว\s*\/\s*เช็กคิวว่าง/.test(p))errors.push('BOOKING_CTA_MISSING');
 return {errors};
}
function validatePost(post,input={}){
 const errors=[];if(!text(post))errors.push('POST_EMPTY');if(input.verified_event!==true)errors.push('EVENT_NOT_VERIFIED');if(input.verified_pricing!==true)errors.push('PRICING_NOT_VERIFIED');if(input.inventory_available!==true)errors.push('INVENTORY_NOT_CONFIRMED_AVAILABLE');
 const h=validateHashtags(post,input);errors.push(...h.errors);const d=validateDuplicateFacts(post,input);errors.push(...d.errors);const s=validateStandardA(post,input);errors.push(...s.errors);
 return {schema_version:VERSION,gate:errors.length?'BLOCKED':'PASS',publishable:errors.length===0,owner_review_required:true,errors:uniq(errors),hashtag_check:h,duplicate_fact_check:d,standard_a_check:s,safety:SAFETY};
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
 if(results.length!==3) errors.push('DIRECT_RENTAL_REQUIRES_EXACTLY_3_INTERNAL_CANDIDATES');
 const uniqueCopies=new Set(copies.map(x=>normalizeToken(x)).filter(Boolean));
 if(copies.length===3&&uniqueCopies.size!==3) errors.push('DUPLICATE_INTERNAL_CANDIDATE_COPY');
 const objectCandidates=list.filter(x=>x&&typeof x==='object');
 if(objectCandidates.length===3){
   const angles=objectCandidates.map(x=>text(x.angle).toLowerCase());
   if(angles.some(x=>!x)) errors.push('CANDIDATE_ANGLE_MISSING');
   else if(new Set(angles).size!==3) errors.push('DUPLICATE_INTERNAL_CANDIDATE_ANGLE');
 }
 results.forEach((r,i)=>r.errors.forEach(e=>errors.push('CANDIDATE_'+(i+1)+':'+e)));
 return {schema_version:VERSION,gate:errors.length?'BLOCKED':'PASS',publishable:errors.length===0,errors,results,safety:SAFETY};
}
module.exports={VERSION,SAFETY,hashtags,dateTokens,venueTokens,occurrences,verifiedHashtagSet,validateHashtags,validateDuplicateFacts,validateStandardA,validatePost,candidateCopy,validateVariants};
