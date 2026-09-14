import { next } from '@vercel/functions';

const COOKIE_NAME='__Host-kk_admin_session';
const MAX_TTL_SECONDS=8*60*60;

function cookieValue(header:string,name:string){
  for(const part of String(header||'').split(';')){
    const i=part.indexOf('=');
    if(i<0) continue;
    if(part.slice(0,i).trim()===name) return part.slice(i+1).trim();
  }
  return '';
}

function hex(bytes:ArrayBuffer){
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function safeEqual(a:string,b:string){
  if(a.length!==b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

async function verify(token:string){
  const keyText=String(process.env.KK_ADMIN_SESSION_SECRET||process.env.KK_ADMIN_PIN||'').trim();
  if(!keyText) return false;
  const parts=String(token||'').trim().split('.');
  if(parts.length!==3||parts[0]!=='v1') return false;
  const exp=Number(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(exp)||exp<=now||exp>now+MAX_TTL_SECONDS+60) return false;
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(keyText),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,enc.encode(`kk-admin:v1:${exp}`));
  return safeEqual(parts[2],hex(sig));
}

export default async function middleware(request:Request){
  const url=new URL(request.url);
  if(url.pathname==='/admin'||url.pathname==='/admin/') return next();

  const token=cookieValue(request.headers.get('cookie')||'',COOKIE_NAME);
  if(!(await verify(token))){
    const login=new URL('/admin',request.url);
    login.search='';
    return new Response(null,{
      status:307,
      headers:{
        Location:login.toString(),
        'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
        'X-Robots-Tag':'noindex, nofollow, noarchive'
      }
    });
  }
  return next();
}

export const config={
  matcher:['/admin','/admin/:path*']
};
