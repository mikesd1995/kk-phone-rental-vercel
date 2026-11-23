# KK Phone Rental — LINE Card แบบ LINE OA-native: คู่มือ Cutover และตรวจรับจริง

**สถานะ ณ 23 พ.ย. 2026: SOURCE READY / RELEASE HOLD — ยังไม่ใช่ Production DONE**  
**Owner request:** เว็บไซต์เปิด LINE OA พร้อมข้อความจอง → ลูกค้ากด Send → API สร้าง `00_Master_Booking` = `pending` → ส่งการ์ดลูกค้า/ร้าน → ร้านกด Confirm/Reject → แจ้งผลกลับลูกค้า  
**Canonical code:** PR #875 `feat/line-booking-release-candidate-20261112`; ตรวจ SHA และ exact-HEAD CI ใหม่ทุกครั้งก่อน release

> **เอกสารนี้แทนที่ขั้นตอน LINE Login + Supabase customer-auth ของ `PR875_OWNER_RELEASE_GATES_TH_20261113.md` สำหรับเส้นทาง `KK_LINE_NATIVE_CONSENT_V1_ENABLED=true` เท่านั้น** ห้ามเปิดสองเส้นทางพร้อมกัน กฎ Source Owner Locks, Booking, ราคา, consent, outbox, ป้องกันส่งซ้ำ และ independent review ยังคงบังคับทุกข้อ

## 1. วิธีทำงานที่ยืนยันใน Source (ไม่ใช่การตรวจรับ Live)

1. ลูกค้าเลือกงาน/แพ็กเกจบนหน้าเว็บ → `script.js` สร้าง **LINE OA draft** โดยไม่ต่อท้ายข้อความ Terms/Privacy; ลูกค้า **ต้องกด Send ใน LINE เอง**
2. `api/line-webhook.js` / `server/line-booking-webhook.js` ตรวจ `x-line-signature`, เฉพาะ private user chat, ตัวตน, เวลา, event/package ปัจจุบัน, ความพร้อม GAS/outbox/owner จริง *ก่อน* สร้าง Pending
3. `createLineBookingPending` ใน **bound GAS ของ Workbook ที่ถูกต้อง** สร้าง Booking ID ภายใต้ Document Lock, ป้องกัน LINE webhook redelivery ด้วย Request ID; **ไม่กำหนดเครื่อง/เลนส์ ไม่เปลี่ยนการรับเงิน ไม่อนุมัติเอง**
4. Initial outbox บันทึก intents ของ `OWNER_APPROVAL_PUSH` และ `CUSTOMER_PENDING_REPLY`; ส่งเพียงหนึ่งครั้งหลัง claim/readback ตามสัญญาเดิม
5. Pending Flex ลูกค้าแสดงปุ่ม **ยอมรับเงื่อนไข** และลิงก์อ่านเงื่อนไข `/terms/`. Native signed postback (`kkc1`) ผูก LINE user, Booking ID, original request, เวลา/อายุโทเคน, และ version; **signed user ID อย่างเดียวไม่ใช่ consent**
6. GAS action `acceptLineBookingTerms` ต้องอ่าน Booking จริง `pending` + LINE user ID ตรง + Request ID ตรง ก่อนเขียน `TERMS_ACK_BACKEND:KK-TERMS-2026-11-06` และ `TERMS_AT:<UTC>` ใน note ของ **Booking row เดิม** ภายใต้ lock พร้อม exact readback; กดซ้ำไม่เขียนซ้ำ
7. Owner Card ใช้ signed owner postback. ถ้ากด Confirm ก่อน consent ระบบตอบ `WAITING_CUSTOMER_CONSENT` โดย **ไม่เปลี่ยน Booking ไม่ Push ลูกค้า**; เมื่อหลักฐานครบจึง `confirmed`. Reject ยังคง `cancelled` ได้. Decision outbox ทำ INTENT→READY→CLAIMED→SENT/UNCERTAIN และตรวจ receipt ก่อนข้อความผลลัพธ์

**ข้อจำกัดสำคัญ:** การป้องกันความซ้ำของ Source ไม่เท่ากับผลทดสอบ LINE provider จริง; ข้อความตอบกลับที่หมดเวลา, LINE quota, คิวที่มีอยู่, เว็บไซต์ลิงก์แชทผิด OA, Web App คนละ deployment, และ LINE webhook route ยังต้องพิสูจน์

## 2. อุปกรณ์ที่ต้องผูกกับ *Staging* ที่แยกจริงเท่านั้น

