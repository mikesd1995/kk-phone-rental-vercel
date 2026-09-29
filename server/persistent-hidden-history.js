'use strict';

const VERSION='PERSISTENT_HIDDEN_PUBLIC_GUARD_V1_2026-09-29';

// Frozen snapshot of event identities that were already hidden before the
// persistent-history hardening was fully available on every writer path.
// New hides should be recorded by the canonical visibility-history writer.
const LEGACY_HIDDEN_EVENT_IDS=new Set([
  "EVT-20261002-808-FESTIVAL-2026",
  "EVT-20261003-808-FESTIVAL-2026",
  "EVT-20261003-AIBECK-LIVE-IN-BANGKOK-2026",
  "EVT-20261003-BNK48-CGM48-GE2026-FAN-FEST",
  "EVT-20261003-FUNGTHON-ROCK-FESTIVAL-2026",
  "EVT-20261003-GMMTV-FANIVAL-2026-HAPPY-FAM",
  "EVT-20261003-IDOL-EXCHANGE-67-BEFORE-HALLOWEEN",
  "EVT-20261003-MAMA-PRESENTS-INK-WARUNTORN-",
  "EVT-20261003-MANUTSAWEE-SAD-SONGS-CONCERT",
  "EVT-20261003-MILLI-JAA-EHH-ASIA-TOUR-2026",
  "EVT-20261003-NONT-TANONT-THE-MOMENT-OF-SP",
  "EVT-20261003-THE-ROSE-ROSETOPIA-ASIA-TOUR",
  "EVT-20261004-AIBECK-LIVE-IN-BANGKOK-2026",
  "EVT-20261004-BNK48-CGM48-GE2026-FAN-FEST",
  "EVT-20261004-IDOL-EXCHANGE-67-BEFORE-HALLOWEEN",
  "EVT-20261006-AVENGED-SEVENFOLD-ASIA-TOUR",
  "EVT-20261007-AVENGED-SEVENFOLD-ASIA-TOUR",
  "EVT-20261010-BITOEY-FRUNG-FRING-FAN-CON",
  "EVT-20261010-BOY-SOMPOB-WORLD-Y-TOUR-BANGKOK",
  "EVT-20261010-GONG-YOO-THE-LONG-TAKE-BANGKOK",
  "EVT-20261010-HWANG-IN-YOUP-TO-YOU-BANGKOK",
  "EVT-20261011-GMMTV-FANIVAL-2026-HAPPY-FAM",
  "EVT-20261011-LANDOKMAI-SPECIAL-SHOW",
  "EVT-20261011-ZEEPRUK-HAPPY-BIRTHDAY-DAY",
  "EVT-20261016-MINDARYN-CALLING-BACK",
  "EVT-20261023-ATOM-PARIYA-SLAY-DOWN",
  "EVT-20261024-DICE-ALBUM-CONCERT",
  "EVT-20261024-GUN-NAPAT-BIRTHDAY-EVENT",
  "EVT-20261024-LANDOKMAI-YESTERDAYS-TOWN",
  "EVT-20261024-LEO-SCREAM-FEST-2026",
  "EVT-20261024-NEXORA-CARD-FEST",
  "EVT-20261024-OMEGA-X-BEYOND-BANGKOK",
  "EVT-20261024-TEEHENG-GEN-OF-US-1ST-FANMEETING",
  "EVT-20261024-TOP-PRE-STUDIO-2026-BANGKOK",
  "EVT-20261025-TIFFANY-YOUNG-EDGE-OF-CALM",
  "EVT-20261028-INTERSTELLAR-LIVE-CONCERT",
  "EVT-20261031-ENCHANTED-FEST-2026",
  "EVT-20261031-NUNEW-2ND-CONCERT-BORN-TO-BE",
  "EVT-20261031-ONG-SEONGWU-LETS-GO-ONG-BANGKOK",
  "EVT-20261031-TAOKACHA-15-YEARS-STILL-TOGETHER",
  "EVT-20261101-ZARA-LARSSON-MIDNIGHT-SUN-TOUR",
  "EVT-20261107-SHINE-BANGKOK-FANSIGN-ONE-LAST-LIGHT",
  "EVT-20261110-LANY-SOFT-WORLD-TOUR-BANGKOK",
  "EVT-20261112-WAVE-TO-EARTH-THE-PIECES-TOUR",
  "EVT-20261114-BE-PEERAPAT-BE-BEYOND-CONCERT",
  "EVT-20261114-NAMTAN-FILM-GLAMOROUS-FANCON",
  "EVT-20261115-SO-JI-SUB-SOULMATE-THE-TIMELESS",
  "EVT-20261121-JAN-JINGJING-BEWITCH-YOU-FAN",
  "EVT-20261122-JAN-JINGJING-BEWITCH-YOU-FAN",
  "EVT-20261122-LENA-MIU-GIRLS-NIGHT-OUT",
  "EVT-20261124-JOJI-SOLARIS",
  "EVT-20261127-FKJ-TYBER-TOUR",
  "EVT-20261129-KHALID-ALWAYS-SUMMER-BANGKOK"
]);

