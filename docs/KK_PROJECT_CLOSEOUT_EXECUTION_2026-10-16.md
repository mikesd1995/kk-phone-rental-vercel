# KK Phone Rental — ปิดงานค้างและความพร้อมปิดโปรเจ็ค (16 ต.ค. 2026)

**ผลรอบนี้: แก้ตัวบล็อกด้านโค้ดและบันทึกผลแล้ว แต่ยังไม่ผ่านการตรวจรับ Production เพื่อปิดทั้งโปรเจ็ค**
อ่านสถานะ CODE WRITTEN / LOCAL TEST PASS / CI PASS / PRODUCTION VERIFIED แยกกัน ห้ามนำผล local ไปแทนการเปิดใช้งานจริง


## ล่าสุด 16 ต.ค. 2026 — ผ่านฐานข้อมูลหลาย session จริงและ process-crash recovery แล้ว

**จุดค้างที่ปิดเพิ่มได้:** isolated PostgreSQL multi-session/lock/recovery ผ่านแล้วใน PR #700 source `ed7e89b8c8eac1745111bb9873d8a2b3a14bfbc2`, tested tree `f2a61c47a0a77d372a657490921ce22775ee8f16`. รอบนี้เพิ่มเฉพาะเครื่องมือ QA/หลักฐาน/วิธีทำซ้ำ ไม่มีการเปลี่ยนโค้ดแอป, SQL, API, Admin, middleware, package หรือ lockfile

| ก่อนรอบนี้ | หลังดำเนินการ |
| --- | --- |
| PGlite มีbackendเดียว จึงยังไม่ผ่านเกตทดสอบหลายsession | ใช้ PostgreSQL17.11 แบบnative/ไม่แก้binary ใน Linux VMชั่วคราว ผ่าน15/15ทั้งรอบหลักและผู้รีวิวอิสระ |
| ไม่เคยพิสูจน์การแย่งlockข้ามbackend | คำขอพร้อมกัน8backend PIDต่างกัน มีสิทธิ์reserveผู้ชนะเดียว; สังเกตผู้รอadvisorylockจริง5ครั้ง ตรงexact64-bit keyและpg_blocking_pids |
| ยังไม่พิสูจน์ว่าprocessล้มแล้วกันส่งซ้ำได้ | หยุดPostgreSQLแบบimmediateแล้วเริ่มใหม่6ครั้ง ทุกครั้งcontrolfileยังเป็นunclean/in production; reservation, receipt, ownerreviewและrepeat-holdยังคงอยู่ |
| ยังไม่มีชุดทดสอบจับการถอดlock | ถอดlock2จุดเฉพาะสำเนาguest ทำให้ตกตามคาด2PASS/1FAILที่advisory-wait; sourceจริงผ่านครบและไม่ถูกแก้ |

**ผลตรวจรอบนี้:** fullแอป1802/1802, routed96/96, postinstall/ship185/185 ผ่าน. รีวิวอิสระ0BLOCKER/0MATERIAL และรันnative15/15เอง. Python/shellsyntax, CLIปฏิเสธpathผิด/assetไม่สมบูรณ์, hashparityผ่าน. ชุดรวมCore1934/1934+26/26ACLเป็นผลรอบก่อนที่ยังใช้กับruntimeเดิมได้ เพราะพิสูจน์ทุกแอป/test/SQLbyteไม่เปลี่ยน; ไม่อ้างว่ารันหรือdeploycombinedcandidateใหม่

**ทางเลือกที่ทำให้สำเร็จ:** hostmapได้เฉพาะUID0 และunshareเพิ่มผู้ใช้ถูกEPERM จึงbootLinuxkernelแยกด้วยQEMU TCG ให้postgresทำงานด้วยUID70จริง. แก้ปัญหาrelocatedmodule/ROM, configquoting, assertionexitcodeของpsql และhardlinkในชุดติดตั้งจนpreparationจากcacheใหม่และผลทดสอบผ่านครบ. เก็บสาเหตุ/ทางแก้ไว้ในmanifest ไม่ใช้การแก้rootguard ไม่ใช้PGlite multiplexerแทนbackendจริง ไม่สร้างฐานข้อมูลSaaSหรือเพิ่มค่าใช้จ่าย