| ส่วน | ต้องยืนยันด้วยหลักฐาน | ห้ามสมมติ |
| --- | --- | --- |
| Provider | Provider KK Agent `2005383568` + ช่อง Messaging ที่เจ้าของอนุมัติ | ช่อง `2011794771` หรือ `2010860976` เป็น test carrier ได้เอง |
| Customer/Owner actor | สองบัญชี LINE ที่ควบคุมได้จริง, `userId` จาก signed webhook และ owner ID มีการยืนยันนอกช่องทางลูกค้าทั่วไป | follower/customer เป็นเจ้าของ; ห้ามบันทึก owner ID จากข้อความคำสั่งของใครก็ได้ |
| GAS | project ID, owner/executor, **bound spreadsheet ID**, immutable version/deployment, `/macros/s/.../exec`, source+manifest digest | Editor HEAD = deployed version, หรือ `getActive()` จะชี้ staging เพราะเปลี่ยน Vercel env |
| Sheets | Workbook ทดสอบที่ไม่มีข้อมูลลูกค้าจริง, baseline ACL/publish/share, ภาพรวม owner locks, audit rollback | hidden/protected tab = private จากผู้มีสิทธิ์อ่าน Workbook |
| Hosting | Preview target ที่ควบคุมได้และเข้าถึงจาก LINE provider, exact SHA, callback/webhook route | ปิด Vercel SSO ทั้งโปรเจกต์หรือเปลี่ยน webhook ของร้านจริงไปยัง Preview |
| Review | reviewer independent `APPROVED` ที่ exact HEAD, owner UAT, วัน rollback และผู้ดำเนินการ | 8/8 CI หรือ Vercel READY = Live พร้อมแล้ว |

**สิทธิ์ผู้ใช้:** ไม่จำเป็นต้องสร้าง LINE Login Channel หรือฐานข้อมูล Supabase customer-auth *สำหรับทาง Native นี้* แต่ต้องมี **one-time owner identity enrollment** ที่เจ้าของตรวจสอบเองก่อนส่ง private Owner Card; อย่าเดา LINE Owner U-ID

## 3. Outbox schema เดิม — สร้างเฉพาะเมื่อ staging target ผ่าน inventory/backup/ACL

> **SECURITY RELEASE GATE:** ก่อนเพิ่ม Outbox ที่มี LINE User ID หรือข้อมูลลูกค้า ต้องอ่านกลับ ACL ของ canonical Workbook จากบัญชีเจ้าของ และพิสูจน์ว่าไม่เปิดเผยแบบ public/anyone/domain. หาก ACL ไม่เป็น private หรืออ่านสิทธิ์ไม่ได้ให้ **HOLD**; Hide/Protect tab ไม่ใช่สิทธิ์แยก. ห้ามแก้ sharing โดยไม่ยืนยันว่า authenticated server reader และ public event/package feed ยังทำงานครบ. เก็บรายละเอียดสถานะ ACL จริงไว้ใน owner-only Engineering History & UAT Log ไม่เขียนรายละเอียดการเปิดเผยข้อมูลของระบบจริงลง Public GitHub.
>
> โค้ด GAS รุ่นใหม่มี **`kkLineNativeConsentRequirePrivateCore_`** บังคับตรวจ DriveApp sharing=`PRIVATE` ใน `lineNativeConsentReadiness`, `acceptLineBookingTerms`, การสร้าง Pending และการกด owner decision ก่อน write; ค่าที่เปิดอ่านสาธารณะ, domain-wide หรืออ่าน ACL ไม่ได้จะ **fail closed**. นี้เป็น safety guard ไม่ได้แก้การเปิดเผยข้อมูลที่มีอยู่ก่อน และไม่ใช่การรับรอง private reader.
>
> ก่อนเปิดใช้งานต้องทำ **private-reader migration** ของเว็บ/หลังบ้านแบบมี rollback: ตรวจ callback/fallback ทั้งหมดและ credential scope, ตั้ง private authenticated Server reader ที่อ่านเฉพาะ public views (`08_Web_Ready` / `09_Web_Packages`) และเช็ก parity กับ Production/Cache; ค่อยลบ `anyone:reader` ในจังหวะ controlled cutover; อ่านกลับ ACL ว่า private จริง และพิสูจน์หน้าเว็บ/ราคา/โปสเตอร์/จองยังไม่ผิด ก่อน provisioning Outbox. อีกทางเลือกคือย้าย Outbox/Consent ไป **owner-private workbook** ที่ GAS จัดการภายใต้ ScriptLock และ transaction/outbox proofs ที่รีวิวใหม่ทั้งหมด — ไม่ใช่แค่เพิ่มแท็บข้ามไฟล์แบบไร้ Lock.


สคริปต์ **ไม่มี auto installer**, อย่ารัน generic sheet repair, อย่าสร้าง parallel ledger, และอย่าเขียนลง `00_Master_Booking` Production เพื่อทดสอบ

**`20_Line_Initial_Outbox` — A1:N1, ชื่อ/ลำดับตรง 14 คอลัมน์:**

