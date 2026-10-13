// KK Phone Rental • zero-cost, owner-executed Google Drive ACL repair • 2026-10-13
// DO NOT install as trigger. Audit first. Apply needs explicit Dry Run fingerprint.
// No booking, business spreadsheet, event-price or poster URL writes.
const KKACL_BOOK='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const KKACL_EXPECTED=["11lLELLP0U5s26pSnq83KEoJErDaRVbhc","11n_PykjFNHUaHN_Qn98dAKxRi-is3PY6","16EZbR0m4aKuiJqC9X-hX21u1ANa9_WIZ","17d_8sRmJZTfqY2niE7LjLY1cwXM_sh7b","1IJQ-3QTldmIMN886hs639cDh8l0I7l1N","1IuFwiQGTLFKu_kLy0IRDYQXlwWdeAXxB","1JhOUPGj9Qoi6r--zFEG0Bl-QCM5FK0O1","1MSARhcxKGVuZo4-HxdDmB6le2tl2mkrl","1OVYGQIlzt-n_la8eKKwgFIBcrrVxix78","1TKVc01SYSIP0TLFG9R3Ay3w0SKT-_S83","1UZRolQljkxmbbIWdH0k_Zl3XnQh_Gi8L","1V2sHeGxCuWZxGfL7JJIAAdTDBWGWrgNj","1YAQKhOGwvtug-Z2Uae3wjFEYsxPGPz9J","1YAcm8q9b9YBJcAKeEgxRB5fnVIPXbiDS","1a72uNH2xAv_srOWwLY35tmXAvTJDw1Aw","1ayPxgd5_3Qa7DUwLu_5Kka90uwEPBMp2","1bsdn_iG_QEXudZIyqu-EL2gFaAkPZUHo","1dNV0SMV-y1UJraKmor2d7mYY-FvZn-9Y","1gRBzNK9FzB4dFd79Ifmfl_tuKOa4WDV9","1g_FLQ20KKd4hnxgUtJxyS775v5eX6PS2","1m-nHtWvAiVjeMycJdpWY5hTyyzNaLAuz","1nC3VeMJdiK3zie_6i1LV6m5aOPpEz_Ka","1oIzFoFiN3fz4mWUBaP82rtWrgLxptX2z","1oqhMwTdMLcIrVCUOTeJqDWvYeey3Fgxc","1qzZg3s9Wshx5IwAQ1ibnUP8oihuJSWL4","1sPjzmpjXPX5ax0e0ecYsC_Oj38K9gENI","1tFUzjXutDTuDTJxSg9vIHU2Pdg-Ob9m4","1tHq2I1PH4G7N0DECJvRCCghMZ8mP91u8","1uBAI1XN1U2MtT_kHFWFG8WLOcKMrXqPb","1usY7HMNml4plj98EQSJ9JGvvAlbsZSs0","1xCGMxDDqmKadYua8bjmlcHz-bzjMlQAO","1xpd3LaQEYjXB-yb-MS7z5xA_WdNEEp79","1yMVpy4pNNuitIb6FFsBiEo4y9-ogFA2i","1yV2GACqS2IkzfBGGNTQFOwL6zUt1s7mo","1zt_jnwkr7mnFHUHOh8kXVdcd0MlgPErj"];
const KKACL_FOLDERS=['1avy3Up3NJskqB7kCzQoQPWKK3-j1qJqS','1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw','1uIfM-KV6FrJRQIP0ZNso7-ibZiSo1nwQ','1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl'];

