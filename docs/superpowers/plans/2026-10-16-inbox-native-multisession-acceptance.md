# Inbox Native Multi-session Acceptance Plan

**Goal:** Close the isolated independent-session lock/race/crash evidence gap with unmodified PostgreSQL17, without hosted resources or Production actions.

**Design:** Use QEMU TCG direct Linux boot with an Alpine Linux guest, private initramfs and PostgreSQL17 running as UID70 inside the guest. Guest networking, host shares and credential forwarding are absent. Only the exact four Inbox SQL files and synthetic acceptance scripts enter the guest. This avoids modifying the PostgreSQL root guard or pretending multiplexed PGlite connections are distinct database backends.

**Authority:** User explicitly requests continued thorough implementation, alternative routes after failures, GitHub continuity and no repeated confirmation. Existing no-spend/no-Production/Booking/customer/ACL/automation constraints remain binding. Existing isolated Inbox worktree is reused. No product feature, API or UI change is intended.

**Source:** #70027aa4ec232760fa70f505e4b51373188457cfb8d, tree68ef9d12c7b49c5838a6b511fc135a3033841c6d; canonical #744ad64cf9413d9d664bc17fcf2e5737f6121dc6b5c. Maina54a348d. Refresh before publishing.

- [x] Bootstrap pinned QA-only QEMU/Linux/PostgreSQL assets outside app dependencies; prove guest UID70 and distinct PostgreSQL backend PIDs.
- [x] Add bounded acceptance for concurrent same-body/new-ID and same-ID reservations; observe actual advisory-lock wait and release on commit/rollback/backend loss; prove independent bodies/rooms do not share the reservation lock.
- [x] Simulate process loss before and after durable reservation and provider/persistence boundaries; never replay an unresolved send; synthetic provider only.
- [x] Independently review exact SQL/assertions and failure evidence; run routed/full/postinstall checks if runtime changes are needed; otherwise verify app/SQL byte parity and run appropriate QA checks.
- [ ] Publish exact tested QA source/evidence to existing #700 and docs-only #744; refresh Issue49; leave hosted provider/media/visual/release gates explicit.

**Fallback evidence:** Host sole UID0 mapping prevents normal PostgreSQL privilege drop. A new user namespace mapping also fails EPERM. PGlite Socket multiplexes one backend and is unsuitable for this gate. QEMU guest is a separate Linux kernel with ordinary real UID separation. If the VM route is unsupported, retain FAIL/BLOCKED evidence and deliver reproducible local acceptance without falsely claiming the gate passed.

Execution evidence: exact source SQL unchanged. Native PostgreSQL17.11 parent and independent runs15/15,8distinct burst backends,5exact advisory waits,6immediate unclean process/WAL recoveries. No-lock ephemeral-copy negative control2PASS1FAIL as expected. Native app1802/1802, routed96/96, postinstall/ship185PASS. Existing combined runtime1934+26 evidence remains valid by exact application/SQL parity; no new combined runtime claim is manufactured. Final publication SHA/readback will be pinned in canonical #744 and Issue49 rather than self-referenced inside this source snapshot.
