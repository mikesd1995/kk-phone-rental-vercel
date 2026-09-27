'use strict';

const CREATIVE_PRODUCTION_VERSION = 'KK_CREATIVE_PRODUCTION_V1';

const OUTPUT_PROFILES = Object.freeze({
  x_square: Object.freeze({ width: 1080, height: 1080, aspect_ratio: '1:1' }),
  x_landscape: Object.freeze({ width: 1600, height: 900, aspect_ratio: '16:9' }),
  reel_story: Object.freeze({ width: 1080, height: 1920, aspect_ratio: '9:16' })
});

const MOTION_PRESETS = Object.freeze({
  subtle_alive: Object.freeze({
    duration_seconds: 6,
    fps: 30,
    camera: 'slow_push_in',
    subject_motion: 'micro_parallax',
    background_motion: 'slow_depth_drift',
    effects: Object.freeze(['light_sweep', 'soft_glow']),
    loop: 'seamless'
  }),
  concert_energy: Object.freeze({
    duration_seconds: 6,
    fps: 30,
    camera: 'controlled_push_pull',
    subject_motion: 'layered_parallax',
    background_motion: 'energy_particles',
    effects: Object.freeze(['light_sweep', 'controlled_particles', 'beat_accents']),
    loop: 'seamless'
  })
});

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function unique(value) {
  return [...new Set(list(value).map(item => String(item).trim()).filter(Boolean))];
}

function buildCreativeBrief(input = {}) {
  const assetIds = unique(input.asset_ids);
  const preserve = unique(input.preserve || ['artist_identity', 'official_artwork', 'logo_geometry', 'required_copy']);
  const forbidden = unique(input.forbidden || ['replace_artist_face', 'invent_event_facts', 'invent_price', 'drop_required_asset']);
  const outputProfile = OUTPUT_PROFILES[input.output_profile] || OUTPUT_PROFILES.x_square;
  const motionPreset = input.media_type === 'video'
    ? (MOTION_PRESETS[input.motion_preset] || MOTION_PRESETS.subtle_alive)
    : null;

  return {
    schema_version: CREATIVE_PRODUCTION_VERSION,
    media_type: input.media_type === 'video' ? 'video' : 'image',
    objective: String(input.objective || '').trim(),
    source_assets: assetIds,
    source_asset_count: assetIds.length,
    preserve,
    forbidden,
    brand_rules: {
      brand: 'KK Phone Rental',
      theme_rule: '1 theme / 2 artist / 3 fandom',
      keep_official_event_visuals_when_supplied: true,
      prefer_edit_over_regenerate_for_supplied_artwork: true
    },
    output: outputProfile,
    motion: motionPreset,
    production_writes: 0,
    autonomous_publish: false,
    owner_review_required: true
  };
}

function validateCreativeOutput(brief = {}, result = {}) {
  const blockers = [];
  const warnings = [];
  const used = new Set(unique(result.asset_ids_used));

  if (brief.source_asset_count > 0) {
    for (const assetId of brief.source_assets || []) {
      if (!used.has(assetId)) blockers.push('MISSING_SOURCE_ASSET:' + assetId);
    }
  }

  if (result.artist_identity_changed === true) blockers.push('ARTIST_IDENTITY_CHANGED');
  if (result.official_artwork_replaced === true) blockers.push('OFFICIAL_ARTWORK_REPLACED');
  if (result.required_copy_missing === true) blockers.push('REQUIRED_COPY_MISSING');
  if (result.logo_distorted === true) blockers.push('LOGO_DISTORTED');
  if (result.invented_fact === true) blockers.push('INVENTED_FACT');

  if (brief.media_type === 'video') {
    if (result.flicker === true) blockers.push('VIDEO_FLICKER');
    if (result.loop_seam_visible === true) warnings.push('LOOP_SEAM_VISIBLE');
    if (result.text_jitter === true) blockers.push('TEXT_JITTER');
    if (result.subject_warp === true) blockers.push('SUBJECT_WARP');
    if (!Number.isFinite(Number(result.duration_seconds))) warnings.push('DURATION_NOT_REPORTED');
    if (!Number.isFinite(Number(result.fps))) warnings.push('FPS_NOT_REPORTED');
  }

  return {
    schema_version: 'KK_CREATIVE_QA_V1',
    pass: blockers.length === 0,
    blockers,
    warnings,
    source_asset_count: brief.source_asset_count || 0,
    used_asset_count: used.size,
    production_writes: 0,
    autonomous_publish: false
  };
}

function buildProductionPlan(input = {}) {
  const brief = buildCreativeBrief(input);
  const stages = [
    'CREATIVE_BRIEF_LOCK',
    'SOURCE_ASSET_GUARD',
    brief.media_type === 'video' ? 'LAYER_AND_MOTION_PLAN' : 'LAYOUT_AND_COMPOSITE_PLAN',
    'BRAND_GUARD',
    'MEDIA_QA',
    'OWNER_REVIEW'
  ];
  return {
    schema_version: 'KK_CREATIVE_PRODUCTION_PLAN_V1',
    brief,
    stages,
    execution_policy: {
      supplied_artwork_mode: 'EDIT_PRESERVE_REFERENCE',
      generation_mode: 'ONLY_WHEN_EXPLICIT_OR_NO_REFERENCE_ASSET',
      fail_closed_on_identity_change: true,
      fail_closed_on_missing_required_asset: true,
      owner_review_required: true
    },
    production_writes: 0,
    autonomous_publish: false
  };
}

module.exports = {
  CREATIVE_PRODUCTION_VERSION,
  OUTPUT_PROFILES,
  MOTION_PRESETS,
  buildCreativeBrief,
  validateCreativeOutput,
  buildProductionPlan
};
