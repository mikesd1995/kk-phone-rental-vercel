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

  function bookingTimingSignals(rows){
    const source=Array.isArray(rows)?rows:[];
    const active=source.filter(workflowOpen);
    const missingPickup=active.filter(b=>!String(b&&b.pickup_time||'').trim());
    const missingReturn=active.filter(b=>!String(b&&b.return_time||'').trim());
    return {
      active_count:active.length,
      missing_pickup_time_count:missingPickup.length,
      missing_return_time_count:missingReturn.length,
      pickup_time_policy:'OPTIONAL_TBD',
      return_time_policy:'OPTIONAL',
      fallback_policy:'00:00 event day to 06:00 next day when pickup/return are unknown',
      warnings:[]
    };
  }

  function storefrontIntegritySignals(data, today){
    const events=Array.isArray(data&&data.events)?data.events:[];
    const webReady=Array.isArray(data&&data.web_ready)?data.web_ready:[];
    const webPackages=Array.isArray(data&&data.web_packages)?data.web_packages:[];
    const eventIds=new Set(events.map(e=>String(e&&e.event_id||'').trim()).filter(Boolean));
    const day=today||bangkokDay();

    const invalidPackageRows=webPackages.filter(p=>{
      return !String(p&&p.package_id||'').trim() ||
        !String(p&&p.event_id||'').trim() ||
        !String(p&&p.package_type||'').trim();
    });
    const orphanPackages=webPackages.filter(p=>{
      const id=String(p&&p.event_id||'').trim();
      return id && eventIds.size>0 && !eventIds.has(id);
    });
    const negativeAvailability=webPackages.filter(p=>{
      const raw=p&&p.raw_available_count;
      const effective=p&&p.available_count;
      return (raw!==''&&raw!==null&&raw!==undefined&&Number(raw)<0) ||
        (effective!==''&&effective!==null&&effective!==undefined&&Number(effective)<0);
    });
    const publishedReady=webReady.filter(r=>{
      const action=String(r&&r.action_for_web||'show').trim().toLowerCase();
      const active=r&&r.active_on_web;
      return action!=='hide' && active!==false && String(active).toLowerCase()!=='false';
    });
    const missingPoster=publishedReady.filter(r=>!String(r&&r.poster_image_url||r&&r.poster_url||'').trim());
    const publishedPast=publishedReady.filter(r=>{
      const date=normalizeEventDate(r&& (r.event_date||r.event_date_text||r.date));
      return !!date && date<day;
    });
    const orphanReady=webReady.filter(r=>{
      const id=String(r&&r.event_id||'').trim();
      return id && eventIds.size>0 && !eventIds.has(id);
    });

    const venueGroups=new Map();
    events.forEach(e=>{
      const venue=String(e&&e.venue||'').trim();
      if(!venue)return;
      const key=venue.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s._-]+/g,'');
      if(!key)return;
      if(!venueGroups.has(key))venueGroups.set(key,new Set());
      venueGroups.get(key).add(venue);
    });
    const venueVariants=[...venueGroups.entries()]
      .filter(([,values])=>values.size>1)
      .map(([key,values])=>({key,variants:[...values].slice(0,5)}));

    const warnings=[];
    const push=(count,label,sample)=>{
      if(!count)return;
      warnings.push('storefront: '+label+' '+count+(sample&&sample.length?'; sample '+sample.slice(0,3).join(', '):''));
    };
    push(invalidPackageRows.length,'invalid web package identity rows',invalidPackageRows.map(p=>String(p&&p.package_id||'(blank)')));
    push(orphanPackages.length,'orphan web packages',orphanPackages.map(p=>String(p&&p.event_id||'')));
    push(negativeAvailability.length,'negative package availability rows',negativeAvailability.map(p=>String(p&&p.package_id||'')));
    push(missingPoster.length,'published events missing poster',missingPoster.map(r=>String(r&&r.event_id||'')));
    push(publishedPast.length,'published past events',publishedPast.map(r=>String(r&&r.event_id||'')));
    push(orphanReady.length,'orphan web-ready events',orphanReady.map(r=>String(r&&r.event_id||'')));
    if(venueVariants.length){
      warnings.push('storefront: venue naming variants '+venueVariants.length+'; sample '+venueVariants.slice(0,3).map(v=>v.variants.join(' / ')).join(', '));
    }

    return {
      invalid_package_identity_count:invalidPackageRows.length,
      orphan_package_count:orphanPackages.length,
      negative_availability_count:negativeAvailability.length,
      missing_poster_count:missingPoster.length,
      published_past_event_count:publishedPast.length,
      orphan_web_ready_count:orphanReady.length,
      venue_variant_group_count:venueVariants.length,
      samples:{
        invalid_packages:invalidPackageRows.slice(0,5).map(p=>String(p&&p.package_id||'')),
        orphan_packages:orphanPackages.slice(0,5).map(p=>String(p&&p.event_id||'')),
        missing_posters:missingPoster.slice(0,5).map(r=>String(r&&r.event_id||'')),
        published_past_events:publishedPast.slice(0,5).map(r=>String(r&&r.event_id||'')),
        venue_variants:venueVariants.slice(0,5)
      },
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
    let bookingTiming = {
      active_count:0,
      missing_pickup_time_count:0,
      missing_return_time_count:0,
      warnings:[]
    };
    let storefrontIntegrity = storefrontIntegritySignals(data||{});
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
    if(data && Array.isArray(data.bookings)){
      bookingTiming = bookingTimingSignals(data.bookings);
      warnings.push(...bookingTiming.warnings);
    }
    storefrontIntegrity = storefrontIntegritySignals(data||{});
    warnings.push(...storefrontIntegrity.warnings);
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
      booking_timing:{
        active_count:bookingTiming.active_count,
        missing_pickup_time_count:bookingTiming.missing_pickup_time_count,
        missing_return_time_count:bookingTiming.missing_return_time_count,
        pickup_time_policy:bookingTiming.pickup_time_policy,
        return_time_policy:bookingTiming.return_time_policy,
        fallback_policy:bookingTiming.fallback_policy
      },
      storefront_integrity:{
        invalid_package_identity_count:storefrontIntegrity.invalid_package_identity_count,
        orphan_package_count:storefrontIntegrity.orphan_package_count,
        negative_availability_count:storefrontIntegrity.negative_availability_count,
        missing_poster_count:storefrontIntegrity.missing_poster_count,
        published_past_event_count:storefrontIntegrity.published_past_event_count,
        orphan_web_ready_count:storefrontIntegrity.orphan_web_ready_count,
        venue_variant_group_count:storefrontIntegrity.venue_variant_group_count,
        samples:storefrontIntegrity.samples
      },
      issues,
      warnings
    };
  }

  function bangkokDay(now){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now || new Date());
    const byType=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }
  function currentBookings(data){ return data.bookings.filter(workflowOpen); }
  function todayBookings(data, day){
    return currentBookings(data).filter(b=>String(b.event_date || '').slice(0,10)===(day || bangkokDay()))
      .sort((a,b)=>String(a.pickup_time||'').localeCompare(String(b.pickup_time||'')));
  }
  return {VERSION, BACKEND, KEYS, ID_FIELDS, SOURCE_COUNT_CHECKS, assess, sourceCountMap, workflowOpen, bangkokDay, currentBookings, todayBookings, normalizeEventIdentityText, normalizeEventDate, eventIdentitySignals, bookingTimingSignals, storefrontIntegritySignals};
});
