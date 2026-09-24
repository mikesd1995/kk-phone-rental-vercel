'use strict';

const OBJECTIVES = Object.freeze(['awareness', 'engagement', 'consideration', 'conversion']);
const DEFAULT_MIN_SAMPLE = 3;

function cleanText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function nonNegativeNumber(value) {
  if (value == null || value === '') return 0;
  const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function rate(numerator, denominator) {
  const n = nonNegativeNumber(numerator);
  const d = nonNegativeNumber(denominator);
  return d > 0 ? n / d : 0;
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] != null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function normalizeRow(row = {}) {
  return {
    post_id: cleanText(firstValue(row, ['Post_ID', 'post_id', 'postId'])),
    status: cleanText(firstValue(row, ['Status', 'status'])).toLowerCase(),
    platform: cleanText(firstValue(row, ['Platform', 'platform'])),
    content_pillar: cleanText(firstValue(row, ['Content_Pillar', 'content_pillar', 'pillar'])).toLowerCase(),
    content_angle: cleanText(firstValue(row, ['Content_Angle', 'content_angle', 'angle'])).toLowerCase(),
    objective: cleanText(firstValue(row, ['Objective', 'objective'])).toLowerCase(),
    impressions: nonNegativeNumber(firstValue(row, ['Impressions', 'impressions'])),
    engagements: nonNegativeNumber(firstValue(row, ['Engagements', 'engagements'])),
    profile_visits: nonNegativeNumber(firstValue(row, ['Profile_Visits', 'profile_visits', 'profileVisits'])),
    link_clicks: nonNegativeNumber(firstValue(row, ['Link_Clicks', 'link_clicks', 'linkClicks'])),
    inquiries: nonNegativeNumber(firstValue(row, ['Inquiries', 'inquiries'])),
    bookings: nonNegativeNumber(firstValue(row, ['Bookings', 'bookings'])),
    revenue_thb: nonNegativeNumber(firstValue(row, ['Revenue_THB', 'revenue_thb', 'revenue'])),
    spend_thb: nonNegativeNumber(firstValue(row, ['Spend_THB', 'spend_thb', 'spend']))
  };
}

function isMeasured(row) {
  if (!row) return false;
  if (row.status === 'measured') return true;
  return row.impressions > 0 || row.engagements > 0 || row.profile_visits > 0 ||
    row.link_clicks > 0 || row.inquiries > 0 || row.bookings > 0 || row.spend_thb > 0;
}

function confidenceBand(sampleCount) {
  const count = Math.max(0, Number(sampleCount) || 0);
  if (count >= 8) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
}

function aggregateRows(rows, objective) {
  const totals = rows.reduce((acc, row) => {
    acc.impressions += row.impressions;
    acc.engagements += row.engagements;
    acc.profile_visits += row.profile_visits;
    acc.link_clicks += row.link_clicks;
    acc.inquiries += row.inquiries;
    acc.bookings += row.bookings;
    acc.revenue_thb += row.revenue_thb;
    acc.spend_thb += row.spend_thb;
    return acc;
  }, {
    impressions: 0,
    engagements: 0,
    profile_visits: 0,
    link_clicks: 0,
    inquiries: 0,
    bookings: 0,
    revenue_thb: 0,
    spend_thb: 0
  });

  const sampleCount = rows.length;
  const metrics = {
    sample_count: sampleCount,
    avg_impressions: sampleCount ? totals.impressions / sampleCount : 0,
    engagement_rate: rate(totals.engagements, totals.impressions),
    consideration_rate: rate(totals.profile_visits + totals.link_clicks, totals.impressions),
    inquiry_rate: rate(totals.inquiries, totals.link_clicks),
    booking_rate: rate(totals.bookings, totals.link_clicks),
    cost_per_booking: totals.bookings > 0 ? totals.spend_thb / totals.bookings : null,
    ...totals
  };

  if (objective === 'engagement') metrics.primary_metric = metrics.engagement_rate;
  else if (objective === 'consideration') metrics.primary_metric = metrics.consideration_rate;
  else if (objective === 'conversion') metrics.primary_metric = metrics.booking_rate;
  else metrics.primary_metric = metrics.avg_impressions;

  return metrics;
}

function groupSummary(rows, key, objective, minSample) {
  const groups = new Map();
  for (const row of rows) {
    const value = cleanText(row[key]).toLowerCase();
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }

  return [...groups.entries()]
    .map(([value, items]) => {
      const metrics = aggregateRows(items, objective);
      return {
        value,
        ...metrics,
        confidence: confidenceBand(metrics.sample_count),
        enough_evidence: metrics.sample_count >= minSample
      };
    })
    .sort((a, b) => {
      if (b.primary_metric !== a.primary_metric) return b.primary_metric - a.primary_metric;
      if (b.sample_count !== a.sample_count) return b.sample_count - a.sample_count;
      return a.value.localeCompare(b.value);
    });
}

function summarizePerformance(rows, options = {}) {
  const objective = cleanText(options.objective || 'awareness').toLowerCase();
  if (!OBJECTIVES.includes(objective)) {
    throw new Error(`unsupported objective: ${objective || '(empty)'}`);
  }
  const minSample = Number.isInteger(options.min_sample) && options.min_sample > 0
    ? options.min_sample
    : DEFAULT_MIN_SAMPLE;

  const normalized = Array.isArray(rows) ? rows.map(normalizeRow).filter(isMeasured) : [];
  const overall = aggregateRows(normalized, objective);
  const byPillar = groupSummary(normalized, 'content_pillar', objective, minSample);
  const byAngle = groupSummary(normalized, 'content_angle', objective, minSample);

  const evidenceNudges = [];
  const topPillar = byPillar.find(item => item.enough_evidence);
  const topAngle = byAngle.find(item => item.enough_evidence);
  if (topPillar) {
    evidenceNudges.push({
      dimension: 'content_pillar',
      value: topPillar.value,
      objective,
      sample_count: topPillar.sample_count,
      primary_metric: topPillar.primary_metric,
      confidence: topPillar.confidence,
      guidance: 'Use as an evidence nudge, not as an automatic winner or a reason to stop testing other pillars.'
    });
  }
  if (topAngle) {
    evidenceNudges.push({
      dimension: 'content_angle',
      value: topAngle.value,
      objective,
      sample_count: topAngle.sample_count,
      primary_metric: topAngle.primary_metric,
      confidence: topAngle.confidence,
      guidance: 'Use as an evidence nudge, not as an automatic winner or a reason to stop testing other angles.'
    });
  }

  return {
    schema_version: 'KK_CONTENT_PERFORMANCE_SUMMARY_V1',
    objective,
    measured_posts: normalized.length,
    minimum_sample_for_nudge: minSample,
    overall: {
      ...overall,
      confidence: confidenceBand(overall.sample_count)
    },
    by_pillar: byPillar,
    by_angle: byAngle,
    evidence_nudges: evidenceNudges,
    interpretation_rule: 'Performance history informs creative choices but never overrides verified event truth, pricing, inventory, or human approval.'
  };
}

module.exports = {
  OBJECTIVES,
  DEFAULT_MIN_SAMPLE,
  cleanText,
  nonNegativeNumber,
  rate,
  normalizeRow,
  isMeasured,
  confidenceBand,
  summarizePerformance
};
