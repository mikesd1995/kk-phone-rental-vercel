'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Creative = require('../server/kk-creative-production.js');

test('video production plan preserves supplied assets and uses motion stages', () => {
  const plan = Creative.buildProductionPlan({
    media_type: 'video',
    asset_ids: ['poster-a', 'poster-b'],
    motion_preset: 'subtle_alive'
  });
  assert.equal(plan.brief.media_type, 'video');
  assert.equal(plan.brief.source_asset_count, 2);
  assert.equal(plan.brief.motion.duration_seconds, 6);
  assert.ok(plan.stages.includes('LAYER_AND_MOTION_PLAN'));
  assert.equal(plan.execution_policy.supplied_artwork_mode, 'EDIT_PRESERVE_REFERENCE');
  assert.equal(plan.autonomous_publish, false);
});

test('QA fails closed when a supplied asset is dropped', () => {
  const brief = Creative.buildCreativeBrief({ asset_ids: ['a', 'b'] });
  const qa = Creative.validateCreativeOutput(brief, { asset_ids_used: ['a'] });
  assert.equal(qa.pass, false);
  assert.ok(qa.blockers.includes('MISSING_SOURCE_ASSET:b'));
});

test('video QA rejects identity warp and flicker', () => {
  const brief = Creative.buildCreativeBrief({ media_type: 'video', asset_ids: ['poster'] });
  const qa = Creative.validateCreativeOutput(brief, {
    asset_ids_used: ['poster'],
    artist_identity_changed: true,
    flicker: true,
    duration_seconds: 6,
    fps: 30
  });
  assert.equal(qa.pass, false);
  assert.ok(qa.blockers.includes('ARTIST_IDENTITY_CHANGED'));
  assert.ok(qa.blockers.includes('VIDEO_FLICKER'));
});