**ขอบเขตที่พิสูจน์ได้:** VMไม่มีNIC/hostshare/hostdisk และไม่รับcredential; PostgreSQLฟังUnixsocketภายในเท่านั้น, fsync/synchronous_commitเปิด. ฐานข้อมูลอยู่RAMของVM จึงพิสูจน์process/WALrecoveryขณะRAMยังอยู่ ไม่ใช่VMดับ/ไฟดับหรือdiskdurability. NativePG17.11ไม่ใช่hostedSupabase17.6แบบเดียวกันทุกส่วน

**ยังเหลือก่อนปิดทั้งโปรเจ็ค:** exacthostedCI, hostedPostgREST/privateStorage, LINEproviderreceipt/รูปใหม่และwrong-roomจริง, authenticatedAdmin/LINEvisual, bookinglinkage, PrivateCore/ACLcutover, naturalgovernedruntime/ข้อเท็จจริงรับคืน และowner-governedrelease/rollback. Engineeringgateเรียกจริงแล้วยังBLOCKEDเฉพาะRELEASE_READBACK. รายการเก่าที่บอกว่ายังไม่ผ่านisolatedmulti-session/processrecoveryถูกแทนที่ด้วยผลล่าสุดนี้; เกตระบบจริงอื่นยังไม่ผ่าน

**หลักฐานข้ามแชท:** [checkpointรอบnativeDB](KK_INBOX_NATIVE_DB_CLOSEOUT_CHECKPOINT_20261016.json), [รายละเอียด/ข้อจำกัด/ขั้นตอนทำซ้ำ](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/ed7e89b8c8eac1745111bb9873d8a2b3a14bfbc2/docs/KK_INBOX_NATIVE_POSTGRES_ACCEPTANCE_20261016.md), [rawผลหลัก](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/ed7e89b8c8eac1745111bb9873d8a2b3a14bfbc2/docs/KK_INBOX_NATIVE_PG17_ACCEPTED_20261016.json), [rawรีวิวอิสระ](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/ed7e89b8c8eac1745111bb9873d8a2b3a14bfbc2/docs/KK_INBOX_NATIVE_PG17_INDEPENDENT_REVIEW_20261016.json). มีseriallogs, negativecontrol, pinnedassets และprepare/runCLIครบใน#700

**เริ่มแชทถัดไป:** refreshPRheadsก่อน ใช้nativeDBmanifestข้างต้น ไม่วนติดปัญหาUID0/PGliteconnectionเดียวอีก. ห้ามนำnegativecontrolมาใช้เป็นชุดผ่าน; หากSQL/harnessไม่เปลี่ยนให้ทำต่อเฉพาะเกตระบบจริงที่ยังขาด. ไม่มีmainmerge/deploy/ProductionSQL/Booking/ลูกค้า/ACL/automationเปลี่ยน และไม่ส่งข้อความจริง งานหน้าตาเว็บของอีกแชทคงเดิม


## ล่าสุด 16 ต.ค. 2026 — แก้ความถูกต้องของหลักฐานส่งข้อความด้วย PostgreSQL จริงแบบแยกทดสอบ

**ทำเพิ่มสำเร็จ:** PR #700 source `27aa4ec232760fa70f505e4b51373188457cfb8d`, tree `68ef9d12c7b49c5838a6b511fc135a3033841c6d`. พบและแก้ข้อบกพร่องระดับ MATERIAL สองจุดใน migration ที่ยังไม่เคยใช้บน Primary:

| ก่อนแก้ | หลังแก้และหลักฐาน |
| --- | --- |
| service_role บันทึก SENT ได้ทั้งที่ไม่มีข้อความ outbound ตรงคำขอ แล้ว owner review อาจอนุญาตส่งซ้ำ | SENT ต้องมีข้อความที่บันทึกจริง ตรงห้อง LINE/ทิศทาง outbound/provider ID/request UUID/retry UUID; baseline24/32ผ่าน8ตก → หลังแก้34/34ทั้งสอง engine |
| หลัง owner ยืนยันแล้ว การ finish ครั้งหลังเขียนทับ provider IDs ได้โดยคง SENT/VERIFIED_SENT | ล็อกแถวก่อนตรวจ ตัด ID ที่ขัดกัน และคำขอซ้ำเดิมไม่เปลี่ยนแถว; หลักฐานที่ยืนยันแล้วคงเดิม |

