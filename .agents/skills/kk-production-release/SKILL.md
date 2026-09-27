---
name: kk-production-release
description: Use for KK Phone Rental production deployment, Vercel promotion/recovery, rollout acceptance and rollback planning. Requires exact source identity, environment safety, read-only acceptance before mutation, and post-deploy readback.
---

# KK Production Release

## Before mutation

Require exact approved source SHA, CI/regression status, current Production deployment identity, target environment compatibility and rollback target. Do not bypass account/quota/security gates.

## Release rule

Prefer the smallest existing governed release path. Do not create trigger commits merely to force a deployment.

A deployment request is not acceptance. After rollout verify target READY state, intended source/runtime tree, critical routes, recent runtime errors and task-specific acceptance.

If Preview and Production environment bindings differ materially, do not promote Preview merely because code trees match.
