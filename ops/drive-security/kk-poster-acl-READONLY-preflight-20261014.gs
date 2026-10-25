// KK Phone Rental 2026-10-14 — STANDALONE / READ-ONLY / OWNER PRIVATE
// PRE-FLIGHT ONLY: This file has NO setSharing, file/folder write, trigger or deploy.
// Generated from exact owner repair PR #721 preflight section. Fingerprint format is
// the same as the full script if real permissions and inventory have not drifted.
// DO NOT bind to anyone-reader customer Booking sheet; keep script Restricted.
// Function: kkAclDryRun_20261013(). No other action is authorized by this file.
//
// IMPORTANT: Results require running under the owner-authorized Apps Script
// editor. Merely storing this file in GitHub DOES NOT run it and DOES NOT create
// any Apps Script project or change any Drive permission.

// KK Phone Rental • zero-cost, owner-executed Google Drive ACL repair • 2026-10-13
// DO NOT install as trigger. Audit first. Apply needs explicit Dry Run fingerprint.
// No booking, business spreadsheet, event-price or poster URL writes.
const KKACL_BOOK='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const KKACL_EXPECTED=["11lLELLP0U5s26pSnq83KEoJErDaRVbhc","11n_PykjFNHUaHN_Qn98dAKxRi-is3PY6","1HBgou64T-Njk8qSYxVftlx5Ep90rPRME","1HFY4aRt9jFDME1KXtGMCNakRZyCEpHgl","1HTmp7irQj7Ut97NNPCu_r6j3N1GtAZCy","1IJQ-3QTldmIMN886hs639cDh8l0I7l1N","1IuFwiQGTLFKu_kLy0IRDYQXlwWdeAXxB","1JhOUPGj9Qoi6r--zFEG0Bl-QCM5FK0O1","1MSARhcxKGVuZo4-HxdDmB6le2tl2mkrl","1OVYGQIlzt-n_la8eKKwgFIBcrrVxix78","1ROsveWgaivdG6qyujFJ5ofk5n87yZnr0","1RX-z43Znq0Aav02O_KASNexCHTN62sKf","1TKVc01SYSIP0TLFG9R3Ay3w0SKT-_S83","1UZRolQljkxmbbIWdH0k_Zl3XnQh_Gi8L","1V2sHeGxCuWZxGfL7JJIAAdTDBWGWrgNj","1V7BmLJk4w3DTpa55DlyauDRPZ0XhLkuC","1YAQKhOGwvtug-Z2Uae3wjFEYsxPGPz9J","1a72uNH2xAv_srOWwLY35tmXAvTJDw1Aw","1ayPxgd5_3Qa7DUwLu_5Kka90uwEPBMp2","1bsdn_iG_QEXudZIyqu-EL2gFaAkPZUHo","1dNV0SMV-y1UJraKmor2d7mYY-FvZn-9Y","1gRBzNK9FzB4dFd79Ifmfl_tuKOa4WDV9","1g_FLQ20KKd4hnxgUtJxyS775v5eX6PS2","1lNIh_rrlF_VmV5RBtetzKDQotLmTxwbm","1m-nHtWvAiVjeMycJdpWY5hTyyzNaLAuz","1nC3VeMJdiK3zie_6i1LV6m5aOPpEz_Ka","1oIzFoFiN3fz4mWUBaP82rtWrgLxptX2z","1oqhMwTdMLcIrVCUOTeJqDWvYeey3Fgxc","1qzZg3s9Wshx5IwAQ1ibnUP8oihuJSWL4","1sPjzmpjXPX5ax0e0ecYsC_Oj38K9gENI","1tFUzjXutDTuDTJxSg9vIHU2Pdg-Ob9m4","1tHq2I1PH4G7N0DECJvRCCghMZ8mP91u8","1uBAI1XN1U2MtT_kHFWFG8WLOcKMrXqPb","1usY7HMNml4plj98EQSJ9JGvvAlbsZSs0","1v9hbM_mr2uzd3WF-tEjNWqTFNXcUlwyk","1xCGMxDDqmKadYua8bjmlcHz-bzjMlQAO","1xpd3LaQEYjXB-yb-MS7z5xA_WdNEEp79","1yV2GACqS2IkzfBGGNTQFOwL6zUt1s7mo","1zt_jnwkr7mnFHUHOh8kXVdcd0MlgPErj"];
const KKACL_FOLDERS=['1avy3Up3NJskqB7kCzQoQPWKK3-j1qJqS','1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw','1uIfM-KV6FrJRQIP0ZNso7-ibZiSo1nwQ','1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl'];
// Limit each explicitly owner-approved run; refresh Dry Run + fingerprint before each batch.
const KKACL_MAX_WRITES_PER_APPROVAL=25;
// Default is strictly 39 currently visible image IDs + 4 reviewed folders.
// Historical files are inventoried / fingerprinted but NEVER setSharing-ed.
const KKACL_WRITE_SCOPE='ACTIVE_ONLY';

