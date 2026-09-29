# Storefront Canonical Poster Delivery Fallback — 2026-09-30

## Trigger

Owner reported that storefront event posters could still appear missing and asked whether the earlier poster fixes had actually been completed.

## Historical fixes confirmed

Production already contains the previous poster hardening:
- PR #257: keep event cards visible when poster delivery fails;
- PR #260: preserve already-decoded Safari/iOS images before timeout fallback;
- PR #316: canonical `poster_image_url` outranks emergency hard-coded overrides.

The live `script.js` was inspected and contains all three behaviors.

## Current Production evidence

The public event feed currently has 73 visible `show/show_full` rows and zero blank `poster_image_url` values, so this is not a missing-data-field defect.

For 30 Sep 2026:
- `Nineentertain 24th Anniversary Charity Concert` is visible and its canonical poster points to `wx2.sinaimg.cn`.
- The verified local poster `/assets/event-posters/nineentertain-24th-anniversary-charity-concert-2026-09-30.jpg` exists in Production and returns HTTP 200 / image/jpeg.
- External fetch verification of the Sina canonical poster timed out.

The local emergency poster existed, but after canonical-SOT precedence was hardened it was only used when the canonical field was blank. It was not retained as a fallback when a non-blank canonical URL failed during delivery.

## Root cause

Data precedence and delivery fallback had been coupled:

`canonical || emergency`

This correctly chose canonical data, but discarded the emergency poster from the image candidate chain whenever canonical was non-empty.

## Fix

Canonical SOT remains first and unchanged.

The storefront now builds image candidates as:
1. canonical poster candidates;
2. verified emergency poster candidates, appended only when different;
3. duplicate URLs removed.

Thus an emergency poster cannot override a valid canonical image, but it can recover a real delivery failure.

## Regression coverage

Tests lock:
- canonical `poster_image_url` remains first;
- emergency override remains delivery fallback only;
- thumbnail and modal candidate chains both retain the fallback;
- Nineentertain local verified asset remains covered.

## Safety

No event, booking, price, stock, Google Sheet, or Apps Script data is mutated by this fix.
