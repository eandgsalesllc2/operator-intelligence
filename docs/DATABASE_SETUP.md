# Database setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Vercel project settings, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Preview and Production.
4. Redeploy.
5. GET `/api/investigations` returns `"database": true` when persistence is active.

The service-role key is server-only and must never use a NEXT_PUBLIC_ prefix.
