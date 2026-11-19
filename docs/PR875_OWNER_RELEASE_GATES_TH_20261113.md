# PR #875 — ขั้นตอนเจ้าของสำหรับ LINE, Supabase และ GAS

**RELEASE HOLD — ห้าม merge, deploy Production, เปิดใช้งานจริง หรือส่งข้อความหาลูกค้าจริง**

เจ้าของตอบแล้วว่า **ยังไม่ได้เลือกฐานข้อมูล customer-auth ให้เตรียมขั้นตอนก่อน** จึงยังไม่มีการเลือก target, สร้าง paid branch หรือ apply migration ใด ขั้นตอน provisioning และการทดสอบที่มี writes ด้านล่างเป็นรายการเตรียมทำใน staging ที่ระบุและอนุมัติแล้วเท่านั้น ไม่ใช่คำสั่งให้แก้ Production ตอนนี้

## งานที่ปิดเพิ่มได้ใน source

ตรวจพบและทำ RED→GREEN เพิ่ม: default ACL หรือ grants จากการติดตั้งเดิมอาจให้ `service_role` UPDATE/DELETE/TRUNCATE หลักฐาน consent และ UPDATE identity sequence แม้ migration ตั้งใจให้ SELECT/INSERT เท่านั้น Migration จึงถอนสิทธิ์ของ role นี้เฉพาะสองตารางและหนึ่ง sequence ก่อนให้สิทธิ์ที่ต้องใช้กลับ ไม่แก้ default grants ของทั้งโปรเจกต์ ไม่แตะ Inbox/Booking/Admin/Owner Locks และไม่เพิ่ม SECURITY DEFINER

Native PostgreSQL จำลองเพิ่มเป็น **12/12** ครอบคลุม default grants แบบ permissive, grant drift บน schema ที่ติดตั้งแล้ว, ปฏิเสธ DML จริงด้วย42501 และยังรับ consent/replay/lookup/revoke ผ่าน RPC ได้ ผู้ตรวจอิสระไม่พบ MATERIAL finding ใน delta นี้ Target จริงยังต้องตรวจ ownership, inherited roles และ column-specific grants; ผลจำลองไม่ปิด live migration gate

## 1. LINE — สิ่งที่คุณต้องทำ

ตรวจ Console สดพบ Provider **KK Agent (`2005383568`)** มี Messaging API สองช่อง: **KK Phone Rental (`2011794771`)** และ KKPhoneAgent (`2010860976`) ยังไม่มี LINE Login channel ในรายการนี้ ไม่ได้เปิดดูหรือคัดลอก secret และไม่ได้สร้างช่อง/เปลี่ยน webhook/ส่งข้อความ