```text
outbox_id | booking_id | kind | state | claim_key | provider_message_id | provider_request_id | recipient | request_id | context_json | context_hash | message_hash | updated_at | created_at
```

**`19_Line_Decision_Outbox` — A1:K1, ชื่อ/ลำดับตรง 11 คอลัมน์:**

```text
outbox_id | booking_id | decision | state | retry_key | provider_message_id | recipient | message_type | request_id | updated_at | created_at
```

อ่านกลับ Header ทุกคอลัมน์/จำนวน/ชนิดข้อมูลและสิทธิ์ก่อนเขียนระเบียนใด ๆ; สคริปต์ reject schema drift โดยตรง. ห้ามใช้ `19_Line_Delivery_Outbox` หรือ Outbox ของระบบอื่นแทน

## 4. Environment / Script Properties — เปิดแบบสองฝั่งสอดคล้องกัน

**Staging Vercel (server-only, ไม่ใส่ค่าลง Frontend):**
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` ของ carrier ทดสอบที่เจ้าของอนุมัติ
- `KK_ADMIN_SCRIPT_URL` = exact GAS **staging** deployed `/exec`; `KK_ADMIN_API_KEY` ตรงกับ GAS
- `KK_OWNER_LINE_USER_ID` = **U+32 lowercase hex** จากกระบวนการยืนยันเจ้าของเท่านั้น; optional `KK_OWNER_LINE_TARGET_ID` เมื่อจงใจใช้ target อีกประเภทที่ตรวจแล้ว
- `KK_LINE_BOOKING_AUTOMATION_ENABLED=true`
- `KK_LINE_INITIAL_OUTBOX_V1_ENABLED=true`; `KK_LINE_OWNER_OUTBOX_V1_ENABLED=true`
- `KK_LINE_NATIVE_CONSENT_V1_ENABLED=true`; `KK_CUSTOMER_LOGIN_ENABLED=false`
- `KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET`, `KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET`, `KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET` ตั้งใน secret store เท่านั้น; แต่ละค่าแตกต่างกันและต่างจาก admin/Messaging secret
- Test isolation: `KK_LINE_BOOKING_TEST_MODE`, fixed approved origin/scope/window/event allowlist, test actor allowlist, separate `KK_LINE_APPROVAL_SECRET` ตาม `LINE_BOOKING_S2_SOURCE_ISOLATION_2026-11-17.md`. **อย่าเปิด/ขยายช่วงทดสอบโดยเดาขึ้นเอง**

**Staging GAS Script Properties:**
- `KK_ADMIN_API_KEY` และ private dispatcher keys ทั้งสามข้างบนตามที่ source คาดหวัง (secret value ต้องตรงฝั่ง Vercel แต่ **ห้ามวางค่าใน GitHub/แชท**)
- `KK_LINE_INITIAL_OUTBOX_V1_ENABLED=true`, `KK_LINE_OWNER_OUTBOX_V1_ENABLED=true`, `KK_LINE_NATIVE_CONSENT_V1_ENABLED=true`
- owner-target/recipient สอดคล้องกับ signed test identity + exact initial outbox contract

**ทำอย่างเป็นลำดับ:**
1. Backup/ACL/owner audit → staging-bound GAS version ที่ผ่าน review → headers exactly matched → Script Properties/staging Vercel values
2. Call `lineNativeConsentReadiness` ผ่าน authenticated server only: ต้องตอบ `native_consent_ready:true`, `native_consent_version:KK_LINE_NATIVE_CONSENT_V1`, `terms_version:KK-TERMS-2026-11-06`. ถ้าไม่มี action/version/flag **HOLD**, ไม่สร้าง Booking
3. ตรวจ initial+decision outbox readiness และ test source isolation แบบขอบเขตจำกัด; เช็กว่า HTTP routing จาก LINE จริงมาถึง Webhook ที่เปิดไว้, ไม่เข้าระบบลูกค้าจริง
4. จึงเปิด *staging only* สำหรับ synthetic bounded UAT; แก้ Gateway/proxy/Web App errors ก่อนทุกครั้ง

**สำคัญ:** GAS `doPost` อาจเขียน audit/error log แม้เรียก readiness จึงให้รวม audit sheets ในรายการ staging write ที่ตรวจรับได้ อย่าเรียก readiness บน Production เพื่ออ้างว่าไม่มี writes

## 5. Gate ทดสอบ UAT ที่ต้องมี Receipt จริง

| ทดสอบ | ผลที่ต้องเห็น |
| --- | --- |
| กดจองบนเว็บ → LINE draft | งาน/รุ่น/ราคา/เวลารับถูกต้อง, ไม่ต่อข้อความ Terms/Privacy; ลูกค้าต้องกด Send เอง |
| Webhook signed valid | Source private user, event/แพ็กเกจเปิดจอง, Booking ID อ่านกลับตรง, Pending เท่านั้น |
| Owner Push | Provider accepted + message/request id, owner ได้รับการ์ดใน LINE จริง ไม่ใช่แค่ `200` ใน Mock |
| Customer pending reply | ลูกค้าได้รับ Pending Flex + ยอมรับ Terms, outbox status/receipt ตรงกับข้อความ |
| Owner Confirm ก่อน consent | ไม่เขียน Booking, ไม่ Push ผลยืนยันลูกค้า, owner ได้ WAITING |
| Customer Terms postback | ตรง actor/request/booking/version; UTC receipt + canonical note readback; กดซ้ำไม่เขียนซ้ำ |
| Owner Confirm หลัง consent | เฉพาะ owner signed U-ID; `confirmed`, outbox one-time, ลูกค้าได้รับสถานะจริง |
| Owner Reject | `cancelled` และแจ้งลูกค้าผ่าน controlled outbox; opposing decision/replay ไม่มีการเขียนซ้ำ |
| Unauthorized/expired/forged | กลุ่ม/บุคคลอื่น, token หมดอายุ/แก้ไข, event ซ้ำ, ราคาหรือแพ็กเกจ drift → fail closed |
| Network timeout/lost ACK | `CLAIMED`/`UNCERTAIN` ไม่ auto-resend; reconcile manual with provider evidence |
| Admin/owner privacy | No PII/secrets/raw tokens in logs/GitHub/Preview/URL; Booking/Owner Locks ยังบังคับ |

เก็บเฉพาะ **redacted** provider HTTP response class, provider message ID fingerprint, request hash, Booking ID synthetic, commit SHA, Script deployment version, test scope/time, outbox state transition, reviewer/owner approval and rollback receipt ใน Issue #861 ห้ามคัดลอกตัวตน/Token ลูกค้าจริง

## 6. Production cutover และ rollback

**Production gate ต้องผ่านทุกข้อพร้อมกัน:** canonical workbook private ACL และ server-only public-feed transport/parity ที่ไม่พึ่ง GViz public; exact-HEAD 8/8 CI; approved diff + independent review; staging UAT receipts ครบ; owner identity confirmed; GAS deployed source/headers/ACL verified; secrets exact matches; LINE provider delivery tested; Owner Locks/booking conflicts/stock preserved; rollback evidence

1. Freeze owner-lock/booking inventory, original Vercel production deployment/commit, original GAS version and Script Properties values, workbook/schema snapshot; มี authorized operator สำหรับ rollback
2. Merge เฉพาะหลัง review ที่ exact SHA และ owner acceptance; deploy coordinated GAS + Vercel with verified credential/target binding. อย่าแก้ Production webhook เป็น Preview URL
3. เปิด flags **พร้อมกันตามแผนที่ตรวจสอบแล้ว**, ทำ owner-only noncustomer health/canary และ bounded customer/owner transaction ผ่าน LIVE provider ที่เจ้าของยืนยัน
4. ถ้าส่งไม่สำเร็จ ให้ปิด native/automation flags และย้อน deployments ตาม manifest/backup; **ห้ามลบหรือ reset initial/decision outbox**, ห้าม retry `UNCERTAIN` แบบ blind, ห้ามสร้าง Booking ทดแทน event เดิม
5. ยืนยัน Production readback, provider delivery และไม่มี duplicate/PII/Booking drift แล้วจึงปิด Issue #861

**สถานะที่ตรวจครั้งล่าสุด 23 พ.ย. 2026:** PR #875 SOURCE CHECKS 8/8 ผ่าน; Preview READY; Production ยังอยู่ `ad69ffa...` ไม่ใช่ candidate. Production workbook 32 tabs **ยังไม่มี Outbox สองแท็บ; ต้องผ่าน owner-private ACL gate ก่อนเพิ่มข้อมูลส่วนตัว**, owner LINE ID/verification และ matching native GAS deployed UAT ยังไม่มีหลักฐาน, independent approval 0, historical LINE Reply errors ยังไม่รู้ provider root cause. **สถานะ = RELEASE HOLD / NOT LIVE**, อย่าเขียนว่า DONE

**Source ของสถานะและการเปลี่ยนแปลง:** Issue #861 `https://github.com/mikesd1995/kk-phone-rental-vercel/issues/861`, PR #875 `https://github.com/mikesd1995/kk-phone-rental-vercel/pull/875`. เอกสารนี้เป็น Runbook ไม่ได้รันขั้นตอน Provisioning, รับสิทธิ์ผู้ใช้, GAS Deploy หรือ Live Provider UAT ด้วยตัวเอง
