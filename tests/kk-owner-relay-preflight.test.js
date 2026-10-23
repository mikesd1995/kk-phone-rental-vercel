'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const modulePath=path.join(__dirname,'../scripts/kk-owner-relay-preflight.js');
const Guard=fs.existsSync(modulePath)?require(modulePath):{};
const NOW=Date.parse('2026-10-23T07:00:00.000Z');
const RAW='KKUAT_TG_172098c3-84d1-4864-8d36-230c5ebae0f7';
const TEXT='ทดสอบระบบแจ้งเตือนเจ้าของ KK Phone Rental เพื่อตรวจการเชื่อมต่อเท่านั้น ไม่มีข้อมูลอีเวนต์หรือลูกค้า';
const hash=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
function fixture(text=TEXT){
  const encoded=Buffer.from(RAW,'utf8').toString('base64url');
  const native={consumer_id:'6176241',source_notification_id:RAW,notification_id:'ks1_'+encoded,request_id:'kr1_'+encoded,entity_id:'ke1_'+encoded,
    content_version:'a'.repeat(64),text,text_sha256:hash(text),created_at:'2026-10-23T06:59:30.000Z',expires_at:'2026-10-23T07:01:30.000Z'};
  const envelope={version:'kk-make-owner-transport-v1',audience:'KK_OWNER_TELEGRAM_ONLY',notification_id:native.notification_id,request_id:native.request_id,
    event_type:'OWNER_ALERT',entity_id:native.entity_id,content_version:native.content_version,text,created_at:native.created_at,expires_at:native.expires_at,signature:'b'.repeat(64)};
  return {native,envelope};
}
function check(envelope,native,now=NOW){assert.equal(typeof Guard.assertExactOwnerRelay,'function');return Guard.assertExactOwnerRelay(envelope,native,{now});}
function rejects(f,code=/^OWNER_RELAY_/){assert.throws(f,error=>{assert.match(error.code,code);assert.equal(error.message,error.code);return true;});}
test('local guard returns frozen metadata without modifying or exposing the original capability',()=>{
  const {native,envelope}=fixture(),before=JSON.stringify({native,envelope});const result=check(envelope,native);
  assert.deepEqual(result,{status:'LOCAL_RELAY_MATCH_ONLY',consumer_id:'6176241',source_notification_id:RAW,content_version:native.content_version,text_sha256:native.text_sha256,
    remaining_ms:90000,signature_verified:false,provider_sends:0});
  assert.equal(Object.isFrozen(result),true);assert.equal(JSON.stringify({native,envelope}),before);assert.doesNotMatch(JSON.stringify(result),/signature"|text"|envelope|chat_id|recipient/);
});
test('the actual100-character owner-test payload with debugger-added ellipsis is rejected untouched',()=>{
  const {native,envelope}=fixture();assert.equal(TEXT.length,100);assert.equal(native.text_sha256,'b5a18b1001d1b107dcda420a49fd56bf6838b6cee5f9ff7a89d93f57e4fe628d');
  envelope.text+='\u2026';assert.equal(envelope.text.length,101);rejects(()=>check(envelope,native),/^OWNER_RELAY_TEXT_MISMATCH$/);assert.equal(envelope.text,TEXT+'\u2026');
});
test('a legitimate native ellipsis is accepted exactly without stripping or normalization',()=>{
  const {native,envelope}=fixture(TEXT+'…');assert.equal(check(envelope,native).text_sha256,hash(TEXT+'…'));assert.equal(envelope.text,TEXT+'…');
});
for(const alteration of ['leading','trailing','internal','unicodeNormalization'])test(`captured ${alteration} text alteration is rejected instead of repaired`,()=>{
  const {native,envelope}=fixture(alteration==='unicodeNormalization'?'Café':TEXT);
  if(alteration==='leading')envelope.text=' '+envelope.text;if(alteration==='trailing')envelope.text+=' ';if(alteration==='internal')envelope.text=envelope.text.replace('KK Phone','KK  Phone');
  if(alteration==='unicodeNormalization')envelope.text='Cafe\u0301';const value=envelope.text;rejects(()=>check(envelope,native));assert.equal(envelope.text,value);
});
for(const key of ['version','audience','notification_id','request_id','event_type','entity_id','content_version','text','created_at','expires_at','signature'])test(`missing exact envelope field ${key} rejects`,()=>{
  const {native,envelope}=fixture();delete envelope[key];rejects(()=>check(envelope,native),/^OWNER_RELAY_ENVELOPE_SHAPE_INVALID$/);
});
for(const kind of ['extra','symbol','accessor','nonenumerableExtra','nonenumerableRequired','array','nonplain','null','nonstring'])test(`envelope ${kind} shape cannot cross the local relay`,()=>{
  let {native,envelope}=fixture();let reads=0;
  if(kind==='extra')envelope.recipient='other';if(kind==='symbol')envelope[Symbol('hidden')]='x';
  if(kind==='accessor')Object.defineProperty(envelope,'text',{get(){reads++;return TEXT;},enumerable:true});if(kind==='nonenumerableExtra')Object.defineProperty(envelope,'hidden',{value:'x'});if(kind==='nonenumerableRequired')Object.defineProperty(envelope,'text',{value:TEXT,enumerable:false});
  if(kind==='array')envelope=Object.assign([],envelope);if(kind==='nonplain')envelope=Object.assign(Object.create({inherited:true}),envelope);if(kind==='null')envelope=null;if(kind==='nonstring')envelope.text=[TEXT];
  rejects(()=>check(envelope,native),/^OWNER_RELAY_ENVELOPE_SHAPE_INVALID$/);assert.equal(reads,0);
});
for(const kind of ['missing','extra','accessor','symbol','nonplain','hashDisagrees','consumer','numericConsumer','sourceNotUuid','sourceUppercase','sourceSpace'])test(`native ${kind} fails closed without trusting UI as its own anchor`,()=>{
  let {native,envelope}=fixture();let reads=0;
  if(kind==='missing')delete native.text_sha256;if(kind==='extra')native.approved=true;if(kind==='accessor')Object.defineProperty(native,'text',{get(){reads++;return TEXT;},enumerable:true});
  if(kind==='symbol')native[Symbol('hidden')]='x';if(kind==='nonplain')native=Object.assign(Object.create({inherited:true}),native);if(kind==='hashDisagrees')native.text_sha256='f'.repeat(64);
  if(kind==='consumer')native.consumer_id='6600107';if(kind==='numericConsumer')native.consumer_id=6176241;if(kind==='sourceNotUuid')native.source_notification_id='KKUAT_TG_not-a-uuid';
  if(kind==='sourceUppercase')native.source_notification_id=RAW.toUpperCase();if(kind==='sourceSpace')native.source_notification_id=RAW+' ';
  rejects(()=>check(envelope,native));assert.equal(reads,0);
});
for(const side of ['native','envelope'])for(const key of ['notification_id','request_id','entity_id','content_version','created_at','expires_at'])test(`${side} ${key} must match the immutable native descriptor`,()=>{
  const {native,envelope}=fixture(),target=side==='native'?native:envelope;
  if(key==='content_version')target[key]='c'.repeat(64);else if(key==='created_at')target[key]='2026-10-23T06:59:31.000Z';else if(key==='expires_at')target[key]='2026-10-23T07:01:29.000Z';else target[key]+='_other';
  rejects(()=>check(envelope,native));
});
for(const key of ['version','audience','event_type'])test(`wrong ${key} does not widen the Telegram owner-only relay`,()=>{const {native,envelope}=fixture();envelope[key]='other';rejects(()=>check(envelope,native));});
for(const signature of ['', 'B'.repeat(64),'b'.repeat(63),'b'.repeat(65),'g'.repeat(64)])test(`signature shape ${signature.length}/${signature[0]||'empty'} is rejected without signing`,()=>{
  const {native,envelope}=fixture();envelope.signature=signature;rejects(()=>check(envelope,native),/^OWNER_RELAY_SIGNATURE_SHAPE_INVALID$/);
});
test('shape-only signature acceptance is explicitly not HMAC verification or provider authority',()=>{const {native,envelope}=fixture();envelope.signature='0'.repeat(64);const result=check(envelope,native);assert.equal(result.signature_verified,false);assert.equal(result.provider_sends,0);assert.equal(result.send_allowed,undefined);});
for(const kind of ['expired','longTTL','zeroTTL','futureSkew','noncanonical','invalidCalendar','insufficientMargin','invalidNow'])test(`original descriptor ${kind} is rejected without renewal`,()=>{
  const {native,envelope}=fixture();let now=NOW;
  if(kind==='expired')now=NOW+120000;if(kind==='longTTL')native.expires_at=envelope.expires_at='2026-10-23T07:01:30.001Z';if(kind==='zeroTTL')native.expires_at=envelope.expires_at=native.created_at;
  if(kind==='futureSkew')now=Date.parse(native.created_at)-15001;if(kind==='noncanonical')native.created_at=envelope.created_at='2026-10-23T06:59:30Z';if(kind==='invalidCalendar')native.created_at=envelope.created_at='2026-02-30T06:59:30.000Z';
  if(kind==='insufficientMargin')now=Date.parse(native.expires_at)-44999;if(kind==='invalidNow')now=NaN;
  const before=JSON.stringify({native,envelope});rejects(()=>check(envelope,native,now));assert.equal(JSON.stringify({native,envelope}),before);
});
test('exact45-second remaining margin and15-second future skew boundaries preserve the original timestamps',()=>{
  const {native,envelope}=fixture();assert.equal(check(envelope,native,Date.parse(native.expires_at)-45000).remaining_ms,45000);
  assert.equal(check(envelope,native,Date.parse(native.created_at)-15000).remaining_ms,135000);
});
test('empty, overlong and malformed Unicode text cannot be anchored by replacement-byte hashing',()=>{
  for(const value of ['', 'x'.repeat(2049), '\ud800','\udc00']){const {native,envelope}=fixture(value);rejects(()=>check(envelope,native),/^OWNER_RELAY_TEXT_INVALID$/);}
});
test('matching Unicode and whitespace values are preserved exactly when independently anchored',()=>{
  for(const value of [' Cafe\u0301 … ','ทดสอบ\nบรรทัดที่สอง','😀']){const {native,envelope}=fixture(value);assert.equal(check(envelope,native).text_sha256,hash(value));assert.equal(envelope.text,value);}
});
test('clock options never invoke own accessors or accept hidden override fields',()=>{
  const {native,envelope}=fixture();let reads=0;assert.equal(typeof Guard.assertExactOwnerRelay,'function');
  const options={};Object.defineProperty(options,'now',{get(){reads++;return NOW;},enumerable:true});
  rejects(()=>Guard.assertExactOwnerRelay(envelope,native,options));assert.equal(reads,0);
  rejects(()=>Guard.assertExactOwnerRelay(envelope,native,{now:NOW,min_remaining_ms:0}));
});