1. เปิด [Provider KK Agent](https://developers.line.biz/console/provider/2005383568) แล้วสร้าง **LINE Login channel ชนิด Web app ภายใต้ Provider นี้** ด้วยบัญชีเจ้าของ อย่าสร้าง Provider ใหม่เพื่อแทนตัวเดิม เพราะ user ID ผูกกับ Provider [LINE อธิบายการออก user ID](https://developers.line.biz/en/docs/messaging-api/getting-user-ids/)
2. เก็บ Login channel ในสถานะ Developing สำหรับการเตรียม staging เพิ่มเฉพาะเจ้าของ/บัญชีทดสอบที่ได้รับอนุญาตใน Roles ตามหน้าคอนโซล ไม่ต้อง Publish หรือเปิดให้ลูกค้าจริง
3. เมื่อได้ host ของ staging ที่อนุมัติแล้ว ให้ตั้ง callback ในแท็บ **LINE Login** เป็น `https://<approved-staging-host>/api/kk-customer-auth?action=callback` ตรงกับค่า server ทุกตัวอักษร รวม query และ host อย่าใช้ URLสมมติในช่องจริง และอย่าเปลี่ยน Production webhook ไปหา Preview [คู่มือ callback ของ LINE](https://developers.line.biz/en/docs/line-login/integrate-line-login/)
4. เจ้าของนำ Login Channel Secret เข้าระบบ secret ของ **Vercel staging** โดยตรง ใช้ชื่อ `KK_LINE_LOGIN_CHANNEL_SECRET` และตั้ง metadata `KK_LINE_LOGIN_CHANNEL_ID`, `KK_LINE_LOGIN_PROVIDER_ID`, `KK_LINE_LOGIN_CALLBACK_URL` อย่าส่ง secret, access token, auth code, cookie หรือ user ID ของลูกค้ามาในแชท และอย่าใช้ Messaging API secret เป็น Login secret
5. ระบุ Messaging API **ช่องทดสอบที่อนุมัติ** และบัญชีทดสอบสำหรับ customer/owner อย่าใช้หรือย้ายช่อง KKPhoneAgent มาเป็น staging โดยสมมติเอง การทดสอบต้องไม่เปลี่ยน webhook ของร้านจริงหรือส่งหาลูกค้าจริง
6. ก่อนทดสอบจริง ต้องจัดการให้ LINE เข้าถึง webhook staging ได้ภายใต้นโยบายการเข้าถึงที่อนุมัติ Existing Vercel SSO อาจกัน LINE server ที่ไม่มี browser session ห้ามปิด SSO ทั้งโปรเจกต์หรือใส่ secret ใน URL เพื่อข้ามเอง

**หลักฐานที่ส่งกลับได้:** Provider ID, Login Channel ID, ชื่อ Messaging ช่องทดสอบ, callback host/path, Developing/role-setup พร้อมแล้วหรือยัง, และยืนยันว่า secret ถูกใส่ใน staging store แล้วโดยไม่ส่งค่า หลักฐานนี้ปิดได้เฉพาะ configuration subgate; customer reply/owner delivery ต้องมี receipt จากการทดสอบจริงภายหลัง

## 2. Supabase — สิ่งที่คุณต้องทำ

1. เลือก **isolated staging project หรือ branch** ที่คุณอนุมัติสำหรับ customer-auth แล้วส่งเฉพาะ Project Ref/ชื่อ/environment และระบุว่าแยกจาก Production อย่าเลือก runtime-ledger หรือ Inbox เพียงเพราะเชื่อมต่ออยู่ ขณะตรวจไม่มี development branch ของสองโปรเจกต์ที่เชื่อมต่อ และคุณยังไม่ได้เลือก target
2. บันทึก backup/rollback และผู้มีสิทธิ์ดูหลักฐาน consent กำหนดระยะเก็บหลักฐาน การลบตามคำขอ และการล้าง session หมดอายุ การหมดอายุ7วันในแอปไม่ใช่การลบข้อมูลจริง
3. ให้ตรวจ target ก่อนติดตั้งด้วย `supabase/kk_customer_auth_catalog_verify.sql` ซึ่งอ่านเฉพาะ catalog ภายใน READ ONLY transaction ไม่อ่าน customer rows หรือเรียก customer RPC ตรวจ role/table/function/owner/privilege เดิม หากมี object เดิมที่ owner/schema/สิทธิ์ไม่ตรง ให้ HOLD และรีวิวก่อน ห้าม overwrite โดยอัตโนมัติ
4. เมื่อ target และ change scope ได้รับอนุมัติแล้ว ใช้ `supabase/kk_customer_auth_v1.sql` จาก **exact HEAD ล่าสุดที่ CI ผ่าน** ผ่านกระบวนการ versioned migration ที่อนุมัติ ห้ามรันไฟล์เก่าจาก donor #856 หรือรันบนโปรเจกต์อื่น ห้ามให้เว็บสร้าง schema เอง
5. อ่าน catalog หลัง migration เทียบ source-bound manifest: สองตาราง, หก RPC เป็น SECURITY INVOKER, RLSเปิด, PUBLIC/anon/authenticated ไม่มีสิทธิ์อ่านเขียนหรือเรียก RPC, session service roleได้เฉพาะ SELECT/INSERT/UPDATE/DELETE, evidenceได้เฉพาะ SELECT/INSERT, sequenceได้เฉพาะ USAGE/SELECT ไม่มี UPDATE/DELETE/TRUNCATE หลุดมาจาก defaults/role inheritance/column grants
6. ใน staging ที่อนุมัติจึงทดสอบด้วย synthetic identities เท่านั้น: first acceptance, replayเก็บ receipt เดิม, provider/user/version mismatch, expired/revoked session, CSRFและanon/authenticated denial และอ่านกลับหลักฐาน ไม่ใช้ข้อมูลลูกค้าจริง ผล native12ที่ผ่านเป็นแบบจำลอง ยังไม่แทนขั้นนี้
7. เจ้าของใส่ `KK_CUSTOMER_AUTH_SUPABASE_URL`, `KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY` และ `KK_CUSTOMER_AUTH_SESSION_SECRET` ใน **server-only staging secret store** โดยตรง ห้ามใส่ใน browser config ห้ามส่ง keyมาในแชท และอย่าตั้ง `KK_CUSTOMER_AUTH_MIGRATION_VERIFIED=true` จนอ่านกลับ schema/privileges ผ่านจริง

**หลักฐานที่ส่งกลับได้:** Project Ref/environment ที่เลือก, migration ID/hash, metadata checkผลตรง/ไม่ตรง, advisorsที่เกี่ยวข้อง และผล synthetic staging tests ที่ลบ identity/tokenออกแล้ว ไม่ต้องส่ง rows หรือ key ให้ผมตรวจ

## 3. GAS / Google Sheets — สิ่งที่คุณต้องทำ

1. ระบุ **staging spreadsheet ↔ bound Apps Script project ↔ web-app deployment/version ↔ execution account ↔ Vercel staging** ให้ครบก่อนแก้ไข โค้ดใช้ `SpreadsheetApp.getActive()`; การตั้ง environment ชื่อใหม่ไม่ทำให้สคริปต์ผูกกับ workbook อื่นโดยอัตโนมัติ
2. เก็บ owner-private backup ของ source/manifest/version, property names, schema/permission/publication และ Booking/Owner Locks baseline ใช้ข้อมูลทดสอบใน staging แยกจากรายการจองจริง ตรวจสิทธิ์อ่านทั้ง workbook; การ hide/protect tab ไม่ได้ทำให้ข้อมูลเป็นความลับจากผู้มีสิทธิ์อ่าน workbook
3. ใน target ที่อนุมัติ จัดทำเฉพาะ tab `19_Line_Decision_Outbox` ด้วย A1:K1 ตามลำดับนี้:

   ```text
   outbox_id | booking_id | decision | state | retry_key | provider_message_id | recipient | message_type | request_id | updated_at | created_at
   ```

   จำกัดสิทธิ์ให้ owner/GAS executor ที่อนุมัติ และตรวจ publication/inherited sharing พร้อม exact header readback ต้องอยู่ใน canonical workbook/document lock เดียวกับ Booking ไม่มี dedicated installer ที่รีวิวไว้ จึงห้ามใช้ generic setup/repair functions เป็นทางลัด เพราะอาจสร้างหรือแก้ sheet อื่น ห้ามติดตั้ง `19_Line_Delivery_Outbox` อีกแบบคู่กัน
4. เจ้าของตั้งค่าเฉพาะ **staging** ผ่าน Script Properties โดยตรง: `KK_ADMIN_API_KEY`, secretเฉพาะ `KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET` (32–128ตัว URL-safe และต่างจาก admin key) พร้อมค่าคู่กันใน Vercel staging; `KK_ADMIN_SCRIPT_URL` ต้องชี้ deployment ที่ระบุ ส่วน flag `KK_LINE_OWNER_OUTBOX_V1_ENABLED` และ booking automation ให้เปิดเฉพาะรอบทดสอบ staging ที่อนุมัติภายหลัง ProductionคงHOLD/OFF
5. พิสูจน์ code ที่ **deployed version** จริงตรงกับ exact candidate: ดู deployment→immutable version แล้วเปรียบเทียบ source ของ versionนั้นในเครื่องเจ้าของ การอ่าน editor HEAD หรือ version label อย่างเดียวไม่พอ หากใช้ Apps Script API ต้องระบุ `versionNumber`; ไม่ระบุจะได้ HEAD [เอกสาร Google](https://developers.google.com/apps-script/api/reference/rest/v1/projects/getContent) `Code.gs` ใน candidateปัจจุบันยังตรง b315: SHA-256 `bf18fd62d9967976a2a87f383b6c318a34a7123600c0fbd9e26988c89b93dea3` พร้อมตรวจ manifest/ไฟล์อื่น ไม่ต้องส่ง raw project source ที่อาจมี secret
6. **อย่ารัน HTTP `lineOwnerOutboxReadiness` บน Production เพื่อทดลองว่าอ่านอย่างเดียว**: helperด้านในอ่าน schema แต่ `doPost` เขียน audit/error log และอาจสร้าง/repair log/visibility-lock sheets การรัน staging preflight จึงต้องยอมรับ audit writes ใน scopeก่อน และอ่านกลับ before/after ไม่อ้าง zero-write
7. หลัง staging scope ได้รับอนุมัติ จึงพิสูจน์ INTENTก่อนBooking→READY→CLAIMEDครั้งเดียว→provider receipt→SENT exact readback→owner reply รวม concurrent clicks, retry, opposing decision, malformed/drifted recipient, timeout/lost ACK และcapacity การทดสอบนี้ต้องใช้ Bookingสังเคราะห์และtest accountเท่านั้น

**หลักฐานที่ส่งกลับได้:** staging identity references, deployment/versionและsource-hash match, header/privacy/protection check, propertyชื่อและpairingผ่าน/ไม่ผ่าน, preflight audit result และ synthetic transaction/readbackที่ปิดบังข้อมูลแล้ว ไม่ส่ง secret หรือ Booking rows จริง

## Preview, ลำดับงาน และเกณฑ์ปิด gate

Auto Preview ถูกปิดโดย `git.deploymentEnabled` ใน `vercel.json` (`*`:false, `main`:true) จึงไม่มี deployment ของ b315 การเตรียม hostต้องเป็น **fresh manual Preview ของ exact HEAD ล่าสุด** ในโปรเจกต์เดิมหลัง staging targets/config พร้อม เก็บ SSO/OFF และไม่ใช้ `deploymentId` redeploy ที่อาจรับ environment เก่า ห้ามแก้ branch policy, promote หรือผูก Production alias เพื่อผ่าน gate

ลำดับที่ทำได้จริง: **เลือก staging targets → เตรียม LINE Login/บัญชีทดสอบ → schema/privilegeและGAS version/privacyตรวจรับ → staging provisioningที่อนุมัติ → exact Preview readback → auth/consentแบบไม่ส่งข้อความ → synthetic/test-account owner flow → independent GitHub review/owner UAT/rollback → ขอ release acceptance ในขั้นสุดท้าย** ไม่มีขั้นใดให้ merge/deployProductionเอง

| Release gate | ปิดได้เมื่อ |
| --- | --- |
| Source review | corrective source มี independent assessment และ0MATERIAL findings |
| Exact-HEAD CI | ทุก required workflow สำเร็จบนHEADล่าสุดหลัง SQL fix นี้ |
| Independent GitHub approval | reviewerที่ไม่ใช่ผู้เขียนส่งAPPROVEDจริง; ปัจจุบันยัง0 |
| Supabase migration | owner-selected staging/target, migration+effective grants/RLS+functional readback ผ่าน |
| LINE configuration | Login/Messaging Providerตรง, channel/callback/test-role/credential bindingผ่านจริง |
| Customer reply / Owner Confirm-Reject | authorizedtest-account provider receiptsกับcanonical readbackผ่าน |
| Booking idempotency / Owner Locks | live isolated-staging concurrency/replay/lock evidence ผ่าน |
| Rollback / owner release | target-specific backup/rehearsalและexact-source owner approvalครบ |

Initial notification replayถูกcontainแล้ว แต่ยังต้องreconcile Pending/deliveryevidenceก่อน recovery ห้าม blind resend สาเหตุ providerจริงของ historical `LINE booking reply failed` ยังUNKNOWN การมีCI/READYไม่ได้ปิดProductionDefinitionofDone

**สิ่งที่ต้องการจากคุณเป็นลำดับแรก:** Project RefของSupabase stagingที่เลือก และคู่staging spreadsheet/GASที่จะใช้ จากนั้นทำLINE Loginภายใต้KK Agentและแจ้งเฉพาะmetadata/configพร้อมหรือยัง ไม่ต้องส่งsecretหรือกดยืนยันProductionใด ๆ