function kkAclReadActive_20261013(){
  const ss=SpreadsheetApp.openById(KKACL_BOOK), a=ss.getSheetByName('01_Events'),b=ss.getSheetByName('08_Web_Ready');
  if(!a||!b||a.getLastRow()<5||b.getLastRow()<5)throw Error('SOT_UNAVAILABLE');
  const ev=a.getRange(5,1,a.getLastRow()-4,9).getDisplayValues(),
        wr=b.getRange(5,1,b.getLastRow()-4,10).getDisplayValues(),
        show=new Map(wr.filter(z=>z[0]).map(z=>[z[0],z]));
  const cards=ev.filter(z=>/^\d{1,2}\/(10|11|12)\/2026$/.test(z[2])&&['show','show_full'].includes(show.get(z[0])?.[9]));
  const refs=[];
  for(const row of cards){
    const w=show.get(row[0]);
    if(String(row[4]||'')!==String(w[4]||''))throw Error('IMAGE_READBACK_DIVERGED:'+row[0]);
    const m=String(row[4]||'').match(/^https:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]+)/);
    if(m)refs.push(m[1]);
  }
  const files=[...new Set(refs)].sort();
  if(cards.length!==76||refs.length!==44||files.length!==KKACL_EXPECTED.length||
     files.some((x,i)=>x!==KKACL_EXPECTED[i]))throw Error('SCOPED_ACTIVE_POSTER_DRIFT');
  return files;
}
function kkAclRole_20261013(o){
  const access=String(o.getSharingAccess()),role=String(o.getSharingPermission());
  if(access!==String(DriveApp.Access.ANYONE_WITH_LINK) ||
     (role!==String(DriveApp.Permission.EDIT)&&role!==String(DriveApp.Permission.VIEW)))
       throw Error('UNEXPECTED_SHARING_ACCESS:'+o.getId()+':'+access+':'+role);
  return role;
}
function kkAclSnapshot_20261013(){
  const active=kkAclReadActive_20261013(),want=new Set(active);
  const visited=new Set(),found=new Set(),foundFolders=new Set(),items=[];
  function traverse(folder,depth){
    if(depth>8||items.length>1200)throw Error('ACL_BOUND_EXCEEDED');
    const id=String(folder.getId());
    if(visited.has(id))return;
    visited.add(id);foundFolders.add(id);
    items.push({id:id,depth:depth,kind:'folder',role:kkAclRole_20261013(folder),obj:folder});
    const files=folder.getFiles();
    while(files.hasNext()){
      const f=files.next(),fid=String(f.getId());
      if(visited.has(fid))continue;
      if(!String(f.getMimeType()).startsWith('image/'))throw Error('NON_IMAGE_IN_KK_ASSET_TREE:'+fid);
      visited.add(fid);found.add(fid);
      items.push({id:fid,depth:depth+1,kind:'image',role:kkAclRole_20261013(f),obj:f});
      if(items.length>1200)throw Error('ACL_BOUND_EXCEEDED');
    }
    const sub=folder.getFolders();
    while(sub.hasNext())traverse(sub.next(),depth+1);
  }
  traverse(DriveApp.getFolderById(KKACL_FOLDERS[0]),0);
  traverse(DriveApp.getFolderById(KKACL_FOLDERS[3]),0);
  if(KKACL_FOLDERS.some(id=>!foundFolders.has(id)))throw Error('KK_ASSET_FOLDER_TREE_DRIFT');
  if(active.some(id=>!found.has(id)))throw Error('ACTIVE_DRIVE_IMAGE_OUTSIDE_KK_ASSET_TREES');
  const manifest=items.map(x=>x.kind+'|'+x.id+'|'+x.role).sort().join('\n');
  const fingerprint=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,manifest)
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
  return {items,active:active.length,images:found.size,folders:foundFolders.size,
          writers:items.filter(x=>x.role===String(DriveApp.Permission.EDIT)).length,fingerprint};
}
function kkAclDryRun_20261013(){
  const s=kkAclSnapshot_20261013();
  const info={dry_run:true,active_files:s.active,scoped_files:s.images,folders:s.folders,
              public_writer:s.writers,fingerprint:s.fingerprint,changed:0};
  // The approved fingerprint encompasses every descendant, not just 35 active
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
// Enter fingerprint only after OWNER has reviewed Dry Run output. Nothing runs automatically.
function kkAclApply_20261013(approvedFingerprint){
  if(!/^[a-f0-9]{64}$/.test(String(approvedFingerprint||'')))throw Error('OWNER_DRY_RUN_APPROVAL_FINGERPRINT_REQUIRED');
  const before=kkAclSnapshot_20261013();
  if(approvedFingerprint!==before.fingerprint)throw Error('ACL_CHANGED_SINCE_OWNER_APPROVAL');
  const ordered=before.items.slice().sort((a,b)=>a.depth-b.depth||(a.kind==='folder'?-1:1));
  const updated=[],failed=[];
  for(const it of ordered){
    if(it.role===String(DriveApp.Permission.VIEW))continue;
    try {
      it.obj.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      if(kkAclRole_20261013(it.obj)!==String(DriveApp.Permission.VIEW))throw Error('ACL_READBACK_FAIL');
      updated.push(it.id);
    }catch(e){failed.push({id:it.id,reason:String(e)});}
  }
  const after=kkAclSnapshot_20261013();
  const result={updated:updated.length,failures:failed,residual_writers:after.writers,
                active:after.active,images:after.images,folders:after.folders};
  Logger.log(JSON.stringify(result));
  if(failed.length||after.writers||after.images!==before.images||after.folders!==before.folders)
    throw Error('PARTIAL_OR_DRIFTED_ACL_REPAIR:'+JSON.stringify(result));
  return {ok:true,updated:updated.length,reader_verified:after.items.length,active_files:after.active};
}


/**
 * Owner UI entrypoint. Replace the placeholder ONLY after reviewing the Dry Run
 * fingerprint and ALL scoped descendants of Brand/Brand Kit and both Posters
 * directories. No automatic trigger should be set.
 *
 * Note: Google Apps Script's editor cannot pass function arguments directly.
 * Replacing this placeholder is an explicit owner approval of the live
 * snapshot. Never paste another person's fingerprint or skip Dry Run.
 */
function kkAclOwnerApprovedApply_20261013() {
  const approvedFingerprint = 'OWNER_REVIEWED_64_HEX_FINGERPRINT_HERE';
  if (!/^[a-f0-9]{64}$/.test(approvedFingerprint)) {
    throw new Error('OWNER_APPROVAL_NOT_SUPPLIED_RUN_DRY_RUN_FIRST');
  }
  return kkAclApply_20261013(approvedFingerprint);
}
