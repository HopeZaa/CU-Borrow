# CU-Borrow: architecture and delivery plan

## Architecture
Next.js 16 App Router (upgraded with user approval from requested 14 after current security audit) + TypeScript renders Thai pages on the server. React Hook Form + Zod validate interactive forms, and every Server Action validates again. Supabase Auth uses cookie sessions with server-side `getUser`; proxy refreshes sessions, while actions and database routines independently authorize mutations. Supabase PostgreSQL is the source of truth; Supabase Storage holds public listing images and private handover evidence. No production mock-data fallback.

## Data model
`auth.users → profiles → items → item_images / item_availability`; items link to bookings with renter and owner. Bookings own payments, handovers, reviews and disputes. Notifications are private to recipients. Separate `user_roles` prevents profile updates escalating privileges; `admin_audit_logs` records administrative changes.

Bookings snapshot prices in SQL. Inclusive calendar-day rentals use Asia/Bangkok today; the return date is charged. Pending requests reserve dates until rejected/cancelled. An exclusion constraint on item + daterange rejects overlapping active bookings atomically. Row locks serialize status changes. Archived and suspended items retain rental history.

Only security-definer RPCs can mutate bookings, payments, handovers, disputes, roles and admin records. Each RPC has a fixed search path and explicit caller/previous-state checks. RLS and column privileges restrict direct writes. Public profile data excludes emails. Student verification starts `unverified`; university email alone never changes this.

## Flows
1. Sign up → email confirmation → sign in → complete profile.
2. Browse/filter → item detail/calendar → dates → server price quote → booking request.
3. Owner confirms/rejects → development simulation (optional, service-role RPC) → both parties upload photo and confirm pickup → both confirm return → complete → one review from renter.
4. A participant opens a dispute → money is marked held → admin records resolution and restores previous state or cancels/refunds simulation.
5. Owner publishes/edits a listing and blackout dates. Changes cannot move prices on existing bookings. Active bookings prevent archiving or conflicting blackout periods.

## Milestones
- M1 Foundation: schema, RLS, transactions, storage policies and core tests.
- M2 Accounts, marketplace, listing management and reservations.
- M3 Dashboards, simulated payments, QR handover, reviews, disputes and admin.
- M4 Type checks, production build, PostgreSQL security tests, setup/seed and operational documentation.

## Boundaries
Real payment capture, payouts, deposit recovery, student verification provider, malware scanning and automated dispute arbitration are future integrations. Development payment records always retain `provider=development` and `simulated=true`; they are never represented as real payment confirmation. Real payment integration must use a signed, idempotent webhook before granting `paid` status. Email delivery and auth/storage integration require a configured Supabase project.
