# KK Content Intelligence Foundation — 2026-09-25

## Objective

Build a lean content-learning foundation for KK Phone Rental focused on qualified organic reach and brand awareness before paid acquisition. The business currently has very limited rental inventory, so the system optimizes learning and brand recall rather than maximizing paid traffic.

## Architecture decision

This work follows the current AI Co-Work Blueprint principles: **REUSE BEFORE ADD** and **SCALE BY EVIDENCE, NOT BY COMPONENT COUNT**.

No new production runner, publisher, paid-ad automation, Machine SOT, or Hugging Face dependency was added.

The content layer is advisory:

Verified Event + approved pricing/inventory
→ Content Strategy Skill
→ Performance Memory
→ Creative Agent
→ owner review
→ manual publish
→ measured result
→ Performance Memory

The Creative Agent has no authority to publish, spend, change price, change inventory, or write Machine SOT.

## 1. Content Strategy Skill

Added:

- `skills/kk-content-strategy/SKILL.md`

The skill defines:

- organic reach + brand awareness as the current growth priority;
- a rolling ~70% useful/community vs ~30% sales content target;
- content pillars: seat view, photo tips, event info, review proof, engagement, direct rental;
- creative angles: event theme, artist, fandom, seat view, Lens need, problem/solution, convenience, trust;
- current X brand/copy contract;
- verified-fact and current-price requirements;
- seat-view source/reuse guidance;
- performance interpretation rules;
- human approval and zero-autonomy boundaries.

## 2. Creative Performance Memory

Reused the existing **KK Phone Rental — CRM & Intelligence** spreadsheet instead of creating another Source of Truth.

Spreadsheet:
https://docs.google.com/spreadsheets/d/1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU/edit

Added tabs:

### 17_Content_Performance

Post-level learning table with:

- platform, event, artist, venue;
- content pillar, content angle, objective;
- hook, CTA, sales intent, hashtags, asset type;
- impressions, engagements, profile visits, link clicks, inquiries, bookings;
- revenue and spend;
- automatic Engagement Rate, Cost per Booking, and Booking Rate;
- learning note and lifecycle status.

Controlled dropdowns and filters reduce taxonomy drift.

### 18_Content_Taxonomy

Canonical vocabulary for platform, pillar, angle, objective, CTA, sales intent, asset type, and status.

### 19_Content_Experiments

Traceable A/B hypothesis log with variable, variants, primary metric, guardrail metric, evidence count, result, decision, and notes.

## 3. Creative Agent

Added:

- `server/kk-content-performance.js`
- `server/kk-content-agent.js`
- `scripts/kk-content-agent-dry-run.js`

### Performance core

Summarizes measured posts by content pillar and angle.

Objective-specific metrics:

- awareness → average impressions per measured post;
- engagement → engagements / impressions;
- consideration → (profile visits + link clicks) / impressions;
- conversion → bookings / link clicks.

Evidence confidence:

- fewer than 3 measured posts → low / not enough for a recommendation nudge;
- 3–7 → medium;
- 8+ → high.

Historical performance is explicitly a **nudge**, not an automatic winner selector.

### Creative planner

Produces a structured plan with:

- useful awareness idea;
- Lens/photo education idea;
- community engagement idea;
- soft consideration idea;
- direct rental idea only when Event + pricing + price display + inventory are verified.

Safety contract is explicit:

- `human_approval_required=true`
- `auto_publish=false`
- `auto_spend=false`
- `writes_machine_sot=false`
- `changes_pricing=false`
- `authoritative_event_writer=false`

If commercial truth is incomplete, the direct-rental idea is returned as blocked and non-publishable.

## X copy contract encoded

For direct rental posts:

- first line: `📱 KK Phone Rental | #เช่ามือถือ`
- handoff: `📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน`
- file storage: `☁️ Google Drive 30 วัน`
- CTA: `👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/`
- 3–5 strongest relevant hashtags at the end;
- no duplicate brand line at the bottom;
- promotions only when current and verified;
- pricing only from current approved business truth.

## Verification

Local pre-commit validation on 2026-09-25:

- Node syntax check — PASS
- Content intelligence regression tests — 10/10 PASS
- Zero-write dry run — PASS
- production writes — 0
- publishes — 0
- ad spend changes — 0
- unverified direct rental — correctly BLOCKED

Repository CI / complete test suite is checked again through the pull request before merge.

## Rollout

Phase A — first 1–2 weeks:

1. publish manually;
2. capture real X performance in `17_Content_Performance`;
3. label each post using the controlled taxonomy;
4. log deliberate A/B tests in `19_Content_Experiments`;
5. use performance nudges only after minimum evidence exists.

Phase B — after enough evidence:

- refine content-calendar allocation by real KK data;
- identify which pillars create reach vs inquiries vs bookings;
- consider automated metric ingestion only if it reduces manual work without creating another source of truth.

## Explicitly not added

- no autonomous publisher;
- no autonomous Ads Manager budget control;
- no new Scanner/Verifier role;
- no Hugging Face content dependency;
- no new spreadsheet file;
- no paid-ad campaign launch;
- no production runtime scheduler.

## Rollback

The code is isolated in new content-intelligence modules and a project-local skill. Spreadsheet changes are isolated to new tabs 17–19. Existing Scanner, Verifier, booking, storefront, pricing, and admin flows are unchanged.
