# Deployment

Public application: https://cu-borrow.vercel.app

The application uses Vercel with Node.js 24.x and the Singapore region. Production is public; Preview deployments retain authentication protection. GitHub source publication is separate from Vercel Git auto-deployment, which must be connected explicitly if desired.

## Configure your deployment

1. Create a Supabase project and apply the migrations in order. If SQL Editor was used, repair CLI migration history before a later `supabase db push`.
2. Configure the environment variables listed in `.env.example`. Set `NEXT_PUBLIC_SITE_URL` to the production HTTPS origin and keep `ENABLE_DEV_PAYMENTS=false` and `ALLOW_DEV_SEED=false`.
3. Configure Supabase Auth Site URL and exact callback URLs for `/auth/callback`, `/auth/confirm`, and `/reset-password`. Add localhost equivalents only for local development.
4. Configure custom SMTP before opening signup, confirmation and recovery email delivery to arbitrary public addresses.
5. Use the Vercel CLI or import this repository into your own Vercel account. Keep `.vercel/` and local environment files out of Git. Do not overwrite an existing `.env.local` when pulling deployment settings.

The deployed Admin UI uses the authenticated user's session and does not require a service-role key. Development fixtures and local account provisioning can use a server-only service-role key; never add it to a `NEXT_PUBLIC_` variable or public repository.

Real payments are not integrated. Production disables development payment simulation. Direct signed image uploads support up to 5 MB; the server checks ownership, MIME and file signatures before attaching files.

For controlled releases, stage a production build with `vercel deploy --prod --skip-domain`, verify it, then promote that build with `vercel promote <deployment-url>`. Keep project identifiers in ignored local configuration.
