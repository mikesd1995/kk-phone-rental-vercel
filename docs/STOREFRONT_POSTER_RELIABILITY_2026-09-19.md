# Storefront poster reliability hardening — 2026-09-19

## Incident
Some users intermittently observed event cards without posters even though `01_Events` and `08_Web_Ready` contained valid `poster_image_url` values.

A live full-page browser diagnostic checked 32 currently rendered event cards and all 32 posters loaded successfully. This rules out a persistent Sheet/formula-wide failure and points to intermittent browser/network delivery behavior.

## Root weakness
The previous image fallback advanced only on the browser `error` event. Safari/iOS and mobile networks can leave Google-hosted image requests pending for a long time without firing `error`, so the fallback chain may never advance.

## Changes
- prefer `lh3.googleusercontent.com` as the first Drive image candidate to avoid an extra thumbnail redirect;
- retain Drive thumbnail and `uc?export=view` as independent fallback candidates;
- add bounded timeout failover (4s for first six cards, 6s for later lazy cards);
- cancel stale timers/handlers when a reused modal image starts loading a new event;
- preload the exact first thumbnail candidate rather than the original source URL;
- eagerly load the first six event posters; later cards remain lazy;
- assign high fetch priority only to the first two cards;
- preserve the existing placeholder only after all candidates are exhausted.

## Safety
No event, booking, price, Sheet, Apps Script, Admin, Scanner, Verifier, Canary, Make, HF or customer data is mutated by this change.
