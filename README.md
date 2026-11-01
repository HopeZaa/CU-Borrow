# CU-Borrow

เว็บเช่าและแบ่งปันสิ่งของสำหรับนิสิต ใช้ภาษาไทยเป็นหลัก พร้อม Supabase PostgreSQL, Auth และ Storage จริง ไม่มี mock-data fallback ใน Production

> Stack เดิมใน brief คือ Next.js 14 แต่ปรับเป็น Next.js 16.4.3 โดยผู้ใช้อนุมัติ หลังตรวจพบ security advisories ที่ไม่มีแพตช์ในสาย 14 ณ 1 พ.ย. 2026 ใช้ React 19, TypeScript, Tailwind CSS 3, React Hook Form และ Zod 4

## รันบนเครื่อง

ต้องมี Node.js 22.12+ และ npm

```bash
git clone https://github.com/HopeZaa/CU-Borrow.git
cd CU-Borrow
npm ci
cp .env.example .env.local # ข้ามขั้นตอนนี้ถ้ามีไฟล์ค่าจริงแล้ว
npm run dev
```

เปิด http://localhost:3000 โดยใช้ hostname นี้ให้ตรงกับ Site URL และอีเมลลิงก์ (อย่าสลับกับ 127.0.0.1 ระหว่าง flow Auth)

`.env.local` ต้องมี:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENABLE_DEV_PAYMENTS=false
```

URL ต้องเป็น project origin ไม่ต่อ `/rest/v1/` รองรับ legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` แทน Publishable key ได้ ห้ามใส่ service-role/secret key ในตัวแปร `NEXT_PUBLIC_` ไฟล์ `.env*` ถูก ignore ยกเว้น `.env.example`

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ Supabase และคัดลอก Project URL กับ Publishable key ลง `.env.local`
2. ติดตั้ง Supabase CLI ผ่านวิธีทางการ แล้ว `supabase login` และ `supabase link --project-ref YOUR_PROJECT_REF`
3. รัน `supabase db push` เพื่อใช้ migration ทั้งหมดใน `supabase/migrations/` ตามลำดับบนโปรเจกต์ใหม่
4. ทางเลือก: เปิด SQL Editor และรัน migration ทั้งไฟล์ โดยตรวจว่าไม่มีตารางชื่อเดียวกันก่อน ถ้ารันผ่าน SQL Editor แล้ว อย่า `db push` migration เดิมซ้ำ ให้บันทึก history ด้วย `supabase migration repair --status applied 202611010001` ก่อน
5. Authentication → URL Configuration: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm`, `http://localhost:3000/reset-password`
6. เปิด Email provider และ Confirm email คงการยืนยันอีเมลไว้ สำหรับ production ตั้ง SMTP ของผู้ให้บริการของคุณและปรับ URL ทั้งสามเป็น HTTPS origin จริง
7. ถ้าใช้อีเมล template สำหรับข้ามอุปกรณ์ ให้ Confirmation URL เป็น `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`; Recovery เป็น `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` ส่วน default PKCE callback รองรับกรณีเปิดอีเมลใน browser เดียวกับที่สมัคร
8. Migration สร้าง bucket `item-images` (public) และ `handover-evidence` (private), RLS และ MIME/5 MB limit แล้ว ไม่ต้องสร้างซ้ำ
9. สมัครบัญชีจริงผ่านหน้าเว็บและยืนยันอีเมล สมาชิกใหม่ยังมีสถานะนิสิต `unverified` เสมอ

ดู `docs/STATUS.md` สำหรับสถานะฟีเจอร์และการตรวจสอบล่าสุด ใช้ Supabase project ของคุณเองและเก็บค่าจริงใน `.env.local` หรือ environment variables ของโฮสต์เท่านั้น

### Admin คนแรก

สมัครและยืนยันอีเมลด้วยบัญชีที่ต้องการก่อน จากนั้นผู้ดูแลฐานข้อมูลรันใน SQL Editor (แทน UUID ด้วย `auth.users.id` ของบัญชีจริง):

```sql
insert into public.user_roles(user_id, role)
values ('REPLACE-WITH-REAL-USER-UUID', 'admin');
```

ผู้ใช้สร้าง role หรือแก้ verification/suspension ของตนเองไม่ได้ Admin ที่ยืนยันอีเมลแล้วสามารถให้หรือถอนสิทธิ์ Admin ของบัญชีอื่นจากหมวดผู้ใช้ ระบบป้องกันการระงับหรือถอนสิทธิ์ Admin ที่ใช้งานได้คนสุดท้าย

## Development seed และการชำระจำลอง

ใช้ project สำหรับทดลองเท่านั้น Seed สร้างบัญชีทดสอบ 3 บัญชี (owner/renter/admin) พร้อมรหัสผ่านสุ่ม และประกาศ `[DEV]` 4 รายการจริงในฐานข้อมูล โดยไม่ส่งอีเมล ไม่สร้างรีวิวหรือคะแนนปลอม และไม่ทำงานอัตโนมัติเมื่อ build/start

ใส่ `SUPABASE_SERVICE_ROLE_KEY` บนเครื่องใน `.env.local` โดยตรง แล้วรัน:

