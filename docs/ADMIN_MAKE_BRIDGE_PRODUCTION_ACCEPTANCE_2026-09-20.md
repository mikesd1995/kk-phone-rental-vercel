# Admin Make Bridge production acceptance — 2026-09-20

Purpose: create an auditable production deployment checkpoint for the already-merged guarded Make transport in PR #92.

Pre-deploy facts:
- main includes PR #92 at 932c008e0701a5273d6f936baa8d9e8e5a964662.
- Admin Regression #343 passed for the final PR #92 head.
- existing production deployment still points to PR #88 / 3a2cf65e943270e11f6c09cdacbf232fa67ef397.
- Make scenario 6336390 exists with the owner Google connection and guarded authorize -> precondition -> Google operation -> readback chain.
- no Admin business write is routed to the bridge at this checkpoint.

Production acceptance gates after deployment:
1. production deployment READY and source SHA matches this main lineage;
2. /admin/, /api/kk-admin-auth and public feed smoke remain healthy;
3. /api/kk-admin-make-health performs a read-only Google OAuth round trip;
4. no 5xx regression is observed;
5. only after bridge health succeeds may an idempotent/no-op write acceptance be attempted;
6. no synthetic booking/customer/event/pricing record may be created;
7. business-write routing remains fail-closed unless write+readback acceptance passes.

Rollback target before this checkpoint:
- dpl_93HzugSZ8QTeNQmY4oFd5x1UKzG4 / commit 3a2cf65e943270e11f6c09cdacbf232fa67ef397.
