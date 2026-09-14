'use strict';

const fs=require('fs');
const path=require('path');
const auth=require('./lib/admin-session.js');

const ADMIN_ROOT=path.resolve(process.cwd(),'admin');
const TYPES={
  '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.woff':'font/woff',
  '.woff2':'font/woff2'
};

function cleanRelative(input){
  const value=Array.isArray(input) ? input.join('/') : String(input||'');
  let decoded=value;
  try{ decoded=decodeURIComponent(value); }catch(_){ return ''; }
  decoded=decoded.replace(/^\/+/, '');
  if(!decoded || decoded.includes('\0') || decoded.includes('\\')) return '';
  const normalized=path.posix.normalize(decoded);
  if(normalized==='.' || normalized==='..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return '';
  return normalized;
}

function contentType(file){
  return TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function redirect(res,to){
  res.statusCode=307;
  res.setHeader('Location',to);
  return res.end();
}

module.exports=function handler(req,res){
  auth.noStore(res);
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Frame-Options','DENY');

  if(req.method!=='GET' && req.method!=='HEAD'){
    res.statusCode=405;
    res.setHeader('Allow','GET, HEAD');
    return res.end('Method not allowed');
  }

  if(!auth.hasValidSession(req)) return redirect(res,'/admin');

  const rel=cleanRelative(req.query && req.query.path);
  if(!rel){ res.statusCode=404; return res.end('Not found'); }
  if(rel==='index.html') return redirect(res,'/admin/app');

  const file=path.resolve(ADMIN_ROOT,rel);
  if(file===ADMIN_ROOT || !file.startsWith(ADMIN_ROOT+path.sep)){
    res.statusCode=404;
    return res.end('Not found');
  }

  let stat;
  try{ stat=fs.statSync(file); }
  catch(_){ res.statusCode=404; return res.end('Not found'); }
  if(!stat.isFile()){
    res.statusCode=404;
    return res.end('Not found');
  }

  const type=contentType(file);
  res.statusCode=200;
  res.setHeader('Content-Type',type);
  if(type.startsWith('text/html')){
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  if(req.method==='HEAD') return res.end();
  return fs.createReadStream(file).pipe(res);
};

module.exports._test={cleanRelative,contentType,ADMIN_ROOT};