ขอบเขตช่องโหว่คือ privileged service-role RPC ไม่ใช่สิทธิ์ anonymous. การส่งตาม server flow เดิมบันทึกข้อความก่อน finish อยู่แล้ว; ซ่อม enforcement ของ SQL เพื่อรับมือการเรียกผิด/เรียกซ้ำ โดยไม่เปลี่ยน API signature, schema, RLS หรือ grants

**ผลตรวจ:** actual embedded PostgreSQL17.5/PGlite0.3.14 และ PostgreSQL18.6/PGlite0.5.10 ผ่าน34/34ต่อ engine, network0/provider0; แอป #700เต็ม1802/1802, routed89/89, ship185/185, postinstall/syntaxผ่าน. รีวิวอิสระยอมรับ final diff ไม่พบ BLOCKER/MATERIALใหม่ และรัน PG17อิสระ34/34. ตัวทดสอบ wrong-request แยก UUID predicateจาก retry keyแล้วและรันสอง engineซ้ำผ่านครบ

**รวมกับ Core ใหม่แล้ว:** canonical `b2d42bbe2086ad12bcc0868c508a30de5367f386` + #700ข้างต้น ใน worktreeแยก ผ่าน **1934/1934 +26/26 ACL**, full postinstall/ship185, syntax149คำสั่ง. Combined tree `27eff1290647a21cfa46485e80632defa298c7c6`. คง canonical-only91และInbox-only40 pathsตรง parentทุก byte; conflictยังมีเพียง package/test2ไฟล์ ไม่มี runtime conflictแก้ด้วยมือ; patch replay2/2เท่ากัน. การเพิ่มจำนวน pathsรอบนี้รวมเอกสารหลักฐานด้วย ไม่ใช่จำนวน runtime fixes

**ลองทางแรกไม่สำเร็จแล้วเปลี่ยนวิธี:** native PostgreSQL ใช้ไม่ได้เพราะสภาพแวดล้อม mapเฉพาะUID0และลดสิทธิ์ไม่ได้ จึงใช้ actual PostgreSQL WASMที่ติดตั้งเฉพาะเครื่องมือ QAนอก repo แทน ไม่เพิ่ม app dependency/lockfile/ค่าSaaS. PG17รอบแรก33/34เพราะทดสอบกรอง PIDไม่ตรงกับ embedded metadata; ตรวจพบ advisory lockจริง แล้วแก้ให้ตรวจ exact64-bit keyและ0→1→0 ไม่ลบ assertion. สอง engineนี้มี backendเดียว จึง **ไม่ใช่หลักฐาน concurrencyข้ามsession** และไม่ใช่ Production17.6แบบเดียวกันทุกส่วน

**ตรวจสดแบบอ่านอย่างเดียว:** Primary `mxjnjujqjybqughsnqbz` เป็นPG17.6 และยังไม่มี outbound table/reserve RPC/finish RPCของ migrationนี้. ไม่มี migration/ข้อมูลลูกค้า/Booking/ACL/automation/deployถูกเปลี่ยน และไม่ส่ง LINEจริง. รายงาน Productionใน checkpointเก่าคือสถานะ ณ เวลานั้น ไม่ได้อ้างเป็น readbackสดของรอบนี้

**สถานะปิดโปรเจ็คยัง HOLD ตามหลักฐาน:** actual engineering gateเรียก evaluateแล้วได้ BLOCKED เฉพาะ RELEASE_READBACK. ยังต้องมี independent-session DB contention/crash, hosted API/private Storage/รูปใหม่และwrong-roomจริง, authenticated visual, provider receipt/booking linkage, Private Core/ACL cutover, natural governed runtime/รับคืนจริง และ release/rollbackที่อนุมัติ. ไม่ใช้ผล localแทนสิ่งเหล่านี้

**บันทึกข้ามแชท:** [manifestรวมรอบฐานข้อมูล](KK_INBOX_DB_CORE_REHEARSAL_20261016.json), [patchแก้conflictรอบนี้](KK_INBOX_DB_CORE_MERGE_RESOLUTION_20261016.patch), [รายละเอียด SQL/RED→GREEN และวิธีทำซ้ำ](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/27aa4ec232760fa70f505e4b51373188457cfb8d/docs/KK_INBOX_POSTGRES_RECEIPT_ACCEPTANCE_20261016.md). Artifactรอบก่อนเก็บไว้ตามเดิม ห้ามนำ patchเก่าที่ผูกกับ73adไปใช้แทนรอบนี้

