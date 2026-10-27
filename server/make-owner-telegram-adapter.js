'use strict';
// Source definition only. This module never performs a provider request.
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const Wire=require('./make-owner-transport-contract');
const ENDPOINT='https://kk-phone-rental.vercel.app/api/kk-make-owner-notify';
const KIND='make-custom-telegram-response-v1';
const FRAME='KK_TG_CAPTURE_V1';
const frame='KK_TG_CAPTURE_V1|{{temp.grant.dispatch_id}}|{{statusCode}}|{{createJSON(body)}}';
const grantCondition='{{temp.grant.ok === true && temp.grant.send_allowed === true && temp.grant.attempt_id === parameters.attempt_id && temp.grant.receipt_id === parameters.receipt_id && temp.grant.dispatch_id && temp.grant.target_chat_id && temp.grant.target_chat_id === toString(temp.grant.target_chat_id) && length(temp.grant.target_chat_id) >= 4 && length(temp.grant.target_chat_id) <= 26 && temp.grant.text && temp.grant.text === toString(temp.grant.text) && length(trim(temp.grant.text)) > 0 && length(temp.grant.text) <= 2048 && temp.grant.bot_id === toString(connection.botId) && temp.grant.provider_binding_sha256 === parameters.provider_binding_sha256 && parseDate(temp.grant.expires_at) > addSeconds(now, 15)}}';
const gatewayRequest=stage=>({url:ENDPOINT,method:'POST',type:'json',headers:{Authorization:'Bearer {{connection.consumerBearer}}'},body:{stage,envelope_json:'{{parameters.envelope_json}}',attempt_id:'{{parameters.attempt_id}}',receipt_id:'{{parameters.receipt_id}}'},followRedirect:false,followAllRedirects:false,response:{type:'json'}});
const start=gatewayRequest('canonical-dispatch-start');start.body.bot_id='{{toString(connection.botId)}}';start.body.provider_binding_sha256='{{parameters.provider_binding_sha256}}';start.response.valid='{{statusCode === 200 && body.ok === true && body.send_allowed === true && body.dispatch_id && body.target_chat_id && body.target_chat_id === toString(body.target_chat_id) && length(body.target_chat_id) >= 4 && length(body.target_chat_id) <= 26 && body.text && body.text === toString(body.text) && length(trim(body.text)) > 0 && length(body.text) <= 2048 && body.attempt_id === parameters.attempt_id && body.receipt_id === parameters.receipt_id && body.bot_id === toString(connection.botId) && body.provider_binding_sha256 === parameters.provider_binding_sha256}}';start.response.temp={grant:'{{body}}'};start.response.output=null;
const parameters=[{name:'envelope_json',type:'text',required:true},{name:'attempt_id',type:'text',required:true},{name:'receipt_id',type:'text',required:true}];
const report=gatewayRequest('canonical-adapter-result');report.body.outcome_frame='{{parameters.outcome_frame}}';report.response.valid='{{statusCode === 200 && body.ok === true && body.send_allowed === false}}';report.response.output='{{body}}';
const MANIFEST={version:1,kind:KIND,app_prefix:'kk-telegram-response-adapter',runtime_retry_granularity:'REQUIRES_LIVE_NO_PROVIDER_REPLAY_ATTESTATION',
 base:{baseUrl:'https://api.telegram.org',log:{sanitize:['request.url','request.headers.authorization','request.headers.Authorization','request.body','response.body']}},
 connection:{name:'ownerTelegramAdapter',type:'basic',parameters:[{name:'botToken',type:'password',required:true},{name:'consumerBearer',type:'password',required:true}],communication:{url:'https://api.telegram.org/bot{{parameters.botToken}}/getMe',method:'GET',log:{sanitize:['request.url','request.headers.authorization','request.body','response.body']},followRedirect:false,followAllRedirects:false,response:{type:'json',valid:'{{statusCode === 200 && body.ok === true && body.result.is_bot === true}}',data:{botId:'{{body.result.id}}',botToken:'{{parameters.botToken}}',consumerBearer:'{{parameters.consumerBearer}}'},metadata:{type:'text',value:'{{body.result.id}}'}}}},
 module:{name:'sendCapturedMessage',typeId:4,connection:'ownerTelegramAdapter',mappable_parameters:[...parameters,{name:'provider_binding_sha256',type:'text',required:true}],communication:[start,{condition:grantCondition,url:'/bot{{connection.botToken}}/sendMessage',method:'POST',type:'json',headers:{},body:{chat_id:'{{temp.grant.target_chat_id}}',text:'{{temp.grant.text}}'},followRedirect:false,followAllRedirects:false,response:{type:'json',output:{outcome_frame:frame},error:{type:'RuntimeError',message:frame,'429':{type:'RuntimeError',message:frame}}}}],interface:[{name:'outcome_frame',type:'text'}]},
 reporter:{name:'reportCapturedOutcome',typeId:4,connection:'ownerTelegramAdapter',mappable_parameters:[...parameters,{name:'outcome_frame',type:'text',required:true}],communication:report,interface:[{name:'status',type:'text'},{name:'provider_message_id',type:'text'}]}
};
const MANIFEST_SHA256=crypto.createHash('sha256').update(JSON.stringify(MANIFEST)).digest('hex');
function fail(code){throw Object.assign(new Error(code),{code});}
function validateBinding(b){
 if(!Wire.isPlainObject(b)||Object.keys(b).sort().join(',')!=='app_name,bot_id,connection_id,kind,manifest_sha256,module_id'||b.kind!==KIND||!/^kk-telegram-response-adapter-[a-zA-Z0-9_-]{1,80}$/.test(b.app_name||'')||!Number.isSafeInteger(b.module_id)||b.module_id<1||b.module_id===8||!Number.isSafeInteger(b.connection_id)||b.connection_id<1||b.connection_id===10356915||typeof b.bot_id!=='string'||!/^[1-9][0-9]{3,19}$/.test(b.bot_id)||b.manifest_sha256!==MANIFEST_SHA256)fail('CANONICAL_ADAPTER_UNBOUND');return b;
}
function sameBinding(actual,expected){validateBinding(actual);validateBinding(expected);if(!isDeepStrictEqual(actual,expected))fail('CANONICAL_ADAPTER_BINDING_MISMATCH');return actual;}
function bindingDigest(b){validateBinding(b);return crypto.createHash('sha256').update(JSON.stringify([b.kind,b.app_name,b.module_id,b.connection_id,b.bot_id,b.manifest_sha256])).digest('hex');}
function parseFrame(value,dispatchId){
 if(typeof value!=='string'||Buffer.byteLength(value)>16384||!Wire.isReceiptId(dispatchId))fail('CANONICAL_ADAPTER_FRAME_INVALID');
 const parts=value.split('|');if(parts.length<4||parts.shift()!==FRAME||parts.shift()!==dispatchId)fail('CANONICAL_ADAPTER_FRAME_INVALID');const status=parts.shift();if(!/^[1-5][0-9]{2}$/.test(status))fail('CANONICAL_ADAPTER_FRAME_INVALID');
 let body;try{body=JSON.parse(parts.join('|'));}catch(_){fail('CANONICAL_ADAPTER_FRAME_INVALID');}if(!Wire.isPlainObject(body))fail('CANONICAL_ADAPTER_FRAME_INVALID');return {http_status:Number(status),telegram_response:body};
}
module.exports={KIND,FRAME,ENDPOINT,MANIFEST,MANIFEST_SHA256,validateBinding,sameBinding,bindingDigest,parseFrame};
