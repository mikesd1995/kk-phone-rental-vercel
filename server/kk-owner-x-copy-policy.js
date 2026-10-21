'use strict';

// Fail-closed owner policy for direct-rental X drafts routed through the Agent bridges.
const VERSION='KK_OWNER_X_COPY_POLICY_V1';
const CTA_STYLE='lead_then_book_link';
const HISTORY_SOURCES=Object.freeze(['confirmed_x','confirmed_x_and_chat','chat_drafts']);

function text(value){return String(value===undefined||value===null?'':value).trim();}
function isDirectRental(message=''){
 const m=text(message).toLowerCase();
 return (/(?:ปล่อยเช่า|เช่ามือถือ).*(?:โพส|โพสต์|x|twitter)|(?:โพส|โพสต์).*(?:ปล่อยเช่า|เช่ามือถือ)|rental.*(?:post|copy).*(?:x|twitter)/iu.test(m));
}
function validateRequest(request={}){
 const errors=[];
 if(!isDirectRental(request.message))return {pass:true,errors,applicable:false,version:VERSION};
 const input=request.input&&typeof request.input==='object'?request.input:{};
 if(text(input.cta_style)!==CTA_STYLE)errors.push('OWNER_X_CTA_STYLE_REQUIRED');
 if(input.recent_context_checked!==true)errors.push('OWNER_X_RECENT_HISTORY_CHECK_REQUIRED');
 if(!HISTORY_SOURCES.includes(text(input.recent_context_source)))errors.push('OWNER_X_HISTORY_SOURCE_REQUIRED');
 if(!Array.isArray(input.recent_posts)||input.recent_posts.filter(x=>text(typeof x==='object'?x.copy||x.text||x.hook:x)).length===0)errors.push('OWNER_X_RECENT_COPY_REQUIRED');
 const anchors=[...(Array.isArray(input.event_dna)?input.event_dna:[]),...(Array.isArray(input.creative_anchors)?input.creative_anchors:[])].map(text).filter(Boolean);
 if(new Set(anchors).size<2)errors.push('OWNER_X_TWO_VERIFIED_EVENT_DNA_REQUIRED');
 if(['confirmed_x','confirmed_x_and_chat'].includes(text(input.recent_context_source))){
   const urls=Array.isArray(input.recent_post_urls)?input.recent_post_urls:[];
   if(!urls.some(x=>/^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/u.test(text(x))))errors.push('OWNER_X_CONFIRMED_POST_LINK_REQUIRED');
 }
 return {pass:errors.length===0,errors,applicable:true,version:VERSION};
}
module.exports={VERSION,CTA_STYLE,HISTORY_SOURCES,isDirectRental,validateRequest};