**จุดเริ่มแชทถัดไป:** อ่าน PR headsสดก่อน; ใช้ #700 `27aa4ec2` และ canonical source `b2d42bbe` สำหรับ rehearsalนี้; sourceไฟล์แอปใน #744อัปเดตเอกสารรอบนี้ยังตรงb2. ทดสอบครบแล้ว ไม่ต้องวนแก้ปัญหา receiptสองจุดเดิมหรือรันชุดเต็มซ้ำโดยไม่มี sourceเปลี่ยน. เดินต่อเฉพาะ acceptanceที่ขาดด้วยบัญชี/ข้อมูลทดสอบที่ได้รับอนุญาต และคงงาน UIของอีกแชทไว้


## ล่าสุด 16 ต.ค. 2026 เวลา 09:36 ไทย — รวมกติกา Inbox/LINE และพิสูจน์การทำงานร่วมกับ Core

งานรอบต่อเนื่องนี้แก้เพิ่มใน **PR #700 เดิม** แล้วบันทึกแบบป้องกันเขียนทับงานอื่น: source **`73adf54d131b4880458ae7917191e4a646d87d62`**, tested tree **`25fe9512535153e3c5f6e5a7bb61e2007f20d4aa`**. เริ่มจาก `e6e21f9b` ผ่าน `6114967a` ก่อนแก้กฎปิด URL source เพิ่ม ไม่มี main merge/deploy/การส่ง LINE หรือแก้ข้อมูลจริง

| สิ่งที่ดีขึ้น | ก่อน → หลัง / หลักฐาน |
| --- | --- |
| Inbox ใช้กติกา LINE ล่าสุดร่วมกับ Core | อีเวนต์ซ่อน/เต็ม/จำนวนเครื่องไม่ถูกต้องหยุดก่อนอ่านแพ็กเกจ เขียน pending หรือ push หาเจ้าของ; เก็บ TH/EN parser, private media และลูกค้าที่มี LINE แต่ไม่มีเบอร์ไว้ครบ |
| กันอนุมัติซ้ำและอ่านผลผิด Booking | ตรวจ booking/status/decision และ replay ต้องเป็น Boolean; replay ไม่ส่งข้อความซ้ำ; ส่งลูกค้าสำเร็จก่อนแจ้งเจ้าของ |
| ปิดช่องข้อมูลส่วนตัวใน error log | ตัด provider body/transport และ warning ที่มีข้อมูลลูกค้า; พบช่องเพิ่มใน media `error.code` แล้วใช้ private WeakMap รับเฉพาะรหัสเดิมที่โมดูลสร้างเอง ปลอม/เปลี่ยน code ภายหลังไม่ได้ |
| ปิด URL ไฟล์ฐานข้อมูลโดยไม่ทำ build เสีย | รีวิวรวมพบ `supabase/` ต้องอยู่ใน build แต่ matcher ยังไม่ปิด URL; เพิ่ม middleware 2 จุดและทดสอบการทำงานจริงของ body ผ่าน matcher จำลอง จาก static200 เป็น404/no-store/nosniff โดย Admin/public assets ยังเหมือนเดิม |
| พิสูจน์การรวมสอง PR | รวมเฉพาะใน worktree แยก มี conflict2ไฟล์เฉพาะ package/tests, ไม่แก้ runtime conflictด้วยมือ; เก็บ canonical-only89 และ Inbox-only33 paths เท่ากับ parent ทุก byte |

**ผลล่าสุด:** #700 full **1,802/1,802 PASS**, Inbox ship **185/185**, LINE/media boundary73/73, routing+packaging10/10, selected routing regression63/63, postinstall/syntax/diff PASS. ชุดรวม #744`e6597b7d` + #700ล่าสุด **1,934/1,934 +26/26 ACL PASS** และ postinstallครบ. รีวิวอิสระรัน60/60และ119/119; พบ MATERIAL1เรื่อง SQL route แล้วแก้ด้วย RED4/6→GREEN6/6และทดสอบเต็มซ้ำ ไม่ใช้ผลเขียวก่อนหน้าเพื่อกลบจุดนี้

หลักฐานก่อนแก้ที่ทำซ้ำได้: canonical LINE guards9/31ผ่าน22ตก; signed webhook1/3ผ่าน2ตก (hidden eventยังทำ3downstream requests และ media codeส่วนตัวหลุดเข้าlog). หลังแก้ทุกกรณีผ่าน หลักฐานเป็น synthetic/local และไม่แทน provider/Production acceptance