function text(v){return String(v==null?'':v).trim();}

function parseVisibilityStates(csv,parseCsvRows){
  const rows=parseCsvRows(csv);
  if(!rows.length) return new Map();
  const header=rows[0].map(v=>text(v).toLowerCase());
  const eventIdIndex=header.indexOf('event_id');
  const stateIndex=header.indexOf('lock_state');
  if(eventIdIndex<0||stateIndex<0) return new Map();
  const out=new Map();
  for(const row of rows.slice(1)){
    const id=text(row[eventIdIndex]);
    const state=text(row[stateIndex]).toUpperCase();
    if(id) out.set(id,state);
  }
  return out;
}

function shouldForceHidden(eventId,states){
  const id=text(eventId);
  if(!id) return false;
  const state=states instanceof Map?text(states.get(id)).toUpperCase():'';
  if(state==='REOPENED') return false;
  if(state==='LOCKED') return true;
  return LEGACY_HIDDEN_EVENT_IDS.has(id);
}

function enforceCsv(sheet,csv,parseCsvRows,serializeCsvRows,states){
  const rows=parseCsvRows(csv);
  if(!rows.length) return {text:String(csv||''),forced:0,dropped:0};
  const header=rows[0].map(v=>text(v).toLowerCase());
  const eventIdIndex=header.indexOf('event_id');
  if(eventIdIndex<0) return {text:String(csv||''),forced:0,dropped:0};
  const body=rows.slice(1);
  let forced=0;
  if(sheet==='08_Web_Ready'){
    const actionIndex=header.indexOf('action_for_web');
    const bookingIndex=header.indexOf('booking_status_for_web');
    const phoneIndex=header.indexOf('available_phone_count');
    const lensIndex=header.indexOf('available_lens_count');
    const next=body.map(row=>{
      if(!shouldForceHidden(row[eventIdIndex],states)) return row;
      forced++;
      const out=row.slice();
      if(actionIndex>=0) out[actionIndex]='hide';
      if(bookingIndex>=0) out[bookingIndex]='ซ่อนจากเว็บ';
      if(phoneIndex>=0) out[phoneIndex]='0';
      if(lensIndex>=0) out[lensIndex]='0';
      return out;
    });
    return {text:serializeCsvRows([rows[0],...next]),forced,dropped:0};
  }
  if(sheet==='09_Web_Packages'){
    const statusIndex=header.indexOf('package_status');
    const availableIndex=header.indexOf('available_count');
    const next=body.map(row=>{
      if(!shouldForceHidden(row[eventIdIndex],states)) return row;
      forced++;
      const out=row.slice();
      if(statusIndex>=0) out[statusIndex]='hidden';
      if(availableIndex>=0) out[availableIndex]='0';
      return out;
    });
    return {text:serializeCsvRows([rows[0],...next]),forced,dropped:0};
  }
  return {text:String(csv||''),forced:0,dropped:0};
}

module.exports={
  VERSION,
  LEGACY_HIDDEN_EVENT_IDS,
  parseVisibilityStates,
  shouldForceHidden,
  enforceCsv
};
