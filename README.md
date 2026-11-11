# neo. v3 Cloud

Fictional banking simulator with Supabase Auth, Postgres and atomic demo-coin transfers. **Not real money.**

## Deploy

1. Create a Supabase project at https://supabase.com/dashboard.
2. Open **SQL Editor**, paste and run `schema.sql` **once on a new project**.
3. Open **Project Settings > API** (or Connect), copy Project URL and **publishable/anon key** into `config.js`. Never use service_role/secret key in the browser.
4. In Supabase **Authentication > Providers > Email**, enable email login and decide whether email confirmation is required. For production keep confirmation enabled. Set **Authentication > URL Configuration > Site URL** to your deployed HTTPS domain.
5. Push these files to GitHub, import the repo at https://vercel.com/new as **Other** framework, deploy as a static site. No build command needed; output directory is the repository root (or leave default).
6. Open deployed URL and register two different accounts to test demo transfers.

## Notes

- Each new user starts with **1,000 demo coins**. No cash value.
- All balance mutations are performed inside `send_demo_coins` as one database transaction with row locks; browser users cannot directly edit balances.
- Profiles and transfers have RLS enabled; transfers and profile inserts are not writable through the public API.
- Nicknames are lowercase a-z, 0-9, underscore, 3-20 characters. Duplicate nicknames fail registration.
- For a real public launch, add abuse protection, rate limits, monitoring, terms/privacy pages, and stronger signup error handling. Do not reuse this for real-money operations.
- This version does not include an admin panel. Any credit changes should only be made manually in Supabase SQL Editor by the project owner.
