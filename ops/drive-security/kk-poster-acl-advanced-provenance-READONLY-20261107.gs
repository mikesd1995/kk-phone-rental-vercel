// KK Phone Rental — OWNER ONLY: Advanced Drive API v3 permission-origin audit.
// READ ONLY / NO ROLE WRITES / NO TRIGGERS / NO PUBLIC ID/URL/TOKEN LOGGING.
// Requires an owner-controlled Restricted standalone Apps Script and Advanced
// Google Drive service (v3). Source: Drive.Permissions.list permissionDetails.
// Never install this script bound to a Booking/customer spreadsheet.
const KKPROV_FOLDERS=[
  '1avy3Up3NJskqB7kCzQoQPWKK3-j1qJqS',
  '1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw',
  '1uIfM-KV6FrJRQIP0ZNso7-ibZiSo1nwQ',
  '1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl'
];
const KKPROV_PRIVATE_KEY='KKACL_OWNER_REVIEWED_ACTIVE_IDS_V20261107';
const KKPROV_MAX_ITEMS=100, KKPROV_MAX_DEPTH=14, KKPROV_MAX_PERMISSION_PAGES=30;
function kkProvReadPrivateRoster_20261107(){
  const properties=PropertiesService.getScriptProperties();
  const raw=properties&&properties.getProperty(KKPROV_PRIVATE_KEY);
  if(!raw)throw Error('OWNER_PRIVATE_ROSTER_NOT_CONFIGURED');
  let ids;
  try{ids=JSON.parse(raw);}catch(_e){throw Error('OWNER_PRIVATE_ROSTER_INVALID');}
  if(!Array.isArray(ids)||ids.length!==45||
     ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{20,128}$/.test(id))||
     new Set(ids).size!==ids.length||
     ids.some((id,i)=>id!==[...ids].sort()[i]))
     throw Error('OWNER_PRIVATE_ROSTER_INVALID');
  return ids;
}
function kkProvGetMetadata_20261107(id){
  if(!Drive||!Drive.Files||typeof Drive.Files.get!=='function')
    throw Error('ADVANCED_DRIVE_V3_NOT_ENABLED');
  const obj=Drive.Files.get(id,{
    supportsAllDrives:true,fields:'id,name,mimeType,parents,driveId,capabilities/canShare'
  });
  if(!obj||String(obj.id)!==id||!obj.mimeType)throw Error('ADVANCED_FILE_METADATA_INCOMPLETE');
  return obj;
}
function kkProvGetPermissions_20261107(id){
  if(!Drive||!Drive.Permissions||typeof Drive.Permissions.list!=='function')
    throw Error('ADVANCED_DRIVE_PERMISSIONS_UNAVAILABLE');
  const permissions=[];
  let pageToken=null;
  const seen=new Set();
  for(let n=0;n<KKPROV_MAX_PERMISSION_PAGES;n++){
    const opts={supportsAllDrives:true,pageSize:100,
      fields:'nextPageToken,permissions(id,type,role,permissionDetails(inherited,inheritedFrom,role,permissionType))'};
    if(pageToken)opts.pageToken=pageToken;
    const result=Drive.Permissions.list(id,opts);
    if(!result||!Array.isArray(result.permissions))
      throw Error('ADVANCED_PERMISSIONS_INCOMPLETE');
    permissions.push(...result.permissions);
    if(permissions.length>4000)throw Error('ADVANCED_PERMISSIONS_BOUND_EXCEEDED');
    const next=String(result.nextPageToken||'');
    if(!next)return permissions;
    if(seen.has(next))throw Error('ADVANCED_PERMISSION_PAGINATION_LOOP');
    seen.add(next);pageToken=next;
  }
  throw Error('ADVANCED_PERMISSION_PAGINATION_BOUND');
}
function kkProvInspect_20261107(){
  // This is an independent preflight. It does NOT authorize a folder repair.
  const roster=kkProvReadPrivateRoster_20261107();
  const queue=KKPROV_FOLDERS.map(id=>({id,depth:0,kind:'folder'}))
    .concat(roster.map(id=>({id,depth:0,kind:'image'})));
  const visited=new Set();
  let imageCount=0,folderCount=0,parentCount=0,directWriter=0,
      inheritedWriter=0,publicWriterItems=0,anyoneReaderItems=0;
  const sharedDriveIds=new Set();
  while(queue.length){
    const work=queue.shift();
    if(work.depth>KKPROV_MAX_DEPTH||visited.size>=KKPROV_MAX_ITEMS)
      throw Error('ADVANCED_PROVENANCE_SCOPE_BOUND_EXCEEDED');
    if(visited.has(work.id))continue;
    visited.add(work.id);
    const metadata=kkProvGetMetadata_20261107(work.id);
    if(work.kind==='image'&&!String(metadata.mimeType).startsWith('image/'))
      throw Error('ADVANCED_ACTIVE_FILE_NOT_IMAGE');
    if(work.kind!=='image'&&metadata.mimeType!=='application/vnd.google-apps.folder')
      throw Error('ADVANCED_ANCESTOR_NOT_FOLDER');
    if(work.kind==='image')imageCount++;
    else if(work.depth===0)folderCount++;
    else parentCount++;
    const acl=kkProvGetPermissions_20261107(work.id);
    // Google returns a permissions resource for every distinct grant.
    // Shared-drive origin is returned under permissionDetails. Never
    // pretend an omitted provenance is proof of a safe direct role.
    const publicPerms=acl.filter(p=>p&&p.type==='anyone');
    let hasWriter=false,hasReader=false;
    for(const p of publicPerms){
      if(!['writer','reader','commenter'].includes(String(p.role)))
        throw Error('ADVANCED_ANYONE_ROLE_UNRECOGNIZED');
      if(!Array.isArray(p.permissionDetails)||!p.permissionDetails.length){
        throw Error('ADVANCED_ANYONE_PERMISSION_ORIGIN_MISSING');
      }
      let maxWriter=false;
      for(const d of p.permissionDetails){
        if(typeof d.inherited!=='boolean'||
           !['file','member'].includes(String(d.permissionType||''))||
           !['reader','commenter','writer','organizer','fileOrganizer'].includes(String(d.role||'')))
           throw Error('ADVANCED_PERMISSION_DETAILS_INVALID');
        if(d.inherited&&!String(d.inheritedFrom||''))
          throw Error('ADVANCED_INHERITED_SOURCE_MISSING');
        if(d.role==='writer'||d.role==='organizer'||d.role==='fileOrganizer'){
          maxWriter=true;
          if(d.inherited)inheritedWriter++;
          else directWriter++;
        }
      }
      if((p.role==='writer')!==maxWriter)
        throw Error('ADVANCED_ROLE_DETAILS_DIVERGED');
      if(p.role==='writer')hasWriter=true;
      if(p.role==='reader')hasReader=true;
    }
    if(hasWriter)publicWriterItems++;
    if(hasReader)anyoneReaderItems++;
    // Audit summary only. Never serialize identifying IDs, names, emails,
    // signed URLs, account details or OAuth tokens into Logger output.
    const parents=Array.isArray(metadata.parents)?metadata.parents:[];
    if(work.kind!=='image'){
      for(const parentId of parents){
        if(typeof parentId!=='string'||!/^[A-Za-z0-9_-]{10,128}$/.test(parentId))
          throw Error('ADVANCED_PARENT_ID_INVALID');
        if(!visited.has(parentId))
          queue.push({id:parentId,depth:work.depth+1,kind:'upstream'});
      }
    }
    if(metadata.driveId && typeof metadata.driveId==='string'){
      // Shared-drive membership grants can arise separately from item ACLs.
      // Owner review of the drive-level ACL is still required. Count only
      // distinct shared drives rather than calling every item unresolved.
      sharedDriveIds.add(metadata.driveId);
    }
  }
  if(imageCount!==45||folderCount!==4)
    throw Error('ADVANCED_PROVENANCE_ACTIVE_ROSTER_DRIFT');
  const report={audit_only:true,changed:0,images:imageCount,asset_folders:folderCount,
    upstream_parents:parentCount,public_writer_items:publicWriterItems,
    direct_public_writer_details:directWriter,inherited_public_writer_details:inheritedWriter,
    public_reader_items:anyoneReaderItems,
    shared_drive_ids_seen:sharedDriveIds.size,
    shared_drive_membership_review_required:sharedDriveIds.size>0,
    owner_origin_review_required:true,ready_for_acl_write:false};
  Logger.log(JSON.stringify(report));
  return report;
}
// Entry point for owner standalone editor: kkProvInspect_20261107()
// No role updates, no permission deletions, no executable Apply function.