```bash
ALLOW_DEV_SEED=true npm run seed
```

รหัสผ่านที่สุ่มอยู่ใน `.env.seed-credentials` ซึ่งถูก ignore และสร้างด้วย permission 0600 Seed เป็น one-time script: ถ้ามีอีเมลทดสอบอยู่แล้วจะหยุด ไม่เขียนทับผู้ใช้เดิม ไม่ควร seed project production

เปิด simulation โดยเพิ่ม:

```dotenv
ENABLE_DEV_PAYMENTS=true
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

แล้ว restart `npm run dev` ปุ่มจำลองจะแสดงเฉพาะผู้เช่าในสถานะ confirmed เมื่อ `NODE_ENV=development` และตั้งค่าครบ `npm run build && npm start` ปิด simulation เสมอ ไม่ว่า flag จะเป็นค่าใด

RPC จำลองให้สิทธิ์เฉพาะ `service_role` Server Action ตรวจ session ผู้เช่าก่อนใช้ client แยกบน server โดยไม่ persist session บันทึก `provider=development, simulated=true` และไม่มีการเคลื่อนเงินจริงจริง ข้อมูลเงินประกัน ค่าธรรมเนียม การพักเงิน และการคืนเงินรองรับใน schema แต่ Payment Gateway, webhook, payout และ real refund ยังไม่ได้เชื่อม

## ทดลอง flow หลัก

1. Owner ลงประกาศ กำหนดราคา เงินประกัน วันเปิดให้เช่า และจุดรับ–คืน แล้วเพิ่มภาพหรือ blackout dates
2. Renter เลือกวันที่ว่างและส่งคำขอ ค่าเช่าคิดรวมวันรับและวันคืน SQL เป็นผู้คำนวณราคา snapshot
3. Owner เปิด Dashboard → คำขอเช่า → ยืนยันหรือปฏิเสธ
4. Renter จำลองการชำระใน dev (ไม่มีเงินจริง)
5. ตั้งแต่วันรับ เปิด QR ในรายการ อีกฝ่ายเข้าสู่ระบบของตน แต่ละคนอัปโหลดรูปและยืนยันรับ ระบบเปลี่ยนเป็น picked_up เมื่อครบทั้งสองคน
6. ทำเช่นเดียวกันตอนคืน → returned → ยืนยันเสร็จสิ้น → completed → Renter รีวิวได้หนึ่งครั้ง
7. ทดสอบข้อพิพาทระหว่าง confirmed/paid/picked_up/returned แล้วใช้ Admin ตรวจหลักฐานและบันทึกผล ระบบพักสถานะ/เงินจำลองจนแก้ไข

การยกเลิกโดย renter ทำได้เฉพาะ pending/confirmed ที่ยังไม่ผ่านวันรับ หลังชำระให้เปิดข้อพิพาท Owner ลบประกาศผ่านการ archive เฉพาะรายการไม่มี booking ค้าง เพื่อรักษาประวัติ

## การทดสอบ

```bash
npm run typecheck
npm test
npm run build
npm run test:cloud
```

`test:cloud` ใช้เพียง Public key ตรวจ API ของ Supabase จริงและ anonymous RLS โดยไม่เพิ่มข้อมูล

ทดสอบ PostgreSQL ด้วยฐานข้อมูล **ใหม่และว่างที่ทิ้งได้เท่านั้น**:

```bash
TEST_DATABASE_URL=postgresql://localhost/cu_borrow_test \
ALLOW_DISPOSABLE_DB_TEST=true npm run test:db
```

ต้องมี `psql` และสิทธิ์สร้าง roles/extensions Script ตรวจว่าฐานข้อมูลว่างก่อน bootstrap auth/storage SQL contracts แล้วรัน migration, RLS, state machine, money, private data, handover, review, dispute และ race test สอง connections Bootstrap ไม่ได้จำลอง Supabase Auth หรือ HTTP Storage service

ทดสอบ Auth/PostgREST/Storage จริงกับบัญชีทดสอบที่ยืนยันอีเมลแล้ว:

```bash
ALLOW_DEV_INTEGRATION=true \
TEST_OWNER_EMAIL=owner.cu-borrow@example.com \
TEST_RENTER_EMAIL=renter.cu-borrow@example.com \
TEST_OWNER_PASSWORD=OWNER_RANDOM_PASSWORD \
TEST_RENTER_PASSWORD=RENTER_RANDOM_PASSWORD \
npm run test:integration
```

หรือใส่ตัวแปรใน `.env.local` เพื่อไม่เก็บรหัสผ่านใน shell history การทดสอบสร้างประกาศเฉพาะและเก็บ/archive เมื่อจบ ไม่ลบประวัติการจอง Full Auth signup, confirmation, recovery และ cookie-session browser scenarios ระบุใน `docs/TEST-CASES.md`

## โครงสร้าง

- `app/` — routes ภาษาไทยและ Server Actions
- `components/` — responsive UI, forms, calendar และ booking controls
- `lib/` — schemas, pricing helpers, auth และ Supabase server client
- `proxy.ts` — refresh cookie session; authorization ยังคงทำซ้ำใน actions/RPC
- `supabase/migrations/` — schema, constraints, indexes, RLS, RPCs, Storage policies
- `supabase/tests/` — disposable SQL security/lifecycle test suite
- `scripts/` — seed และ cloud/integration/database tests
- `docs/` — architecture, feature status และ test cases

## ขอบเขตก่อน Production

อ่าน `docs/STATUS.md` ก่อน deploy: ต้องตั้ง SMTP/production origin, ผู้ดูแลและช่องทางติดต่อ/ระยะเวลาเก็บข้อมูล, provider ตรวจนิสิต และระบบชำระจริงพร้อม signed idempotent webhook ไม่ควรนำ development seed หรือ key ไปเปิด simulation บน production ไม่ใช้สถานะ paid จำลองเป็นหลักฐานโอนเงินจริง

ข้อมูลในหน้า Marketplace มาจาก Supabase จริงเท่านั้น เมื่อฐานข้อมูลว่างจะแสดง Empty state ไม่สร้างสินค้าปลอมเพื่อเติมหน้าจอ หน้า Admin รองรับค้นหาและแบ่งหน้า 20 รายการ ครอบคลุมทุกตารางของแอปและไฟล์หลักฐาน ส่วน Marketplace ยังแสดงสูงสุด 100 รายการต่อครั้ง และยังไม่มี notification email

เอกสารอ้างอิง: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js security advisories](https://github.com/vercel/next.js/security/advisories)

## Vercel deployment

ใช้ `vercel.json` ที่เตรียมไว้ (Node.js 24.x, Next.js, region Singapore) ตั้ง Production variables เป็น Supabase URL/Publishable key, `ENABLE_DEV_PAYMENTS=false`, `ALLOW_DEV_SEED=false` และ `NEXT_PUBLIC_SITE_URL` เป็น HTTPS origin ของเว็บจริง หากยังไม่กำหนด URL ระบบใช้ `VERCEL_PROJECT_PRODUCTION_URL` จาก Vercel อัตโนมัติ ตั้ง Site URL/Redirect URLs ใน Supabase ให้ตรงกับโดเมนนี้

ไฟล์ภาพอัปโหลดตรงเข้า Supabase ด้วย signed upload token ที่ Server สร้างเฉพาะ path หลังตรวจ session/เจ้าของ/สถานะ แล้ว Server ดาวน์โหลดไฟล์จาก Storage เพื่อตรวจขนาด MIME และ magic bytes ก่อนผูกกับประกาศหรือยืนยัน handover ไฟล์ binary ไม่ผ่าน request ของ Vercel Function จึงรองรับ 5 MB ได้ ส่วน Server Action รับเพียง metadata และใช้ limit 1 MB

การเปิดสมัครสำหรับคนทั่วไปต้องตั้ง custom SMTP ใน Supabase ตามคู่มือทางการ ระบบอีเมล default ไม่เหมาะกับ public signup ไม่มีการตั้ง SMTP หรือเปิดระบบรับเงินจริงโดยอัตโนมัติ

สำหรับ deploy ครั้งถัดไปจากโฟลเดอร์นี้ ใช้ `npx vercel --prod` และล็อกอินบัญชีเจ้าของโปรเจกต์ตามขั้นตอนของ Vercel ไฟล์ `.vercel/project.json` เชื่อมกับโปรเจกต์เดิมและถูก ignore ไว้ Source ในรอบนี้ deploy ตรงผ่าน Vercel ยังไม่ได้เชื่อม GitHub auto-deploy


### Admin management migration

Apply `supabase/migrations/202611020001_admin_management.sql` once after the initial migration. It adds audited RPCs for all application tables, admin role management, private file browsing, and before/after snapshots. Every mutation requires a reason. Ordinary members cannot execute admin operations; all RPCs enforce the current verified, active admin role in the database. Changing a booking price recomputes totals; real gateway payments remain controlled by their provider. Profiles/listings/bookings use suspension/archive/cancellation to preserve rental history. Audit logs and authentication secrets are not editable from this interface.

To provision the first admin, put the server-only `SUPABASE_SERVICE_ROLE_KEY` in the local `.env.local`, then run `node scripts/provision-admin.mjs`. Enter email and password at the prompts (password entry is hidden). The script creates or updates the selected Auth account, confirms its email, restores active status, grants the admin role, records an audit event, and verifies login plus `cu_admin_me`. It never stores the password. Do not use command-line password arguments or commit local env files. This key is only needed for the provisioning script; the deployed Admin UI uses the signed-in user's session and does not need a service key.


## Publishing source safely

This repository contains application source and database migrations. It does not contain production data, uploaded files, account credentials, local environment values, or Vercel project linkage. Copy `.env.example` locally and supply your own configuration. Never commit `.env.local`, seed credentials, database exports, private keys, or `.vercel/`.

Before committing, inspect `git diff --cached` and run `gitleaks git --redact`. Keep secret values in your local environment or hosting provider's secret settings. If a secret is ever published, revoke or rotate it; deleting the latest file does not remove it from Git history.


## License

Copyright © 2026 HopeZaa. เผยแพร่ภายใต้ [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`).
