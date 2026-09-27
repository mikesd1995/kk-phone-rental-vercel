# KK Creative Production v1 — Image + Motion

Date: 2026-09-27

## Goal
Create a governed creative-production layer for KK Phone Rental so image and short-form motion work follows the owner's brief instead of loosely regenerating supplied artwork.

## Runtime boundary
This layer is advisory/read-only. It has **0 production business writes**, cannot publish content, cannot change prices/bookings, cannot merge/deploy, and requires owner review.

## Pipeline
1. Creative brief lock
2. Source asset/reference guard
3. Layout/compositing plan for images OR layer/motion plan for video
4. Brand guard
5. Media QA
6. Owner review

## Reference preservation
When official posters/photos are supplied, default behavior is **edit and preserve**, not regenerate. The QA gate fails closed when a required source asset is dropped, artist identity changes, official artwork is replaced, required copy disappears, the logo is distorted, or facts are invented.

## Motion capability contract
Motion jobs support a professional editing plan: layered parallax, controlled camera movement, light sweep/glow/particles, timing, seamless loop requirements, and output profiles for X/Reels/Stories. QA also checks flicker, subject warp and text jitter.

This contract deliberately separates AI generation from professional motion editing. Generation is allowed only when explicitly requested or when there is no reference asset to preserve.

## Learning loop
Creative feedback should be recorded as structured decision/feedback evidence and promoted into stable rules only after repeated evidence. The agent must not rewrite its own authority or deploy itself.

## Acceptance
- Supplied assets remain accounted for.
- No artist identity substitution.
- No invented event facts or prices.
- Video reports duration/fps and passes flicker/warp/text checks.
- Owner review remains mandatory before publication.
