const VERSION='kk-scanner-trigger-v1';
const ROLE='SCANNER';
const SOURCE='CLOUDFLARE_CRON';
const BANGKOK_OFFSET_MS=7*60*60*1000;

function bangkokIso(ms){
  return new Date(ms+BANGKOK_OFFSET_MS).toISOString().replace('Z','+07:00');
}

function occurrenceId(scheduledAt){
  return `SCANNER|${scheduledAt}`;
}

function canonical(envelope){
  return [
    envelope.version,
    envelope.role,
    envelope.occurrence_id,
    envelope.scheduled_at,
    envelope.issued_at,
    envelope.nonce,
    envelope.source
  ].join('\n');
}

async function hmacHex(secret,message){
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name:'HMAC',hash:'SHA-256'},
    false,
    ['sign']
  );
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(message));
  return [...new Uint8Array(signature)].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export async function buildSignedTrigger({scheduledTime,nowMs=Date.now(),secret,nonce=crypto.randomUUID()}){
  if(!secret) throw new Error('KK_SCANNER_SHARED_SECRET is required');
  const scheduled_at=bangkokIso(scheduledTime);
  const envelope={
    version:VERSION,
    role:ROLE,
    occurrence_id:occurrenceId(scheduled_at),
    scheduled_at,
    issued_at:bangkokIso(nowMs),
    nonce,
    source:SOURCE
  };
  const signature=await hmacHex(secret,canonical(envelope));
  return {envelope,signature};
}

export default {
  async scheduled(controller,env){
    if(controller.cron!=='0 * * * *') return;
    if(!env.KK_SCANNER_DISPATCH_URL) throw new Error('KK_SCANNER_DISPATCH_URL is required');
    if(!env.KK_SCANNER_SHARED_SECRET) throw new Error('KK_SCANNER_SHARED_SECRET is required');

    const {envelope,signature}=await buildSignedTrigger({
      scheduledTime:controller.scheduledTime,
      secret:env.KK_SCANNER_SHARED_SECRET
    });

    const response=await fetch(env.KK_SCANNER_DISPATCH_URL,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-kk-scanner-signature':signature
      },
      body:JSON.stringify(envelope)
    });

    if(!response.ok){
      const body=await response.text().catch(()=> '');
      throw new Error(`KK scanner witness rejected: HTTP ${response.status} ${body.slice(0,200)}`);
    }
  }
};
