# KK Phone Rental X Copy — Owner Agent Enforcement V2 (2026-10-22)

## Required on EVERY direct-rental post request

1. Verify live `01_Events`, `08_Web_Ready`, `09_Web_Packages` by **event_id and date**; honor owner-hidden and full dates; never invent price, availability, venue or tag.
2. Fetch **previous post text**, preferring confirmed X post URLs over `planned` / `assumed_posted` entries in `18_X_Post_Log`. Include prior ChatGPT copy as `chat_drafts` when available, but **do not label it public X history**.
3. Supply `recent_posts` and `recent_context_source` (`confirmed_x`, `confirmed_x_and_chat`, or `chat_drafts`), with `recent_context_checked=true`; confirmed X entries require `recent_post_urls`. Supply **at least 2 verified event DNA anchors**.
4. Internal generation: **3 distinct candidates for every event**, each with differentiated angle, evidence-grounded facts, metrics and official verified hashtags.
5. Single event: create owner-authored GitHub issue `[KK-CONTENT-RUN]`; 2–12 events: create `[KK-CONTENT-BATCH]`. A batch of >12 should be split into batches, with **cross-batch manual anti-repeat**.
6. Only after a **persisted result comment** reports `PASS`, verified `READY_FOR_OWNER_REVIEW`, per-item Content QA and Selector PASS, exact five required/invoked agent names, invocation ID and (batch) Diversity QA PASS: return one selected copy per event as **Agent-validated**.
7. If action, read-back, history, safety or facts fail, say **NOT VERIFIED / BLOCKED**. Do not replace failed Agent runs with text while claiming validation.
8. **Owner CTA policy**: custom event-specific CTA lead is a *separate prose line immediately BEFORE* the canonical final booking line `👉 จองเลย: https://kk-phone-rental.vercel.app/`. Never put custom prose after 👉. For full-only events use honest sold-out/thank-you copy and no booking invitation. Avoid dates in the hook and CTA lead. Never display count of rental devices.
9. Offer line `📸 vivo X300 Pro <phone>฿ | เพิ่มเลนส์ +<bundle - phone>฿` based only on available `phone_only` and `phone_lens_bundle` packages. Venue immediately below title; show every event date with ✅/❌.
10. Human review always required. **No auto-publish, no paid model, no price/stock write, no merge/deploy before safety gates and owner approval.**

## What runs vs what does not

- GitHub bridge: deterministic **Marketing → Strategy → Content Agent → QA → Selector** with ledger evidence. ChatGPT composes initial candidate language; do not imply a separate text-generating model unless one actually ran.
- Learning AI: current `17_Content_Performance` observed **header only** on 2026-10-22: `RULE_BASED_COLD_START`. Never claim engagement-learning success without confirmed measured posts.
- Hugging Face: OAuth account connected but `model_search` returned `Tool model_search not found` on 2026-10-22. Do not invoke billed jobs or claim HF model inference; deterministic QA fallback may run but must be labeled correctly.
- Current X post log observed as stale relative to 2026-10-22 and with `assumed_posted` entries; those do not prove publication or total historical duplicate coverage.

## Acceptance tests

- CTA lead present before canonical `👉 จองเลย` for every direct rental candidate; block missing generic/canned or date-filled leads and leaked device count.
- Batch block repeated CTA-lead skeletons **as well as** repeated hooks.
- Block unrecorded history source, no old-copy input, unverified facts or hashtags, unavailable stock.
- Bridge should block malformed/non-owner issue envelopes before invoking agents.
- No hard-coded one-size-fits-all CTA copy in new requests. Legacy CTA only remains as a compatibility path for pre-V2 non-owner-contract QA callers, not new bridge direct-rental runs.

References: [Issue #784](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/784); `docs/CHAT_CONTENT_AGENT_BRIDGE_2026-09-28.md`; `docs/CONTENT_BATCH_DIVERSITY_AGENT_BRIDGE_2026-10-01.md`.
