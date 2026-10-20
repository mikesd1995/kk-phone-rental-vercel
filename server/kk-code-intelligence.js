'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_EXCLUDES = new Set([
  '.git','node_modules','.next','.vercel','coverage','dist','build','.cache'
]);
const TEXT_EXTENSIONS = new Set([
  '.js','.cjs','.mjs','.ts','.tsx','.json','.md','.html','.css','.yml','.yaml','.py','.gs','.toml','.txt'
]);

function posix(value){ return String(value||'').replace(/\\/g,'/'); }
function uniq(values){ return [...new Set((values||[]).filter(Boolean))]; }

function walk(root, dir=''){
  const full=path.join(root,dir);
  const out=[];
  for(const entry of fs.readdirSync(full,{withFileTypes:true})){
    if(DEFAULT_EXCLUDES.has(entry.name)) continue;
    const rel=posix(path.join(dir,entry.name));
    if(entry.isDirectory()) out.push(...walk(root,rel));
    else if(entry.isFile()) out.push(rel);
  }
  return out;
}

function resolveRelative(fromFile, spec, files){
  if(!spec || !spec.startsWith('.')) return '';
  const base=path.resolve(path.dirname(path.join('/',fromFile)),spec);
  const candidates=[
    base,
    base+'.js',base+'.cjs',base+'.mjs',base+'.ts',base+'.tsx',base+'.json',
    path.join(base,'index.js'),path.join(base,'index.ts')
  ].map(v=>posix(path.relative('/',v)));
  return candidates.find(candidate=>files.has(candidate)) || '';
}

function parseImports(content){
  const specs=[];
  const patterns=[
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g
  ];
  for(const re of patterns){
    let match;
    while((match=re.exec(content))) specs.push(match[1]);
  }
  return uniq(specs);
}

function parseSymbols(content){
  const found=[];
  const patterns=[
    /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\bclass\s+([A-Za-z_$][\w$]*)\b/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g
  ];
  for(const re of patterns){
    let match;
    while((match=re.exec(content))) found.push(match[1]);
  }
  return uniq(found).slice(0,120);
}

function buildRepoMap(root=path.resolve(__dirname,'..')){
  const paths=walk(root);
  const fileSet=new Set(paths);
  const nodes={};
  for(const rel of paths){
    const full=path.join(root,rel);
    const stat=fs.statSync(full);
    const ext=path.extname(rel).toLowerCase();
    const node={
      path:rel,
      size:stat.size,
      ext,
      estimated_tokens:Math.ceil(stat.size/4),
      imports:[],
      dependencies:[],
      reverse_dependencies:[],
      symbols:[]
    };
    if(TEXT_EXTENSIONS.has(ext) && stat.size<=1024*1024){
      let content='';
      try{ content=fs.readFileSync(full,'utf8'); }catch(_){ content=''; }
      node.imports=parseImports(content);
      node.dependencies=uniq(node.imports.map(spec=>resolveRelative(rel,spec,fileSet)).filter(Boolean));
      if(['.js','.cjs','.mjs','.ts','.tsx'].includes(ext)) node.symbols=parseSymbols(content);
    }
    nodes[rel]=node;
  }
  for(const node of Object.values(nodes)){
    for(const dep of node.dependencies){
      if(nodes[dep]) nodes[dep].reverse_dependencies.push(node.path);
    }
  }
  for(const node of Object.values(nodes)) node.reverse_dependencies=uniq(node.reverse_dependencies).sort();
  return {
    schema_version:'KK_REPO_MAP_V1',
    generated_at:new Date().toISOString(),
    file_count:Object.keys(nodes).length,
    nodes
  };
}

function loadRoutes(root=path.resolve(__dirname,'..')){
  const file=path.join(root,'config','kk-code-context-routes.json');
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!parsed || !Array.isArray(parsed.routes)) throw new Error('invalid code context routes');
  return parsed;
}

function normalizeTask(task){ return String(task||'').trim().toLowerCase(); }

function keywordMatches(normalized,keyword){
  if(!keyword) return false;
  if(/^[a-z0-9_-]{1,3}$/.test(keyword)){
    return new RegExp('(?:^|[^a-z0-9_])'+keyword+'(?:$|[^a-z0-9_])','i').test(normalized);
  }
  return normalized.includes(keyword);
}

