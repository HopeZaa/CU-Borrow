# Critical test cases

## Automated

`npm test`: inclusive pricing, numeric cents, invalid/reversed/oversized date ranges, real calendar dates, UUIDs, inclusive blackout boundaries, open redirect protection, image magic bytes and listing schema validation.

`npm run test:db`: signup profile trigger; student verification stays unverified; role/verification/status/price tampering denied; owner self-rental denied; unconfirmed users denied; blackout/past/reversed dates denied; price snapshots remain stable after edits; concurrent bookings admit exactly one renter; private records hidden to third parties; state transition ownership/previous-state checks; archive and blackout conflicts; service-only payment simulation; one and two-party handover behavior and evidence ownership; dispute holds/resumption/audit; completion aggregates; real-rental-only and duplicate review prevention; cancellation releases dates; recipient notifications; anonymous catalog access and denied booking/payment access.

`npm run test:cloud`: real Supabase anonymous catalog/public aggregate reads; private table denial; booking/payment RPC denial; Auth provider availability and confirmation configuration.

`npm run test:integration`: real Supabase login by two distinct accounts; profile trigger linkage; actual Storage upload/metadata/removal; booking/overlap/tampering; owner confirmation; renter cancellation; cleanup/archive. Dedicated test accounts and explicit opt-in required.

## Browser acceptance

| Scenario | Expected |
| --- | --- |
| Signup with invalid email/short password/name | Inline validation; no request accepted |
| Valid signup with email confirmation enabled | Confirmation message; no privileged rental action before verification |
| Confirm email in same browser | PKCE code exchanged; cookie session available |
| Confirm email in another browser using token template | `/auth/confirm` verifies token; account signed in |
| Incorrect login | Error state; no dashboard access |
| Forgot password for any email | Neutral acknowledgement; recovery link for existing account |
| Recovery link and new password | New password accepted; account data retained |
| Logout | Cookie session removed; protected routes redirect to login |
| Marketplace search/category/price/date/sort | Supabase results match filters; invalid ranges show validation |
| Item listing | Real photos, condition, owner score, deposit/location/calendar |
| Owner uploads disguised file >5 MB or fake MIME | Server signature/size or bucket policy rejects it |
| Different user edits listing | RPC rejects ownership violation |
| Two renters book same dates | One accepted; other sees conflict |
| Owner accepts; renter simulates in dev | Explicit development label; no real payment claim |
| Simulation in production build | Button absent and server rejects action |
| Pickup before start date | Rejected |
| First party uploads pickup photo | Confirmation waits for second party |
| Second party confirms | Status picked_up; timestamp and private evidence available |
| Another account scans QR | No private data; forbidden/not-found after login |
| Dual return and completion | Returned then completed; review permitted for actual renter only |
| Open dispute | Rental frozen, simulated payment held, Admin can inspect evidence |
| Admin resolves | Reason/audit entry; previous status restored or simulated refund/cancellation |
| Mobile at 390 px and tablet at 768 px | No horizontal overflow; nav, filters and forms usable |
| Keyboard/reduced motion | Visible focus, labels/alerts, reduced animations |

Do not claim unexecuted cases passed. Current execution evidence is in STATUS.md.

Deployment regression coverage: direct-upload metadata/owner paths, production URL resolution, and SSR form POST/inert/disabled state before hydration. Public browser acceptance verifies the real login action after hydration and redirects for private dashboards.