function kkAclReadActive_20261013(){
  const ss=SpreadsheetApp.openById(KKACL_BOOK), a=ss.getSheetByName('01_Events'),b=ss.getSheetByName('08_Web_Ready');
  if(!a||!b||a.getLastRow()<5||b.getLastRow()<5)throw Error('SOT_UNAVAILABLE');
  const ev=a.getRange(5,1,a.getLastRow()-4,9).getDisplayValues(),
        wr=b.getRange(5,1,b.getLastRow()-4,10).getDisplayValues(),
        show=new Map(wr.filter(z=>z[0]).map(z=>[z[0],z]));
  // Fail closed on duplicate canonical or generated IDs. A Map's last-write
  // semantics would otherwise conceal an ambiguous poster / ACL membership.
  const eventIds=ev.filter(z=>z[0]).map(z=>String(z[0]));
  const webIds=wr.filter(z=>z[0]).map(z=>String(z[0]));
  if(new Set(eventIds).size!==eventIds.length||new Set(webIds).size!==webIds.length)
    throw Error('DUPLICATE_EVENT_ID_IN_ACTIVE_SOT');
  const cards=ev.filter(z=>/^\d{1,2}\/(10|11|12)\/2026$/.test(z[2])&&['show','show_full'].includes(show.get(z[0])?.[9]));
  const refs=[];
  for(const row of cards){
    const w=show.get(row[0]);
    // An unchanged image alone cannot authorize ACL changes for a card whose
    // canonical date disagrees with the public feed. Abort before Drive writes.
    if(String(row[2]||'').trim()!==String(w[2]||'').trim())
      throw Error('SCOPED_ACTIVE_EVENT_DATE_DIVERGED');
    if(String(row[4]||'')!==String(w[4]||''))throw Error('IMAGE_READBACK_DIVERGED:'+row[0]);
    const m=String(row[4]||'').match(/^https:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]+)/);
    if(m)refs.push(m[1]);
  }
  const files=[...new Set(refs)].sort();
  if(cards.length!==73||refs.length!==48||files.length!==KKACL_EXPECTED.length||
     files.some((x,i)=>x!==KKACL_EXPECTED[i]))throw Error('SCOPED_ACTIVE_POSTER_DRIFT');
  return files;
}
function kkAclRole_20261013(o, historical){
  const access=String(o.getSharingAccess()),role=String(o.getSharingPermission());
  // Prior private/restricted historic images are not ours to publish or modify.
  // Include their exact access/role in the reviewed fingerprint without writes.
  if(historical && access!==String(DriveApp.Access.ANYONE_WITH_LINK)){
    // ANYONE means public/discoverable, NOT private/restricted. Never silently
    // exclude a potentially publicly writable historic image from this audit.
    if(access===String(DriveApp.Access.ANYONE))throw Error('PUBLIC_DISCOVERABLE_HISTORICAL_REVIEW_REQUIRED:'+o.getId());
    if(access===String(DriveApp.Access.PRIVATE) ||
       access===String(DriveApp.Access.DOMAIN) ||
       access===String(DriveApp.Access.DOMAIN_WITH_LINK))
      return 'RESTRICTED_HISTORICAL:'+access+':'+role;
    throw Error('UNKNOWN_HISTORICAL_ACCESS:'+o.getId()+':'+access+':'+role);
  }
  if(access!==String(DriveApp.Access.ANYONE_WITH_LINK) ||
     (role!==String(DriveApp.Permission.EDIT)&&role!==String(DriveApp.Permission.VIEW)))
       throw Error('UNEXPECTED_SHARING_ACCESS:'+o.getId()+':'+access+':'+role);
  return role;
}
function kkAclSnapshot_20261013(){
  const active=kkAclReadActive_20261013(),want=new Set(active);
  const visited=new Set(),found=new Set(),foundFolders=new Set(),items=[];
  function traverse(folder,depth,parentId){
    if(depth>8||items.length>1200)throw Error('ACL_BOUND_EXCEEDED');
    const id=String(folder.getId());
    if(visited.has(id))return;
    visited.add(id);foundFolders.add(id);
    items.push({id:id,parent:parentId||'ROOT',depth:depth,kind:'folder',role:kkAclRole_20261013(folder),obj:folder});
    const files=folder.getFiles();
    while(files.hasNext()){
      const f=files.next(),fid=String(f.getId());
      if(visited.has(fid))continue;
      if(!String(f.getMimeType()).startsWith('image/'))throw Error('NON_IMAGE_IN_KK_ASSET_TREE:'+fid);
      visited.add(fid);found.add(fid);
      items.push({id:fid,parent:id,depth:depth+1,kind:'image',role:kkAclRole_20261013(f,!want.has(fid)),obj:f});
      if(items.length>1200)throw Error('ACL_BOUND_EXCEEDED');
    }
    const sub=folder.getFolders();
    while(sub.hasNext())traverse(sub.next(),depth+1,id);
  }
  traverse(DriveApp.getFolderById(KKACL_FOLDERS[0]),0);
  traverse(DriveApp.getFolderById(KKACL_FOLDERS[3]),0);
  if(KKACL_FOLDERS.some(id=>!foundFolders.has(id)))throw Error('KK_ASSET_FOLDER_TREE_DRIFT');
  if(active.some(id=>!found.has(id)))throw Error('ACTIVE_DRIVE_IMAGE_OUTSIDE_KK_ASSET_TREES');
  // Fingerprint binds identity, name and parent hierarchy as well as role.
  // A file moved/renamed between owner Dry Run and Apply invalidates approval.
  // Length/escape-safe serialization binds each metadata field unambiguously.
  // Folder and artwork names may legally contain pipes and line breaks.
  const manifest=items.map(x=>JSON.stringify([x.kind,x.id,x.parent,x.depth,x.obj.getName(),x.role])).sort().join('\n');
  const fingerprint=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,manifest)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  return {items,active:active.length,images:found.size,folders:foundFolders.size,
          writers:items.filter(x=>x.role===String(DriveApp.Permission.EDIT)).length,fingerprint};
}
function kkAclDryRun_20261013(){
  const s=kkAclSnapshot_20261013();
  const info={dry_run:true,active_files:s.active,scoped_files:s.images,folders:s.folders,
              public_writer:s.writers,fingerprint:s.fingerprint,changed:0};
  // The approved fingerprint encompasses every descendant, not just 39 active
  // files. Make the full proposed blast radius independently reviewable before
  // anyone pastes the fingerprint into the owner-only apply entrypoint.
  info.scoped_items=s.items.length;
  info.historical_images=s.images-s.active;
  info.active_public_writer=s.items.filter(x=>x.kind==='image'&&
    KKACL_EXPECTED.includes(x.id)&&x.role===String(DriveApp.Permission.EDIT)).length;
  info.other_public_writer=s.writers-info.active_public_writer;
  Logger.log(JSON.stringify(info));
  for(let offset=0;offset<s.items.length;offset+=20){
    Logger.log(JSON.stringify({
      dry_run_inventory_page:Math.floor(offset/20)+1,
      total_pages:Math.ceil(s.items.length/20),
      items:s.items.slice(offset,offset+20).map(x=>({
        kind:x.kind,
        name:x.obj.getName(),
        id_suffix:x.id.slice(-6),
        public_role:x.role,
        active_poster:KKACL_EXPECTED.includes(x.id)
      }))
    }));
  }
  return info;
}
