'use strict';

const DEFAULT_PHONE_PRICE = 890;
const DEFAULT_BUNDLE_PRICE = 1090;

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolvePrice({ manualPrice, marketPrice, marketFresh = false, standardPrice }) {
  const manual = positiveNumber(manualPrice);
  if (manual) return { price: manual, source: 'MANUAL_LOCKED' };

  const market = positiveNumber(marketPrice);
  if (market && marketFresh === true) return { price: market, source: 'MARKET_FRESH_EXACT' };

  const standard = positiveNumber(standardPrice);
  if (!standard) throw new Error('CONFIG_STANDARD_PRICE_MISSING');

  return { price: standard, source: 'DEFAULT_STANDARD' };
}

function resolvePackagePlan(input = {}) {
  const phoneAllowed = input.phoneAllowed !== false;
  const lensRule = String(input.lensRule || 'UNRESOLVED').trim().toUpperCase();
  const lensPermissionVerified = lensRule === 'VERIFIED_ALLOWED' && input.lensPermissionVerified === true;
  const explicitInquiryOnly = input.explicitInquiryOnly === true;

  if (!phoneAllowed) {
    return {
      phone: { enabled: false, reason: 'PHONE_RULE_BLOCKED' },
      bundle: { enabled: false, reason: 'PHONE_RULE_BLOCKED' },
      lensOnly: { enabled: false, reason: 'DEFAULT_DISABLED' }
    };
  }

  const phone = explicitInquiryOnly
    ? { enabled: true, inquiryOnly: true, price: 0, source: 'EXPLICIT_INQUIRY_ONLY' }
    : { enabled: true, ...resolvePrice({
        manualPrice: input.manualPhonePrice,
        marketPrice: input.marketPhonePrice,
        marketFresh: input.marketFresh === true,
        standardPrice: input.standardPhonePrice || DEFAULT_PHONE_PRICE
      }) };

  // A verified organizer permission is mandatory to sell an attachable lens.
  // Unknown, missing or prohibited rules must never auto-enable the bundle.
  const bundle = !lensPermissionVerified
    ? { enabled: false, reason: 'LENS_PERMISSION_NOT_VERIFIED', lensRuleAdvisory: lensRule }
    : explicitInquiryOnly
    ? { enabled: true, inquiryOnly: true, price: 0, source: 'EXPLICIT_INQUIRY_ONLY', lensRuleAdvisory: lensRule }
    : { enabled: true, ...resolvePrice({
        manualPrice: input.manualBundlePrice,
        marketPrice: input.marketBundlePrice,
        marketFresh: input.marketFresh === true,
        standardPrice: input.standardBundlePrice || DEFAULT_BUNDLE_PRICE
      }), lensRuleAdvisory: lensRule };

  return {
    phone,
    bundle,
    lensOnly: { enabled: false, reason: 'DEFAULT_DISABLED' }
  };
}

function hasUsablePoster(posterUrl) {
  const value = String(posterUrl || '').trim();
  return /^https?:\/\//i.test(value);
}

function classifyCapacity({ phoneFree = 0, lensFree = 0 }) {
  const p = Math.max(0, Number(phoneFree) || 0);
  const l = Math.max(0, Number(lensFree) || 0);
  if (p <= 0) return 'CAPACITY_BLOCKED';
  if (p === 1 || l === 0) return 'CAPACITY_TIGHT';
  return 'CAPACITY_OK';
}

function resolvePromotionState(input = {}) {
  if (!input.verified) return 'WAIT_VERIFIER';
  if (input.lifecycleBlocked) return 'BLOCK_LIFECYCLE';
  if (!input.identityExact) return 'HOLD_IDENTITY';
  if (!hasUsablePoster(input.posterUrl)) return 'POSTER_MISSING_DEBT';

  const capacity = classifyCapacity(input);
  if (capacity === 'CAPACITY_BLOCKED') return 'BLOCK_CAPACITY';

  const plan = resolvePackagePlan(input);
  if (!plan.phone.enabled && !plan.bundle.enabled) return 'HOLD_RULE';

  return 'READY_FOR_PROMOTION';
}

module.exports = {
  DEFAULT_PHONE_PRICE,
  DEFAULT_BUNDLE_PRICE,
  resolvePrice,
  resolvePackagePlan,
  hasUsablePoster,
  classifyCapacity,
  resolvePromotionState
};
