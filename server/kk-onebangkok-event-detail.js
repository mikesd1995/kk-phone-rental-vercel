'use strict';

const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW=new Set(['script','style','textarea','xmp','iframe','noembed','noscript']);
const TRACKING=new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id']);
const MAX_BYTES=1024*1024,MAX_NODES=20000,MAX_DEPTH=128;
function text(value){return String(value==null?'':value).trim();}
function publicEventUrl(value){
 try{
  const raw=text(value);
  // URL normalizes default ports and dot segments: reject them before parsing.
  if(!/^https:\/\/(?:www\.)?onebangkok\.com\//.test(raw))return null;
  const rawPath=raw.replace(/^https:\/\/[^/]+/,'').split(/[?#]/)[0];
  if(!/^\/(?:en|th)\/whats-happening\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(rawPath))return null;
  if(/(?:^|\/)(?:account|auth|login|logout|checkout|orders?|payment|queue|step|vieworders)(?:[/.-]|$)/i.test(rawPath))return null;
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['onebangkok.com','www.onebangkok.com'].includes(u.hostname)||u.pathname!==rawPath)return null;
  for(const [key] of u.searchParams)if(!TRACKING.has(key.toLowerCase()))return null;
  u.search='';u.hash='';return u.toString();
 }catch(_){return null;}
}
function attributes(raw,cleanHtml){
 const out={};let pos=0;
 while(pos<raw.length){
  while(/\s/.test(raw[pos]||'')&&pos<raw.length)pos++;
  if(pos>=raw.length)break;
  const match=raw.slice(pos).match(/^([^\s=/'"<>`]+)/);
  if(!match)return null;
  const key=match[1].toLowerCase();pos+=match[0].length;
  if(Object.hasOwn(out,key))return null;
  while(/\s/.test(raw[pos]||'')&&pos<raw.length)pos++;
  let value='';
  if(raw[pos]==='='){
   pos++;while(/\s/.test(raw[pos]||'')&&pos<raw.length)pos++;
   const quote=raw[pos];
   if(quote==='"'||quote==="'"){
    const end=raw.indexOf(quote,pos+1);if(end<0)return null;value=raw.slice(pos+1,end);pos=end+1;
   }else{
    const unquoted=raw.slice(pos).match(/^[^\s'"=<>`]+/);if(!unquoted)return null;value=unquoted[0];pos+=value.length;
   }
  }
  out[key]=cleanHtml(value);
 }
 return out;
}
function activeTree(markup,cleanHtml){
 const raw=String(markup||'');
 if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)return null;
 const root={tag:'',attrs:{},children:[],active:true},stack=[root];let cursor=0,count=0;
 while(cursor<raw.length){
  const start=raw.indexOf('<',cursor);
  if(start<0){stack.at(-1).children.push(raw.slice(cursor));cursor=raw.length;break;}
  if(start>cursor)stack.at(-1).children.push(raw.slice(cursor,start));
  if(raw.startsWith('<!--',start)){
   const end=raw.indexOf('-->',start+4);if(end<0)return null;cursor=end+3;continue;
  }
  let end=start+1,quote='';
  for(;end<raw.length;end++){
   const char=raw[end];
   if(quote){if(char===quote)quote='';}
   else if(char==='"'||char==="'")quote=char;
   else if(char==='>')break;
  }
  if(end>=raw.length||quote)return null;
  const tag=raw.slice(start+1,end);cursor=end+1;
  if(/^!doctype\b/i.test(tag))continue;
  const close=tag.match(/^\/\s*([a-z][\w:-]*)\s*$/i);
  if(close){
   const name=close[1].toLowerCase();
   // Official breadcrumb repeats </a>; an unmatched anchor close opens no scope.
   if(name==='a'&&!stack.some(node=>node.tag==='a'))continue;
   if(stack.length===1||stack.at(-1).tag!==name)return null;
   stack.pop();continue;
  }
  const open=tag.match(/^([a-z][\w:-]*)([\s\S]*?)\/?\s*$/i);
  if(!open)return null;
  const name=open[1].toLowerCase(),attrs=attributes(open[2],cleanHtml);if(!attrs)return null;
  // HTML plaintext consumes the rest of the document; no later component is markup.
  if(name==='plaintext')return null;
  if(++count>MAX_NODES||stack.length>MAX_DEPTH)return null;
  const parent=stack.at(-1);
  const inactive=name==='template'||name==='select'||RAW.has(name)||Object.hasOwn(attrs,'hidden')||Object.hasOwn(attrs,'inert')||/^true$/i.test(attrs['aria-hidden']||'')||/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(attrs.style||'');
  const node={tag:name,attrs,children:[],active:parent.active&&!inactive};parent.children.push(node);
  if(RAW.has(name)||name==='title'){
   const closing=new RegExp('<\\/\\s*'+name+'\\s*>','ig');closing.lastIndex=cursor;const match=closing.exec(raw);
   if(!match)return null;
   if(name==='title'&&node.active)node.children.push(raw.slice(cursor,match.index));
   cursor=closing.lastIndex;continue;
  }
  if(!VOID.has(name)){
   // Non-void self-closing syntax is not an HTML closure.
   if(/\/\s*$/.test(tag))return null;
   stack.push(node);
  }
 }
 return stack.length===1?root:null;
}
function nodes(root,predicate){
 const out=[];
 function visit(node){if(typeof node==='string'||!node.active)return;if(predicate(node))out.push(node);for(const child of node.children)visit(child);}
 visit(root);return out;
}
function hasClass(node,name){return text(node.attrs.class).split(/\s+/).includes(name);}
function content(node,cleanHtml){
 const parts=[];
 function visit(value){if(typeof value==='string'){parts.push(value);return;}if(value.active)for(const child of value.children)visit(child);}
 visit(node);return cleanHtml(parts.join(' '));
}
function identity(value){return text(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
function one(rows){return rows.length===1?rows[0]:null;}
function uniqueField(values,normalize=value=>value){
 if(!values.length||values.some(value=>!text(value)))return null;
 const map=new Map(values.map(value=>[normalize(value),value]));return map.size===1?[...map.values()][0]:null;
}
function mainDate(value,inferSearchEventDates){
 const s=text(value);
 // Only one whole labelled date; never salvage a valid fragment from prose or a range.
 if(!/^(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+[A-Za-z]+\.?\s+20\d{2}|[A-Za-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s+20\d{2}|\d{1,2}\s*[\u0E00-\u0E7F.]+\s*(?:(?:พ\.ศ\.|ค\.ศ\.)\s*)?\d{4})$/.test(s))return null;
 const dates=inferSearchEventDates(s);return dates.length===1?dates[0]:null;
}
function mainTime(value){
 const match=text(value).match(/^(\d{1,2})[.:](\d{2})(?:\s*(?:hrs?\.?|hours?)(?:\s+onwards)?)?$/i);
 if(!match||Number(match[1])>23||Number(match[2])>59)return null;
 return match[1].padStart(2,'0')+':'+match[2];
}
function candidateFromOneBangkokPage(url,markup,{cleanHtml,inferSearchEventDates}={}){
 const empty={title:null,event_date:null,event_time:null,venue:null,artist:[],source_url:url,confidence:null};
 try{
  const safe=publicEventUrl(url);if(!safe||typeof cleanHtml!=='function'||typeof inferSearchEventDates!=='function')return empty;
  const tree=activeTree(markup,cleanHtml);if(!tree)return empty;
  const head=one(nodes(tree,node=>node.tag==='head')),main=one(nodes(tree,node=>node.tag==='main'));
  if(!head||!main||nodes(head,node=>node.tag==='main').length)return empty;
  const canon=one(nodes(head,node=>node.tag==='link'&&text(node.attrs.rel).toLowerCase().split(/\s+/).includes('canonical')));
  const template=one(nodes(head,node=>node.tag==='meta'&&text(node.attrs.name).toLowerCase()==='template'));
  const pageTitle=one(nodes(head,node=>node.tag==='title'));
  const canonical=canon&&publicEventUrl(cleanHtml(canon.attrs.href));
  if(!canonical||new URL(canonical).hostname.replace(/^www\./,'')!==new URL(safe).hostname.replace(/^www\./,'')||new URL(canonical).pathname!==new URL(safe).pathname||!template||template.attrs.content!=='event-content'||!pageTitle)return empty;
  const hero=one(nodes(main,node=>node.tag==='section'&&hasClass(node,'mainBreadCrumbMediaSec')));
  const detail=one(nodes(main,node=>node.tag==='section'&&hasClass(node,'richTextIntroWithIcons')&&hasClass(node,'mainContentMediaDetailSec')));
  if(!hero||!detail||nodes(hero,node=>node===detail).length||nodes(detail,node=>node===hero).length)return empty;
  const heading=one(nodes(hero,node=>node.tag==='h3'&&hasClass(node,'titleText')));
  const title=heading&&content(heading,cleanHtml),titleIdentity=identity(title);
  if(!titleIdentity||titleIdentity!==identity(content(pageTitle,cleanHtml)))return empty;
  const box=one(nodes(detail,node=>hasClass(node,'boxShop')));if(!box)return empty;
  const dates=[],times=[],venues=[];
  for(const paragraph of nodes(hero,node=>node.tag==='p')){
   const icons=nodes(paragraph,node=>node.tag==='i'&&(hasClass(node,'icon-ic-calendar')||hasClass(node,'icon-ic-location')));
   if(!icons.length)continue;
   if(icons.length!==1)return empty;
   const value=content(paragraph,cleanHtml);
   if(hasClass(icons[0],'icon-ic-calendar'))dates.push(mainDate(value,inferSearchEventDates));
   else venues.push(value);
  }
  for(const item of nodes(box,node=>node.tag==='li')){
   const icons=nodes(item,node=>node.tag==='img'&&/(?:^|\/)(?:icon-circle-date|icon-circle-time|icon-circle-location)\.png$/.test(node.attrs.src||''));
   if(!icons.length)continue;
   if(icons.length!==1)return empty;
   const src=icons[0].attrs.src,value=content(item,cleanHtml);
   if(src.endsWith('icon-circle-date.png'))dates.push(mainDate(value,inferSearchEventDates));
   if(src.endsWith('icon-circle-time.png'))times.push(mainTime(value));
   if(src.endsWith('icon-circle-location.png'))venues.push(value);
  }
  const eventDate=uniqueField(dates);
  return {...empty,title,event_date:eventDate,event_time:eventDate?uniqueField(times):null,venue:uniqueField(venues,identity)};
 }catch(_){return empty;}
}
module.exports={publicEventUrl,candidateFromOneBangkokPage};
