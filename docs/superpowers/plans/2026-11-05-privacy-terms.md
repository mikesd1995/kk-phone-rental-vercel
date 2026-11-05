# Privacy and Terms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Provide truthful, accessible public Privacy and Terms on the existing domain and prepare the remaining owner domain/OAuth steps.
**Architecture:** Public standalone HTML documents with shared scoped CSS; homepage footer navigation only, no new data flow or runtime dependency.
**Tech Stack:** Existing static HTML/CSS/JavaScript, Node built-in tests, existing Agent Gateway, CUA browser QA.
**Spec:** docs/superpowers/specs/2026-11-05-privacy-terms.md

## Global Constraints
- Exact base/source b81fdf1d25e32eba9d843a302d66ddae24ccffc9, newbranch feat/privacy-terms-20261105. Do not include draft836.
- Homepage header/hero source identical. No backend/sender/CRM/price/inventory/policy writes; all operational flags remain OFF.
- Evidence-backed disclosures and original business terms. No invented identity/address, retention/refund numbers or Google acceptance.
- Owner handles credentials, consent, publishing decisions and ownership verification; exact new source merge/release approval remains separate.

## Review Focus
- Controller identity is owner-confirmed; contact location is unavailable: retain the legal limitation and do not invent public facts.
- Google data access/use/sharing/deletion and broad scopes accurately distinguished from privateAPI access controls.
- Public document can be read with JS disabled and without analytics/API/provider calls.
- Long Thai text/URLs at320px, footer reachability and focus/tap targets at all8 widths.
- Homepage hero/header and backend unaffected.

### Task 1: Public documents and navigation
**Files:** privacy/index.html, terms/index.html, assets/kk-legal.css, index.html, script.js only if footer TH/EN binding needs it; tests/public-legal-documents.test.js; evidence docs.
- [x] Record pre-implementation Agent Gateway UX review and source header/hero hashes.
- [x] Add meaningful failing public-link/document-security tests; run and record RED.
- [x] Implement source-evidenced content, semantic headings/TOC/nav/contact/deletion route and minimal footer links.
- [x] Run targeted tests and exact header/hero diff/hash check. No invented address or public placeholders.
- [x] Independently review content against official requirements and actual practices.
- [x] Render all3 pages at8widths; capture screenshots/metrics, gatewayVisualQA and final review; fix defects.
- [x] Run code:test, full regression required by context, syntax/diff and engineering gate. Repair the proven stale baseline share-helper assertion without runtime changes; full2507+29 pass.
- [ ] Commit the local candidate and prepare exact-source/content approval. GitHub is public; defer publishing owner-name-bearing source until this concrete approval, then run CI and protected release only within that authority.

### Task 2: Domain and OAuth owner preparation
**Files:** packet-only owner guide/readback/authority docs under outputs/kk-privacy-terms-20261105.
- [x] Inspect current Google Search Console/Branding metadata without secrets; prepare supported URL-prefix path, no unilateral access grant/publish.
- [ ] Verify real public pages after exact approved release; then prepare Branding URLs and owner consent/refresh-token steps.
- [ ] Retain failed health budget as consumed; new single-health allowance and exact samecode env refresh only after owner save.
- [ ] Store current handoff/memory/percentage and all remaining gates. Request only concrete final owner action when work is ready.
