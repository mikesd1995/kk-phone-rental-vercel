(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.KKSnapshotHealth = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  const VERSION = 'admin-snapshot-resilience-3';
  const BACKEND = 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX';
  const KEYS = ['events','bookings','current_bookings','assets'];
  const ID_FIELDS = {events:'event_id', bookings:'booking_id', current_bookings:'booking_id', assets:'asset_id'};
  const COLLAPSE_KEYS = ['events','bookings','assets'];
  const COLLAPSE_MIN_PREVIOUS = 8;
  const COLLAPSE_RATIO = 0.35;
  const SOURCE_COUNT_MIN = 4;
  const SOURCE_WARN_RATIO = 0.75;
  const SOURCE_COUNT_CHECKS = {
    events:'Source count — Events',
    bookings:'Source count — Bookings',
    assets:'Source count — Assets'
  };
  const status = value => String(value || '').trim().toLowerCase();
  const workflowOpen = b => ['pending','confirmed','prepared','picked_up','returned','uploaded'].includes(status(b.booking_status));

  function identityProblems(key, rows){
    const idField = ID_FIELDS[key];
    if(!idField || !Array.isArray(rows)) return [];
    const seen = new Set();
    const duplicate = new Set();
    let missing = 0;
    for(const row of rows){
      const id = String(row && row[idField] || '').trim();
      if(!id){ missing++; continue; }
      if(seen.has(id)) duplicate.add(id);
      else seen.add(id);
    }
    const issues = [];
    if(missing) issues.push(key + ': ' + missing + ' rows missing ' + idField);
    if(duplicate.size) issues.push(key + ': duplicate ' + idField + ' ' + Array.from(duplicate).slice(0,3).join(', ') + (duplicate.size > 3 ? '…' : ''));
    return issues;
  }

  function normalizeEventIdentityText(value){
    return String(value === undefined || value === null ? '' : value)
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('en-US')
      .replace(/[\s\-_.,/\\()[\]{}:;'"`]+/g,'');
  }

  function normalizeEventDate(value){
    if(value instanceof Date && !isNaN(value)) return value.toISOString().slice(0,10);
    const raw=String(value === undefined || value === null ? '' : value).trim();
    if(!raw) return '';
    if(/^\d+(?:\.\d+)?$/.test(raw)){
      const n=Number(raw);
      if(n>1000 && n<100000){
        const ms=Date.UTC(1899,11,30)+Math.round(n*86400000);
        return new Date(ms).toISOString().slice(0,10);
      }
    }
    let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(m){
      let y=Number(m[1]); if(y>2500)y-=543;
      return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
    }
    m=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if(m){
      let y=Number(m[3]); if(y>2500)y-=543;
      return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
    }
    const d=new Date(raw);
    return isNaN(d)?'':d.toISOString().slice(0,10);
  }

  function eventIdentitySignals(rows){
    const source=Array.isArray(rows)?rows:[];
    const groups=[];
    const idDateDrift=[];

    for(const row of source){
      const eventId=String(row && row.event_id || '').trim();
      const eventName=String(row && row.event_name || '').trim();
      const eventDate=normalizeEventDate(row && row.event_date);
      const venue=String(row && row.venue || '').trim();
      const normalizedName=normalizeEventIdentityText(eventName);
      const normalizedVenue=normalizeEventIdentityText(venue);

      if(normalizedName && eventDate){
        let group=groups.find(g=>{
          if(g.normalized_name!==normalizedName || g.event_date!==eventDate) return false;
          if(g.normalized_venue && normalizedVenue && g.normalized_venue!==normalizedVenue) return false;
          return true;
        });
        if(!group){
          group={
            normalized_name:normalizedName,
            event_date:eventDate,
            normalized_venue:normalizedVenue,
            event_ids:[],
            event_name:eventName,
            venue
          };
          groups.push(group);
        }
        group.event_ids.push(eventId || '(missing event_id)');
      }

      const idMatch=eventId.match(/^EVT-(\d{4})(\d{2})(\d{2})-/);
      if(idMatch && eventDate){
        const idDate=`${idMatch[1]}-${idMatch[2]}-${idMatch[3]}`;
        if(idDate!==eventDate){
          idDateDrift.push({event_id:eventId, id_date:idDate, event_date:eventDate});
        }
      }
    }

    const logicalDuplicateGroups=groups
      .filter(g=>g.event_ids.length>1)
      .map(g=>({
        event_ids:g.event_ids.slice(),
        event_name:g.event_name,
        event_date:g.event_date,
        venue:g.venue
      }));

    const warnings=[];
    if(logicalDuplicateGroups.length){
      const sample=logicalDuplicateGroups.slice(0,2)
        .map(g=>g.event_ids.slice(0,3).join(' / '))
        .join('; ');
      warnings.push(
        'events: logical duplicate identity groups ' + logicalDuplicateGroups.length +
        ' by normalized name/date/venue; sample ' + sample
      );
    }
    if(idDateDrift.length){
      const sample=idDateDrift.slice(0,3)
        .map(x=>x.event_id + '→' + x.event_date)
        .join(', ');
      warnings.push(
        'events: event_id/date drift ' + idDateDrift.length +
        '; sample ' + sample
      );
    }

    return {
      logical_duplicate_group_count:logicalDuplicateGroups.length,
      logical_duplicate_groups:logicalDuplicateGroups.slice(0,5),
      id_date_drift_count:idDateDrift.length,
      id_date_drift:idDateDrift.slice(0,10),
      warnings
    };
  }

  function collapseSignals(data, previous){
    if(!previous) return [];
    const out = [];
    for(const key of COLLAPSE_KEYS){
      const before = Array.isArray(previous[key]) ? previous[key].length : 0;
      const after = data && Array.isArray(data[key]) ? data[key].length : 0;
      if(before >= COLLAPSE_MIN_PREVIOUS && after > 0 && (after / before) <= COLLAPSE_RATIO){
        out.push({key, before, after});
      }
    }
    return out;
  }

  function sourceCountMap(data){
    const out = {};
    if(!data || !Array.isArray(data.health)) return out;
    const labelToKey = {};
    Object.entries(SOURCE_COUNT_CHECKS).forEach(([key,label])=>{ labelToKey[label.toLowerCase()] = key; });
    for(const row of data.health){
      const label = String(row && row.check || '').trim().toLowerCase();
      const key = labelToKey[label];
      if(!key) continue;
      const raw = row && row.count !== undefined ? row.count : row && row.status;
      const n = Number(raw);
      if(Number.isFinite(n) && n >= 0 && Math.floor(n) === n) out[key] = n;
    }
    return out;
  }

  function applySourceCountCrossCheck(data, counts, issues, warnings){
    if(!data || !Array.isArray(data.health) || !data.health.length) return {};
    const sourceCounts = sourceCountMap(data);
    const present = Object.keys(sourceCounts);
    if(!present.length){
      warnings.push('independent source-count rows missing from Admin Health Check; first-load partial-read protection degraded');
      return sourceCounts;
    }
    const missing = COLLAPSE_KEYS.filter(key=>sourceCounts[key] === undefined);
    if(missing.length) warnings.push('independent source-count incomplete: missing ' + missing.join(', '));

    for(const key of present){
      if(!COLLAPSE_KEYS.includes(key)) continue;
      const source = sourceCounts[key];
      const snapshot = counts[key];
      if(typeof snapshot !== 'number') continue;
      if(source > 0 && snapshot === 0){
        issues.push(key + ': snapshot zero but independent source count is ' + source);
        continue;
      }
      if(source >= SOURCE_COUNT_MIN && snapshot > 0){
        const ratio = snapshot / source;
        if(ratio <= COLLAPSE_RATIO){
          issues.push(key + ': first-load/source count mismatch ' + snapshot + '/' + source + ' (' + Math.round(ratio*100) + '%)');
        } else if(ratio < SOURCE_WARN_RATIO){
          warnings.push(key + ': snapshot count lower than independent source ' + snapshot + '/' + source + '; verify archive/read path');
        }
      }
    }
    return sourceCounts;
  }

  function assess(data, previous){
    const counts = {}, issues = [], warnings = [];
    let eventIntegrity = {
      logical_duplicate_group_count:0,
      logical_duplicate_groups:[],
      id_date_drift_count:0,
      id_date_drift:[],
      warnings:[]
    };
    for(const key of KEYS){
      const rows = data && data[key];
      counts[key] = Array.isArray(rows) ? rows.length : null;
      if(!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object' || Array.isArray(r))){
        issues.push(key + ': missing or invalid array');
        continue;
      }
      issues.push(...identityProblems(key, rows));
      if(key !== 'current_bookings' && counts[key] === 0 && previous && Array.isArray(previous[key]) && previous[key].length){
        issues.push(key + ': unexpectedly fell to zero');
      }
    }

    let sourceCounts = {};
    if(!issues.length){
      if(data.events.length === 0 && (data.bookings.length || (Array.isArray(data.web_ready) && data.web_ready.length))){
        issues.push('events: zero despite booking/public-feed evidence');
      }

      const collapses = collapseSignals(data, previous);
      if(collapses.length >= 2){
        issues.push('correlated snapshot count collapse: ' + collapses.map(x=>x.key + ' ' + x.before + '→' + x.after).join(', '));
      } else if(collapses.length === 1){
        const x = collapses[0];
        warnings.push(x.key + ': count dropped sharply ' + x.before + '→' + x.after + '; verify archive/read path');
      }

      sourceCounts = applySourceCountCrossCheck(data, counts, issues, warnings);

      const active = data.bookings.filter(workflowOpen);
      const currentIds = new Set(data.current_bookings.map(b=>String(b.booking_id)));
      const bookingIds = new Set(data.bookings.map(b=>String(b.booking_id)));
      if(active.some(b=>!currentIds.has(String(b.booking_id)))){
        warnings.push('current_bookings incomplete; Overview derives open work from bookings');
      }
      if(data.current_bookings.some(b=>!bookingIds.has(String(b.booking_id)))){
        warnings.push('current_bookings contains booking_id not present in bookings');
      }
      if(data.assets.length === 0 && data.bookings.some(b=>workflowOpen(b) && (b.phone_asset_id || b.lens_asset_id))){
        issues.push('assets: zero despite active asset assignments');
      }
      if(KEYS.every(k=>counts[k]===0)) warnings.push('All snapshot counts are zero; no independent evidence confirms an empty system');
    }
    if(data && Array.isArray(data.events)){
      eventIntegrity = eventIdentitySignals(data.events);
      warnings.push(...eventIntegrity.warnings);
    }
    return {
      ok:issues.length===0,
      counts,
      source_counts:sourceCounts,
      event_integrity:{
        logical_duplicate_group_count:eventIntegrity.logical_duplicate_group_count,
        logical_duplicate_groups:eventIntegrity.logical_duplicate_groups,
        id_date_drift_count:eventIntegrity.id_date_drift_count,
        id_date_drift:eventIntegrity.id_date_drift
      },
      issues,
      warnings
    };
  }

  function bangkokDay(now){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now || new Date());
  }
  function currentBookings(data){ return data.bookings.filter(workflowOpen); }
  function todayBookings(data, day){
    return currentBookings(data).filter(b=>String(b.event_date || '').slice(0,10)===(day || bangkokDay()))
      .sort((a,b)=>String(a.pickup_time||'').localeCompare(String(b.pickup_time||'')));
  }
  return {VERSION, BACKEND, KEYS, ID_FIELDS, SOURCE_COUNT_CHECKS, assess, sourceCountMap, workflowOpen, bangkokDay, currentBookings, todayBookings, normalizeEventIdentityText, normalizeEventDate, eventIdentitySignals};
});
