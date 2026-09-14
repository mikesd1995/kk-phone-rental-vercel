'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('./lib/admin-session.js');

let cachedHtml='';

function loadHtml(){
  if(cachedHtml) return cachedHtml;
  const file=path.join(process.cwd(),'admin','index.html');
  const source=fs.readFileSync(file,'utf8');
  const marker='<script src="/admin/snapshot-health.js?v=resilience-1"></script>';
  if(!source.includes(marker)) throw new Error('Admin bootstrap marker not found');
  cachedHtml=source.replace(marker,'<script src="/admin/session-bridge.js?v=auth-gate-1"></script>\n  '+marker);
  return cachedHtml;
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

  if(!auth.hasValidSession(req)){
    res.statusCode=307;
    res.setHeader('Location','/admin');
    return res.end();
  }

  let html;
  try{ html=loadHtml(); }
  catch(_){
    res.statusCode=500;
    return res.end('Admin workspace unavailable');
  }

  res.statusCode=200;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(req.method==='HEAD') return res.end();
  return res.end(html);
};

module.exports._test={loadHtml};
