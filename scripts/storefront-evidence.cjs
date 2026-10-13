'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const Gateway=require('../server/kk-agent-gateway.js');

function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function cardColumnGeometry(rects=[],tolerance=4){
  const valid=(Array.isArray(rects)?rects:[])
    .filter(r=>r&&Number.isFinite(Number(r.left))&&Number.isFinite(Number(r.width))&&Number(r.width)>0)
    .map(r=>({left:Number(r.left),width:Number(r.width)}))
    .sort((a,b)=>a.left-b.left);
  const clusters=[];
  for(const rect of valid){
    let cluster=clusters.find(col=>Math.abs(rect.left-col.left)<=tolerance);
    if(!cluster){cluster={left:rect.left,lefts:[],widths:[]};clusters.push(cluster);}
    cluster.lefts.push(rect.left);
    cluster.widths.push(rect.width);
    cluster.left=cluster.lefts.reduce((sum,v)=>sum+v,0)/cluster.lefts.length;
  }
  const median=values=>{
    const sorted=[...values].sort((a,b)=>a-b);
    const mid=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  };
  clusters.sort((a,b)=>a.left-b.left);
  return {
    card_columns:clusters.length,
    column_widths:clusters.map(col=>median(col.widths))
  };
}
function imageResponseCache(){
  const responses=new Map();
  return {
    remember(url,status,headers,body){
      // Restore normal image cache semantics disabled by Playwright API routing.
      // Keep only successfully delivered image bytes from the same URL in this run.
      if(status!==200||!/^image\//i.test(headers['content-type']||'')||!body.length)return false;
      if(responses.has(url))return true; // Replayed responses must not rewrite origin retrieval evidence.
      responses.set(url,{body,contentType:headers['content-type'],sha256:hash(body),retrieved_at:new Date().toISOString()});return true;
    },
    get:url=>responses.get(url),
    evidence:()=>Array.from(responses,([url,{sha256,retrieved_at,body}])=>({url,sha256,retrieved_at,bytes:body.length}))
  };
}
function frontendIdentity(root=process.cwd()){
  // Include all checked-in visual assets, not merely three previously approved blobs.
  const files=execFileSync('git',['ls-files','-z','index.html','style.css','script.js','config.js','assets'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  const blobs=Object.fromEntries(files.sort().map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
  return {algorithm:'sha256',files:blobs,digest:hash(JSON.stringify(blobs))};
}
function ownerApprovalValid(record,identity,widths,captured=[]){
  return record?.status==='PASS' && record.owner_decision==='ACCEPTED' &&
    record.acceptance_scope==='rendered_candidate' && record.frontend_digest===identity.digest &&
    widths.every(width=>['top','catalogue','modal','footer','dark','english','english-modal','dark-modal'].every(state=>
      record.artifacts?.some(x=>x.width===width&&x.state===state&&typeof x.sha256==='string'&&/^[a-f0-9]{64}$/.test(x.sha256)&&captured.some(y=>y.width===width&&y.state===state&&y.sha256===x.sha256))));
}
async function invokeWithEvidence(intent,input,{outputDir,sourceSha,identity}){
  const dir=path.join(outputDir,'invocations');fs.mkdirSync(dir,{recursive:true});
  const result=await Gateway.executeAgentRequest({task_type:intent,input,correlation_id:hash(JSON.stringify({intent,input,sourceSha,identity:identity.digest}))},{
    // Explicitly local: never use runtime credentials or write the production ledger.
    env:{},
    ledgerFn:async row=>{
      const record={...row,source_commit_sha:sourceSha,evidence_scope:'LOCAL_ARTIFACT',frontend_digest:identity.digest};
      const file=path.join(dir,record.invocation_id+'.json');
      const bytes=JSON.stringify({record,input},null,2)+'\n';
      fs.writeFileSync(file,bytes);
      if(fs.readFileSync(file,'utf8')!==bytes) throw Error('LOCAL_INVOCATION_READBACK_MISMATCH');
      return {ok:true,persistent:true,readback_verified:true,scope:'LOCAL_ARTIFACT',invocation_id:record.invocation_id,source_commit_sha:sourceSha,frontend_digest:identity.digest,sha256:hash(bytes),file:path.relative(outputDir,file)};
    }
  });
  if(result.status!=='RECORDED'||result.ledger?.readback_verified!==true||!result.invocation_check?.pass) throw Error('GATEWAY_EVIDENCE_INCOMPLETE:'+intent);
  const outputFile=path.join(dir,result.invocation.invocation_id+'-result.json');
  fs.writeFileSync(outputFile,JSON.stringify(result,null,2)+'\n');
  return result;
}

async function settle(page){
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  // Check after every re-render and scroll, including lazy-loaded catalogue images.
  await page.waitForFunction(()=>Array.from(document.images).filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}).every(img=>img.complete&&img.naturalWidth>0),{},{timeout:25000}).catch(()=>{});
  await page.evaluate(async()=>Promise.all(Array.from(document.images).filter(img=>img.complete&&img.naturalWidth>0).map(img=>img.decode().catch(()=>{}))));
  return page.evaluate(()=>Array.from(document.images).filter(img=>{const r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}).filter(img=>!img.complete||!img.naturalWidth).map(img=>img.currentSrc||img.src));
}

async function inspectState(page){
  return page.evaluate(()=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const raw=[...new Set((document.body.innerText.match(/\b(?:journey|proof|events|filter|footer|modal|faq|hero|card|search|tap|theme|book|package|no|date|available)_[a-z0-9_]+\b/gi)||[]))];
    const cards=[...document.querySelectorAll('.concert-card:not(.skeleton-card)')].filter(visible);
    const first=cards[0]?.getBoundingClientRect();
    const cardRects=cards.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});
    const cardHeights=cardRects.map(r=>r.height).filter(Number.isFinite);
    const cardHeightSpread=cardHeights.length?Math.max(...cardHeights)-Math.min(...cardHeights):0;
    const posterFrameRatios=cards.map(card=>{
      const wrap=card.querySelector('.poster-img-wrap');
      if(!wrap)return null;
      const r=wrap.getBoundingClientRect();
      return r.height>0?Number((r.width/r.height).toFixed(3)):null;
    }).filter(v=>Number.isFinite(v));
    const posterSourceIssues=cards.flatMap(card=>{
      const source=String(card.dataset.posterSource||'').trim();
      return /(?:^|\/)image\.thum\.io\//i.test(source)?[{
        event_id:card.dataset.eventId||'',
        event_name:card.dataset.eventName||'',
        poster_source:source,
        reason:'webpage_screenshot_service'
      }]:[];
    });
    const posterFitIssues=cards.flatMap(card=>{
      const img=card.querySelector('.poster-img-wrap img');
      if(!img||!img.complete||!img.naturalWidth||!img.naturalHeight)return [];
      const fit=getComputedStyle(img).objectFit;
      return fit==='contain'?[]:[{
        event_id:card.dataset.eventId||'',
        event_name:card.dataset.eventName||'',
        object_fit:fit
      }];
    });
    const posterTreatmentIssues=cards.flatMap(card=>{
      const wrap=card.querySelector('.poster-img-wrap');
      const img=wrap&&wrap.querySelector('img');
      if(!wrap||!img||!img.complete||!img.naturalWidth||!img.naturalHeight)return [];
      const wr=wrap.getBoundingClientRect();
      const fit=getComputedStyle(img).objectFit;
      if(fit!=='contain'||!wr.width||!wr.height)return [];
      const scale=Math.min(wr.width/img.naturalWidth,wr.height/img.naturalHeight);
      const coverage=((img.naturalWidth*scale)*(img.naturalHeight*scale))/(wr.width*wr.height);
      const bg=getComputedStyle(wrap).getPropertyValue('--poster-bg').trim();
      const treated=wrap.classList.contains('poster-has-image')&&bg&&bg!=='none';
      return coverage<0.86&&!treated?[{
        event_id:card.dataset.eventId||'',
        event_name:card.dataset.eventName||'',
        coverage:Number(coverage.toFixed(3)),
        object_fit:fit,
        treatment:'missing'
      }]:[];
    });
    const escaped=[];
    for(const card of cards){const c=card.getBoundingClientRect();for(const el of card.querySelectorAll('.poster-img-wrap,.poster-info,.pi-date,.pi-name,.pi-venue,.pi-price,.pi-avail,.pi-tap,.status-badge')){const r=el.getBoundingClientRect();if(r.left<c.left-1||r.right>c.right+1||r.top<c.top-1||r.bottom>c.bottom+1)escaped.push(el.className);}}
    const modal=document.querySelector('.overlay.active .modal,.faq-overlay.active .modal');
    const scope=modal||document;
    const targets=[...scope.querySelectorAll('button,a[href],input,select')].filter(visible).filter(el=>!el.classList.contains('skip-link'));
    const small=targets.map(el=>({id:el.id||el.className,...box(el)})).filter(r=>r.width<43.9||r.height<43.9);
    const clipped=targets.filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1;}).map(el=>el.id||el.className);
    const filters=[...document.querySelectorAll('.status-filter-bar > *')].filter(visible).map(box);
    const overlappingFilters=filters.some((r,i)=>i>0&&r.left<filters[i-1].right-1);
    const modalImg=modal&&modal.querySelector('.modal-poster-wrap img');
    const modalPosterFitIssues=modalImg&&modalImg.complete&&modalImg.naturalWidth>0&&modalImg.naturalHeight>0&&getComputedStyle(modalImg).objectFit!=='contain'
      ?[{object_fit:getComputedStyle(modalImg).objectFit,title:modal.querySelector('.modal-title')?.textContent||''}]:[];
    const mb=modal?box(modal):null;
    return {scroll_y:scrollY,raw_i18n_keys:raw,document_width:document.documentElement.scrollWidth,viewport_width:innerWidth,
      card_rects:cardRects,card_height_spread_px:Number(cardHeightSpread.toFixed(2)),poster_frame_ratios:posterFrameRatios,
      escaped_card_elements:escaped,poster_source_issues:posterSourceIssues,poster_fit_issues:posterFitIssues,modal_poster_fit_issues:modalPosterFitIssues,poster_treatment_issues:posterTreatmentIssues,
      first_event_top:first?first.top+scrollY:null,visible_event_cards_above_fold:cards.filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).length,
      small_targets:small,clipped_controls:clipped,overlapping_filters:overlappingFilters,theme_icons:[...document.querySelectorAll('.theme-toggle span')].filter(visible).length,
      modal:mb?{...mb,scroll_width:modal.scrollWidth,client_width:modal.clientWidth,viewport_height:innerHeight,focus_inside:modal.contains(document.activeElement),title:modal.querySelector('.modal-title')?.textContent||'',package_count:modal.querySelectorAll('.phone-row').length}:null,
      failed_posters:cards.filter(el=>el.dataset.posterFailed==='1').length,
      failed_poster_details:cards.filter(el=>el.dataset.posterFailed==='1').map(el=>({
        event_id:el.dataset.eventId||'',
        event_name:el.dataset.eventName||'',
        poster_source:el.dataset.posterSource||'',
        fallback_mode:el.dataset.posterFallback||'',
        fallback_visible:Boolean(el.querySelector('.poster-placeholder-event'))
      }))};
  }).then(state=>{
    const geometry=cardColumnGeometry(state.card_rects||[]);
    delete state.card_rects;
    return {...state,...geometry};
  });
}
function stateFindings(state,{width,name}){
  const findings=[],add=(code,evidence)=>findings.push({code,severity:'P1',evidence,action:'Resolve rendered '+name+' state before acceptance.'});
  if(state.document_width>width+1)add('STATE_HORIZONTAL_OVERFLOW',name);
  if(state.raw_i18n_keys.length)findings.push({code:'RAW_I18N_KEY_VISIBLE',severity:'P0',evidence:state.raw_i18n_keys.join(', '),action:'Resolve localization.'});
  if(state.small_targets.length)add('PRIMARY_TARGET_TOO_SMALL',JSON.stringify(state.small_targets));
  if(state.clipped_controls?.length)add('CONTROL_CLIPPED',state.clipped_controls.join(', '));
  if(state.overlapping_filters)add('FILTER_TARGETS_OVERLAP',name);
  if(!state.modal){
    if(state.card_columns!==(width<359?1:2))add('CARD_COLUMNS_CONTRACT',String(state.card_columns));
    if(Math.max(...state.column_widths)-Math.min(...state.column_widths)>1)add('CARD_COLUMNS_UNEQUAL',JSON.stringify(state.column_widths));
    if(width>=901&&Number(state.card_height_spread_px||0)>1.5)add('CARD_HEIGHT_MISMATCH',String(state.card_height_spread_px));
    if(width>=901&&(state.poster_frame_ratios||[]).some(r=>r<0.72||r>0.79))add('POSTER_FRAME_RATIO_MISMATCH',JSON.stringify(state.poster_frame_ratios));
    if(state.escaped_card_elements.length)add('CARD_CONTENT_ESCAPES',state.escaped_card_elements.join(','));
    if(state.poster_source_issues?.length)add('POSTER_SOURCE_NOT_ARTWORK',JSON.stringify(state.poster_source_issues));
    if(state.poster_fit_issues?.length)add('POSTER_ARTWORK_CROPPED',JSON.stringify(state.poster_fit_issues));
    if(state.poster_treatment_issues?.length)add('POSTER_LETTERBOX_UNTREATED',JSON.stringify(state.poster_treatment_issues));
    if(state.theme_icons!==1)add('THEME_ICON_STATE',String(state.theme_icons));
  }else{
    const m=state.modal;
    if(state.modal_poster_fit_issues?.length)add('MODAL_POSTER_ARTWORK_CROPPED',JSON.stringify(state.modal_poster_fit_issues));
    if(m.left<0||m.right>width+1||m.top<0||m.bottom>m.viewport_height+1||m.scroll_width>m.client_width+1)add('MODAL_VIEWPORT_CONTAINMENT',JSON.stringify(m));
    if(!m.focus_inside)add('MODAL_FOCUS_ESCAPED',name);
    if(!m.title.trim())add('MODAL_EVENT_IDENTITY_MISSING',name);
    if(width<=700&&Math.abs(m.bottom-m.viewport_height)>1)add('MOBILE_SHEET_NOT_ANCHORED',name);
  }
  return findings;
}
module.exports={hash,cardColumnGeometry,imageResponseCache,frontendIdentity,ownerApprovalValid,invokeWithEvidence,settle,inspectState,stateFindings};