หลักฐานข้ามแชท: [manifest ชุดรวม](KK_INBOX_CORE_INTEGRATION_REHEARSAL_20261016.json), [patch แก้ conflict2ไฟล์](KK_INBOX_CORE_MERGE_RESOLUTION_20261016.patch), [รายละเอียด #700](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/fix/unified-inbox-private-media-current-main-20261012/docs/KK_INBOX_PRIVATE_MEDIA_FRESH_PORT_20261012.md). ไม่สร้าง broad release branchเพิ่ม และไม่ปิด PRเก่าเพื่อทำให้คิวดูว่าง

**ยังปิดทั้งโปรเจ็คไม่ได้:** เกตที่เหลือคือ authenticated Admin/LINE visualและรูปใหม่จริง, isolated DB concurrency/provider receipts/booking linkage, Private Core/ACL cutover, natural governed runtime, ข้อมูลรับ–คืนจริง และ exact release/rollback. Gatewayก่อน–หลังรอบนี้บันทึก BLOCKED visualตามหลักฐานที่ขาดไว้แล้ว ไม่กรอกข้อมูลหรือส่งข้อความเพื่อทำให้เกตผ่าน

การตรวจ Productionสดช่วงปิดรอบยังเป็น READY`dpl_4TFT2iMxHer24wtV8LvMGnpKvc3Z` / source`3d8b58af20550ef9fb093d74747548aedb106dfe`; งานแก้ข้างต้นยังอยู่ source candidate. เก็บงานหน้าตาเว็บของอีกแชทไว้ตามเดิม การทดสอบรวมนี้ไม่มี marketing/heroเพิ่มเข้ามา

### ทำต่อจาก checkpoint นี้โดยไม่วนตรวจซ้ำ

1. อ่าน PR headsสด และ manifestนี้ก่อน หาก sourceถูกเปลี่ยนให้ประเมิน diffก่อนใช้หลักฐานเก่า
2. หากต้องสร้าง rehearsalเดิม ใช้ canonical`e6597b7d82179646932a7c1520bf46a32bd7e1f8` กับ Inbox`73adf54d131b4880458ae7917191e4a646d87d62`, commonmain`a54a348d`; ทำใน worktreeใหม่เท่านั้น
3. หลัง mergeแบบไม่commit หาก conflictตรง2ไฟล์เดิม ให้ restoreฝั่ง canonicalเฉพาะ`package.json`และ`tests/line-webhook.test.js`, apply patchที่บันทึกนี้ แล้ว stage2ไฟล์ เป้าหมาย tree **`eb910ac54d4c0364a8efbb14303cb8f8d72ea136`** ต้องตรงก่อนใช้ผล1934+26
4. ห้ามนำแพตช์ไปapplyทับmainหรือไฟล์อื่นโดยไม่ดูdiff; ไม่มีคำสั่งเปิดAutomation/ส่งลูกค้า/แก้ACLอยู่ในการรับรองนี้ เกตระบบจริงต้องใช้หลักฐานจริง ไม่ใช้localtestแทน


## เป้าหมายและขอบเขต
คำสั่งเจ้าของ: แก้งานที่ติดทั้งหมดและเตรียมปิด KK Phone Rental ตามเงื่อนไขเดิม ไม่เพิ่มค่าใช้จ่าย ไม่เดาข้อมูลลูกค้า/การจอง ไม่เปลี่ยน Production, สิทธิ์, Automation หรือส่งข้อความก่อนเกตที่เกี่ยวข้องผ่าน
ทำงานบน PR เดิม ตรวจ current main และส่วนที่ซ้ำก่อนแก้ ไม่สร้าง broad PR ใหม่ ไม่ปิด PR เดิมแบบเหมารวม

## ระบบจริงที่ตรวจ
- Production alias: https://kk-phone-rental.vercel.app/ — HTTP 200; Vercel READY **`dpl_4TFT2iMxHer24wtV8LvMGnpKvc3Z`**, source **`3d8b58af20550ef9fb093d74747548aedb106dfe`** (fresh16Oct continuation; older01:00 checkpoint was `dpl_6BpGt...` / main`a54a348d`)
- main native full test: **1,717/1,717 PASS**; Issue #749 เรื่อง 21 inherited failures เป็น baseline เก่า ไม่ใช่ผลปัจจุบัน
- Public Web Ready / Packages: HTTP 200, 223/669 data rows, 11/14 columns; ไม่พบ customer/booking columns ใน header ที่ตรวจ
- Public Master Booking request ถูกปฏิเสธ HTTP 400; anonymous Admin snapshot และ Rental Dashboard ถูกปฏิเสธ HTTP 401
- Public feeds ยังมี `X-KK-Private-Reader-Strict: 0` และ `public-gviz-fallback` จึงยังไม่ถือว่าปิด Private Core migration
- Historical Vercel inventory ก่อน hero deployment รอบล่าสุด: 82 objects = 73 Preview + 9 Production (ไม่ใช่ยอดปัจจุบัน); จำนวน deployment ไม่ใช่หลักฐานว่า Storage GB เหลือพอ ไม่ลบ Production/rollback
- Snapshot เริ่มต้น: 35 open PRs / 69 open issues; ตรวจความต่าง 262 runtime paths พร้อม inventory ของทุก PR/Issue ใน [JSON inventory](KK_PROJECT_CLOSEOUT_INVENTORY_2026-10-16.json) ตัวเลขนี้มี timestamp และไม่ใช่สถานะถาวร

## สิ่งที่แก้สำเร็จจริงใน source

| งาน | ต้นเหตุ / สิ่งที่ดีขึ้น | หลักฐาน |
| --- | --- | --- |
| Revenue ใน #744 | Helper ซ้ำสามารถใช้ Master X ก้อนเดิมสองครั้ง ทำให้ synthetic 890 กลายเป็น 1,780; บล็อก duplicate active booking+event ก่อน aggregate ทั้ง Core/CRM ไม่เลือกแถวมั่ว | RED→GREEN, CSV/Map และ cross-event/inactive regressions; [รายละเอียด](KK_REVENUE_HELPER_DUPLICATE_GUARD_20261015.md) |
| LINE ใน #744 | แพ็กเกจที่ยังบอกว่าว่างอาจผ่านได้ทั้งที่ WebReady ซ่อน/เต็ม; รับ canonical เฉพาะ show + เปิดจอง + positive integer phone availability ก่อนอ่านแพ็กเกจ/โปสเตอร์ | Negative end-to-end case ยืนยันไม่มี Apps Script writer/push; privacy/replay เดิมอยู่ครบ; [รายละเอียด](KK_LINE_OWNER_REPLAY_PRIVACY_SOURCE_ONLY_20261015.md) |
| Inbox #700 | Test ตัด function ผิดขอบเขต แล้ว branch ค้างก่อน main ล่าสุด; แก้ตัวดึง test และ two-parent main reconciliation โดยเก็บ private-media/outbound code เดิม | 19 inherited failures หายโดยเก็บ current-main fixes ไม่ลด assertion; **1,771/1,771 PASS**, media ship gate **150/150**, routed **50/50** |
| Scanner/Verifier auditor ใน #744 | ตัวตรวจสร้าง 6 hourly slots ทั้งที่ Machine SOT ใช้ sparse daily times; เปลี่ยนเป็นอ่าน canonical cadence แบบจำกัดรูปแบบและ fail-closed | รวม Bangkok midnight, missing/off-cadence, finite DTSTART/UNTIL, malformed และ inherited seconds RED→GREEN; **58/58 targeted**; [runtime/readiness evidence](KK_RUNTIME_READINESS_AND_CADENCE_AUDIT_2026-10-16.md) |
| X copy #751 | กฎเก่ายังสวนกับ owner copy ล่าสุด; เพิ่ม V5 บล็อกวันที่ใน Hook/CTA และคำขายที่สั่งเลิก แสดง full label สำหรับวัน shop-closed ที่ยืนยันแล้วเฉพาะ copy โดยไม่แก้ backend | แก้ structural/date bypass ที่ independent review พบและปรับ active memory/skill ให้ตรงกัน; **1,767/1,767 PASS**; [รายละเอียด](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/chore/x-marketing-integrated-release-candidate-20261015/docs/KK_X_COPY_CLOSURE_RECONCILIATION_2026-10-16.md) |
| Storefront #752 | เกต modal ยอมรับ anchor ที่ไม่มี alignment และ test cache ไม่รู้จัก version token ใหม่ | แก้เฉพาะ acceptance guard/tests; owner R4 จากงานขนานแก้ first-fold 320px; ทดสอบ actual Thai-font/browser และ 8 viewport แยก owner acceptance |

## ผลทดสอบที่ห้ามรวมยอดข้าม branch
- #744 รวม revenue + LINE + cadence: **1,873/1,873 PASS** และ poster ACL **26/26 PASS** แยก report; ไม่มี failed/skipped
- #700: **1,771/1,771 PASS**; #751: **1,767/1,767 PASS**
- #752: native **1,728/1,728 PASS**, browser geometry/interaction/registered QA **8/8 widths PASS** with official pinned local Thai fonts; **0P0/0P1**, external-poster fallback observations remainP2. Owner/external-delivery acceptance is separate. PR remains Draft even though owner hero3d8 is live.
- บันทึกที่ source tree เหมือนกันสามารถยืนยัน local test ได้ แต่ไม่ได้แปลว่า hosted checks ของ commit ใหม่ผ่านแล้ว
- Syntax check และ static invariant audit **10/10 PASS** (เป็น source checks ไม่ใช่ live data audit)
- Independent Reviewer ตรวจ material changes; engineering execution gate ยัง **BLOCKED: RELEASE_READBACK**
- ไม่ import #739/#737 ทั้ง branch ทับ #744 เพราะจะถอย strict transport/schema/cache protections ที่ใหม่กว่า
- #744 ใช้ centered-only modal architecture ต่างจาก #752; ยกเลิก port anchor patch เมื่อ context ไม่ตรง ไม่มี source ถูกเปลี่ยนจาก patch ที่ไม่ตรง

## ตัวบล็อกการปิด Production ที่ยังต้องมีหลักฐานจริง

| Gate | สิ่งที่ยังขาด / งานถัดไปที่แน่นอน |
| --- | --- |
| Private Core / #738 | independent owner read key + bound Apps Script identity/revision; 13/13 protected real dataset reads, reader-vs-admin negative checks, no-GViz/PII checks, rollback ก่อนค่อยจำกัด ACL |
| Poster ACL / #718 / #743 | #744 repins active allowlist 35/44 แล้ว แต่ยังไม่มี ACL repair/readback; fresh public snapshot ยืนยัน 76 cards/44 references/35 IDs ตรง pinned set ทุกตัว (เป็น membership ไม่ใช่ ACL-role readback); ต้อง dry-run owner-role แล้ว batch approval ตามสคริปต์; historical 209 เป็น audit ก่อนหน้า ต้องแยกตรวจ ไม่เหมารวมว่าแก้แล้ว |
| Booking / #714 | 17–18 ต.ค. เวลา handover ที่แท้จริงยังไม่ครบ และ contact/reference/ราคาที่ต้องยืนยัน ห้ามเดาเวลา ใส่เบอร์ หรือเปลี่ยนยอดโดยไม่มีหลักฐาน |
| LINE/Inbox / #9 / #715 | exact approved Apps Script binding, canonical #744/#700 integration, signed idempotent decision E2E, recipient/provider receipt และ private-image wrong-room/DB-concurrency acceptance; รูปเก่าที่ไม่มี provider ID สร้างกลับไม่ได้ |
| Runtime / #47 / #50 / #368 | canonical same-ID Scanner/Verifier ยัง OFF; ต้องตาม current policy ไม่ clone/วน re-enable, มี genuine scheduled occurrences/Manifest/Planner/coverage และ FULL/OIDC acceptance; source cadence fix ไม่ใช่ natural run |
| Make / #696 / #740 | free operations เหลือ 999 ต่อบัญชี แต่ recurring delivery ยังไม่ accepted; มี queue held 4 และ legacy writers ถูก quarantine ต้องพิสูจน์ approved outbox/project/receipt/ACK ก่อนเปิด |
| Final release / #49 / #713 / #692 | source-specific hosted CI, owner screenshot acceptance, authenticated Admin parity, Storage GB จริง, source/rollback และอนุมัติ release ที่ตรง scope |

รายละเอียด task IDs, cadences, queue counts, current policy v4.9.44, leases/transactions, schema bindings และข้อจำกัดการตรวจมีใน runtime report ไม่มี customer PII หรือ secret ในรายงานนี้

## บันทึก GitHub และการไปต่อ
ใช้ #744 เป็น canonical source checkpoint ของ cleanup/security/revenue/booking/runtime guards, #700 เป็น Inbox candidate, #751 เป็น marketing/ledger candidate และ #752 เป็น owner hero candidate
PR #705/#700/#706/#721/#742 และ Issue #49 ยังคง OPEN/HOLD ตาม gate ของแต่ละงาน Older discovery/governance/shadow PRs อยู่ใน inventory; ไม่เรียกว่าบั๊กที่ยังพังทุกตัว และไม่ปิดทิ้งเพื่อทำให้ตัวเลขดูน้อย
การ push ปกติใน scratch ไม่มี Git credential จึงใช้ connected GitHub Git-data API: ตรวจ blob/tree SHA เท่ากับ local tested tree, update branch แบบ fast-forward พร้อม expected head, แล้วอ่านกลับ ไม่มี force push
Commit ใหม่ใช้ `[skip ci]` เพื่อลดการ trigger hosted งานอัตโนมัติ ไม่เรียก skipped ว่า PASS ไม่ส่ง owner-command release comment
Rollback: revert source commit เฉพาะงาน; #700 เก็บ parent เดิมและ main สอง parent ไว้ ไม่มี runtime cutover ให้ย้อนกลับจากรอบนี้
Next chat: อ่านรายงานนี้ + PR head/readback ล่าสุดก่อนลงมือ ไม่ทำ audit ซ้ำจาก memory เก่า และทำ acceptance ตาม gate ที่ยังขาด


## Concurrent-head and browser boundary correction
- GitHub ref update returned a transient GraphQL error. Fresh readback proved #744 had concurrently advanced to `2969bee28ccd13c6b36b1953c22e33834f41dcb9` with a bounded private Admin snapshot cache guard. No stale ref was overwritten. Reconciled that exact newer parent locally, preserving all three new paths, and reran combined native regression before a guarded ref update. The first unreferenced Git object was never activated.
- Latest #752 eight-width continuation was automatically rejected when it could request unverified event-image/font hosts. Those destinations were not retried. A materially safer run blocks every external browser request and uses already captured public CSV plus local first-party fallback artwork. Exact new-head poster/font delivery therefore remains UNVERIFIED; do not call offline fixture rendering Production acceptance. Earlier font-correct #744 eight-width technical PASS and #752 live320 regression are separate evidence.

Final concurrent-head combined source validation: native `npm test` **1,865/1,865 PASS + 26/26 poster ACL PASS**, zero failures/skips. Prior 1,864 result preceded the separately reviewed concurrent bounded-cache guard and remains historical. Final source/branch SHA must be read from the linked PR checkpoint after push.

A second concurrent privacy repair at `570efaecaead3a421d1a4a41c2c5c83254f0f46d` sanitizes forged provider error codes using locally owned errors. Preserved all three added paths, reviewed the bounded WeakSet classification, and reran combined native regression: **1,873/1,873 PASS + 26/26 ACL PASS**, zero skips/failures. No newer safety fix was overwritten. Issue #749 is now CLOSED after current-main 1,717/1,717 verification; other project release gates remain open.

## 16Oct morning continuation — resolved remaining safe preparation
- Read fresh GitHub and Vercel state after owner requested continuation. The separate hero work has published3d8 to Production; verified HTML/activeCSS/JS/baseCSS **4/4 byte-identical** to that exact source. Main staysa54. #744/#700/#751 source changes are not implied deployed.
- Completed the previously blocked font-dependent layout test safely: binary-safe GitHub file reads of official `google/fonts`, Gitblob-verified TTFs/OFLlicenses, loopback font delivery, all external browser requests blocked. Both Thai font families loaded in all8 contexts. **All8 widths and64states/interactions technicalPASS** with actual registered local QA/council receipts, no P0/P1. External poster delivery remains unverified; no owner acceptance invented.
- Saved source-only modal/cache-test repairs + complete evidence to existing#752; no applicationUI change or new deploy from this continuation. [Hero evidence](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/feat/hero-blue-reference-responsive-20261015/docs/KK_HERO_BLUE_REFERENCE_RESPONSIVE_2026-10-15.md).
- Finished additional required local gates on#744: CodeIntelligence benchmark **8/8**, required-file/route recall1.0, and complete `npm run postinstall` PASS. [Machine-readable latest acceptance](KK_CLOSEOUT_RUNTIME_ACCEPTANCE_2026-10-16.json).
- Release state remains HOLD for real private13-source cutover, booking handover facts, privacy/ACL, natural scheduled runtime and signed delivery/provider/owner evidence. These were not fabricated or bypassed to close the project.
