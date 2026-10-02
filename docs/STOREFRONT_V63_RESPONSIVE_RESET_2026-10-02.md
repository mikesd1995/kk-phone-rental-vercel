# Storefront V6.3 Responsive Reset — 2026-10-02

## Trigger

Owner desktop and iPhone production screenshots showed a release-quality regression: event cards could break out of the catalogue grid on desktop, service icons still looked like placeholder glyphs, raw localization keys were visible in the lower page, and accumulated V5/V6 overrides made responsive behavior unpredictable.

## Root causes

1. The active storefront stylesheet had become a long cascade of historical visual overrides rather than one authoritative presentation layer.
2. Desktop catalogue geometry was not hard-contained against inherited card/poster rules.
3. The visual QA workflow did not include `assets/kk-storefront-v5.css` in its pull-request path trigger, even though that file was the active storefront visual layer.
4. The visual QA harness invoked UX Reviewer, Art Director and Visual Critic, but did not execute the full seven-role Storefront Design Council.
5. There was no release-blocking check for customer-visible raw i18n keys.
6. Desktop evidence stopped at 1024px, so large-screen composition was not explicitly gated.
7. Unicode/emoji glyphs were being used as part of the UI icon language and rendered inconsistently across platforms.

## V6.3 remediation

- Replaced the accumulated V5/V6 visual cascade with one V6.3 responsive presentation layer.
- Locked the event catalogue to a contained two-column desktop grid, two columns on normal phones/tablets, and one column on very narrow phones.
- Added explicit `min-width:0`, max-width and overflow containment for cards, poster media, metadata and package surfaces.
- Replaced service/theme/search placeholder glyphs with consistent inline SVG icons.
- Rebuilt desktop/mobile discovery controls, modal/bottom-sheet, booking journey and footer spacing.
- Added a short-phone acceptance correction so 320x568 still reaches event content promptly.
- Restored >=44px language targets and a single aligned filter row.
- Removed customer-facing emoji decoration from key controls/copy.
- Added localization fail-safe and a P0 visual-QA blocker for raw i18n keys.
- Added 1440x900 to required visual acceptance.

## AI / agent execution

Storefront Automated Visual QA now executes all seven deterministic storefront reviewer agents on every acceptance viewport:

1. kk-storefront-art-director
2. kk-storefront-ux-reviewer
3. kk-storefront-conversion-reviewer
4. kk-storefront-fandom-reviewer
5. kk-storefront-accessibility-reviewer
6. kk-storefront-performance-reviewer
7. kk-storefront-visual-critic

Any P0/P1 council finding blocks technical visual acceptance. Reviewers remain read-only and cannot merge, deploy, alter pricing, booking, inventory or production data.

## Guardrails

- No pricing, inventory, availability, booking semantics, LINE destination, Admin, Apps Script or production business-data behavior changed.
- No QA or production gate is bypassed.
- Vercel preview/production deployment remains subject to the existing account deployment rate limit.
- Owner visual acceptance remains separate from automated technical acceptance.
