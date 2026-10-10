'use strict';
// Private, zero-public-URL LINE image archive for the governed Admin Inbox.
// Never forward a LINE access token or Supabase service key to the browser.
const VERSION='KK_INBOX_PRIVATE_LINE_IMAGES_V1';
const BUCKET='kk-inbox-media';
const MAX_BYTES=8*1024*1024;
function error(code,status=502){return Object.assign(new Error(code),{code,status});}
function config(options={}){
 const url=String(options.url||process.env.KK_INBOX_SUPABASE_URL||'').trim().replace(/\/$/,'');
 const key=String(options.serviceKey||process.env.KK_INBOX_SUPABASE_SERVICE_ROLE_KEY||'').trim();
 const token=String(options.token||process.env.LINE_CHANNEL_ACCESS_TOKEN||'').trim();
 if(!/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(url)||!key)throw error('INBOX_MEDIA_STORE_UNAVAILABLE',503);
 return {url,key,token,fetchImpl:options.fetchImpl||fetch};
}
function pathFor(id){
 if(!/^msg_[a-f0-9]{24}$/.test(String(id||'')))throw error('INBOX_MEDIA_ID_INVALID',400);
 return 'line/'+id;
}
function imageType(data){
 if(data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff)return 'image/jpeg';
 if(data.length>=8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(data.length>=6&&['GIF87a','GIF89a'].includes(data.subarray(0,6).toString('ascii')))return 'image/gif';
 if(data.length>=12&&data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return 'image/webp';
 throw error('INBOX_MEDIA_UNSAFE_TYPE',415);
}
async function checkedBytes(response){
 const length=Number(response.headers?.get?.('content-length')||0);
 if(length>MAX_BYTES)throw error('INBOX_MEDIA_TOO_LARGE',413);
 // Abort streaming once the limit is exceeded, even if upstream omits Content-Length.
 if(response.body?.getReader){
  const reader=response.body.getReader(),pieces=[];let size=0;
  try{
   while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;
    if(size>MAX_BYTES)throw error('INBOX_MEDIA_TOO_LARGE',413);
    pieces.push(Buffer.from(r.value));
   }
  }finally{try{await reader.cancel()}catch(_){}}
  if(!size)throw error('INBOX_MEDIA_EMPTY',502);
  return Buffer.concat(pieces,size);
 }
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!bytes.length)throw error('INBOX_MEDIA_EMPTY',502);
 if(bytes.length>MAX_BYTES)throw error('INBOX_MEDIA_TOO_LARGE',413);
 return bytes;
}
async function downloadFromLine(providerMessageId,options={}){
 const {token,fetchImpl}=config(options);
 const id=String(providerMessageId||'').trim();
 if(!token||!/^\d{1,40}$/.test(id))throw error('INBOX_LINE_MEDIA_ID_MISSING',404);
 const response=await fetchImpl('https://api-data.line.me/v2/bot/message/'+encodeURIComponent(id)+'/content',{
  headers:{Authorization:'Bearer '+token,'User-Agent':'KK-Inbox-Media/1.0'},
  signal:AbortSignal.timeout(8500)
 });
 if(!response.ok)throw error(response.status===404||response.status===410?'INBOX_LINE_MEDIA_EXPIRED':'INBOX_LINE_MEDIA_DOWNLOAD_FAILED',response.status===404||response.status===410?404:502);
 const bytes=await checkedBytes(response);
 return {bytes,mime:imageType(bytes)};
}
async function upload(id,media,options={}){
 const {url,key,fetchImpl}=config(options),path=pathFor(id);
 const response=await fetchImpl(url+'/storage/v1/object/'+BUCKET+'/'+path,{
  method:'POST',
  headers:{Authorization:'Bearer '+key,apikey:key,'Content-Type':media.mime,'x-upsert':'true','Cache-Control':'private, max-age=0'},
  body:media.bytes,
  signal:AbortSignal.timeout(8500)
 });
 if(!response.ok)throw error('INBOX_MEDIA_ARCHIVE_FAILED',502);
 return {saved:true};
}
async function readArchived(id,options={}){
 const {url,key,fetchImpl}=config(options),path=pathFor(id);
 const response=await fetchImpl(url+'/storage/v1/object/authenticated/'+BUCKET+'/'+path,{
  headers:{Authorization:'Bearer '+key,apikey:key},
  signal:AbortSignal.timeout(8500)
 });
 if(response.status===404)return null;
 if(!response.ok)throw error('INBOX_MEDIA_READ_FAILED',502);
 const bytes=await checkedBytes(response);
 return {bytes,mime:imageType(bytes),source:'archive'};
}
async function capture(event,message,options={}){
 if(message?.channel!=='line'||message?.message_type!=='image')return {skipped:true};
 const provider=event?.message||{};
 if(provider.contentProvider?.type==='external')throw error('INBOX_LINE_EXTERNAL_IMAGE_UNSUPPORTED',422);
 const media=await downloadFromLine(provider.id,options);
 await upload(message.message_id,media,options);
 return {saved:true,bytes:media.bytes.length};
}
async function readOrRecover(metadata,options={}){
 const id=metadata?.message_id;
 let image=await readArchived(id,options);
 if(image)return image;
 // If archiving failed temporarily, recover while LINE still retains the image.
 const providerId=metadata?.provider_message_id;
 if(!providerId)throw error('INBOX_MEDIA_NOT_ARCHIVED',404);
 image=await downloadFromLine(providerId,options);
 await upload(id,image,options);
 return {...image,source:'recovered'};
}
module.exports={VERSION,BUCKET,MAX_BYTES,pathFor,imageType,checkedBytes,downloadFromLine,upload,readArchived,capture,readOrRecover};