function routeScores(task,routes){
  const normalized=normalizeTask(task);
  return routes.map(route=>{
    let score=0;
    const matched=[];
    for(const raw of route.keywords||[]){
      const keyword=String(raw||'').toLowerCase();
      if(keywordMatches(normalized,keyword)){
        score += Math.max(2,Math.min(12,Math.ceil(keyword.length/3)));
        matched.push(raw);
      }
    }
    return {route,score,matched};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.route.id.localeCompare(b.route.id));
}

function addCandidate(map,file,score,reason,repoMap){
  if(!file || !repoMap.nodes[file]) return;
  const current=map.get(file)||{path:file,score:0,reasons:[]};
  current.score=Math.max(current.score,score);
  current.reasons=uniq([...current.reasons,reason]);
  map.set(file,current);
}

function contextPack(task,{root=path.resolve(__dirname,'..'),repoMap=null,maxFiles,maxEstimatedTokens}={}){
  const routes=loadRoutes(root);
  const map=repoMap||buildRepoMap(root);
  const maxFileCount=Number(maxFiles||routes.defaults?.max_files||10);
  const budget=Number(maxEstimatedTokens||routes.defaults?.max_estimated_tokens||12000);
  const largeChars=Number(routes.defaults?.large_file_chars||32000);
  const scoredRoutes=routeScores(task,routes.routes);
  const activeRoutes=scoredRoutes.slice(0,3);
  const candidates=new Map();

  if(!activeRoutes.length){
    for(const file of ['AGENTS.md','package.json','docs/PROJECT_STRUCTURE.md','.agents/skills/kk-code-change/SKILL.md','.agents/skills/kk-code-review/SKILL.md']){
      addCandidate(candidates,file,60,'fallback:general_engineering',map);
    }
  }

  activeRoutes.forEach((hit,index)=>{
    const routeRankBonus=Math.max(0,24-(index*12));
    (hit.route.files||[]).forEach((file,fileIdx)=> addCandidate(
      candidates,
      file,
      100+hit.score+routeRankBonus-(fileIdx*0.01),
      'route:'+hit.route.id,
      map
    ));
  });

  for(const candidate of [...candidates.values()]){
    const node=map.nodes[candidate.path];
    for(const dep of node.dependencies||[]) addCandidate(candidates,dep,candidate.score-18,'dependency:'+candidate.path,map);
    for(const rev of (node.reverse_dependencies||[]).filter(file=>/^(admin|api|server|cloudflare|supabase\/functions)\//.test(file)).slice(0,3)) addCandidate(candidates,rev,candidate.score-25,'dependent:'+candidate.path,map);
  }

  // Main production stable score ordering; preserve curated route priority from cleanup.
  const sorted=[...candidates.values()].sort((a,b)=>b.score-a.score);
  const selected=[];
  let tokens=0;
  for(const item of sorted){
    if(selected.length>=maxFileCount) break;
    const node=map.nodes[item.path];
    const estimated=node.estimated_tokens||0;
    const large=node.size>largeChars;
    const allocated=large?Math.min(estimated,2500):estimated;
    const directRoute=activeRoutes.some(hit=>(hit.route.files||[]).includes(item.path));
    if(tokens+allocated>budget){
      if(!directRoute) continue;
      const remaining=Math.max(0,budget-tokens);
      if(!remaining) continue;
      selected.push({
        ...item,
        size:node.size,
        estimated_tokens:estimated,
        budgeted_tokens:remaining,
        symbols:node.symbols||[],
        read_strategy:'symbols_or_targeted_ranges_first'
      });
      tokens+=remaining;
      continue;
    }
    selected.push({
      ...item,
      size:node.size,
      estimated_tokens:estimated,
      budgeted_tokens:allocated,
      symbols:node.symbols||[],
      read_strategy:large?'symbols_or_targeted_ranges_first':'full_file_ok'
    });
    tokens+=allocated;
  }

  const tests=uniq(activeRoutes.flatMap(x=>x.route.tests||[]))
    .filter(file=>map.nodes[file])
    .slice(0,Number(routes.defaults?.max_tests||10));
  const skills=uniq(activeRoutes.flatMap(x=>x.route.skills||[])).filter(file=>map.nodes[file]);
  const docs=uniq(activeRoutes.flatMap(x=>x.route.docs||[])).filter(file=>map.nodes[file]);

  return {
    schema_version:'KK_CODE_CONTEXT_PACK_V1',
    task:String(task||''),
    matched_routes:activeRoutes.map(x=>({id:x.route.id,score:x.score,matched_keywords:x.matched})),
    selected_files:selected,
    estimated_context_tokens:tokens,
    budget_tokens:budget,
    targeted_tests:tests,
    skills,
    docs,
    full_regression_required:activeRoutes.some(x=>['deployment','runtime_ledger_supabase','agent_orchestration','booking_inventory'].includes(x.route.id)),
    notes:[
      'Open selected files before broad repo search.',
      'For large files, inspect named symbols/targeted ranges first instead of loading the whole file.',
      'Expand context only when evidence shows the first pack is insufficient.'
    ]
  };
}

function targetedTestCommand(pack){
  const tests=uniq(pack?.targeted_tests||[]);
  return tests.length ? 'node --test '+tests.map(v=>JSON.stringify(v)).join(' ') : 'npm test';
}

module.exports={
  TEXT_EXTENSIONS,
  walk,
  parseImports,
  parseSymbols,
  buildRepoMap,
  loadRoutes,
  keywordMatches,
  routeScores,
  contextPack,
  targetedTestCommand
};
