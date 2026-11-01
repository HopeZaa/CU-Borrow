# Feature and verification status

Updated: 2 November 2026 (Asia/Bangkok)

## Implemented

| Area | Delivered |
| --- | --- |
| Homepage | Thai responsive marketplace, real database selections, search, categories and empty/loading/error states |
| Authentication | Signup, email confirmation, sign-in/out, recovery/reset, profile editing and separate student verification |
| Catalog | Name/category/price/date filtering and sorting, owner statistics, Storage images and availability calendar |
| Listings | Owner create/edit/archive, rental/deposit/date window, up to 6 validated images, blackout dates |
| Reservations | Server price snapshots, inclusive Thai calendar dates, exclusion constraint and locks against overlap |
| Rental lifecycle | Eight statuses, owner decisions, conditional renter cancellation and dual handover confirmation |
| Development payment | Explicit server-only simulated records; disabled in production |
| Handover | Booking QR, private evidence per participant, timestamps and dual pickup/return confirmations |
| Reviews | One renter review after completion; owner aggregates |
| Dashboards | Owner and renter views, private notifications |
| Administration | All 12 application tables, search and pagination, audited data management, role assignment, private file viewing and last-active-admin protection |
| Delivery | Source, migrations/RLS/Storage policies, opt-in development seed and setup/test documentation |

Stack: Next.js 16.4.3, React 19.3.1, TypeScript, Tailwind CSS 3, Supabase, React Hook Form and Zod 4.6.7. Exact dependencies are recorded in the lockfile.

## Verified

- TypeScript and optimized production build passed.
- 27 unit/regression tests passed.
- 78 PostgreSQL security/lifecycle/admin assertions passed in a disposable database; a separate two-connection reservation race admitted exactly one renter.
- Live public catalog access and anonymous private-data/RPC restrictions passed.
- Live browser login, the ordinary-member Admin guard, authorized Admin access, and Admin create/edit actions passed.
- Admin before/after audit snapshots were verified. The isolated test notification was removed; audit history was retained.
- Authenticated Admin queries for all 12 tables and both Storage bucket listings passed. A real signed item-image URL was fetched successfully. No live handover-file fixture was available in that check.
- Homepage mobile rendering, filtering and invalid login handling were checked. Credential forms use POST and disable submission before hydration.
- The deployed application is available at https://cu-borrow.vercel.app.

## Pending external configuration / verification

- Custom SMTP and production signup/confirmation/recovery email delivery.
- Full authenticated multi-user payment and pickup/return integration against dedicated test fixtures.
- University student verification provider/workflow. Email alone never grants verified student status.
- Real payment capture, signed/idempotent webhooks, payouts, refunds and deposit deductions.
- Retention/contact policies and further production operations configuration.

Marketplace queries remain limited to 100 results; Admin pagination uses 20 rows per page. Pending requests reserve dates until cancellation/rejection. Rental history and evidence are retained; listings are archived to preserve references. Audit history and authentication secrets are not editable in the Admin UI.

This public status document intentionally omits account identifiers, environment values, project/team identifiers, deployment IDs and production data. Use your own project and local configuration when running a copy.
