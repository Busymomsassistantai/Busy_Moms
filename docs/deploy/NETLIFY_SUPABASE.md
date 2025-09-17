## Netlify + Supabase — Production Env Checklist

Your app must be built with *correct* public envs for the target Supabase project.

**Authoritative project ref:** `rtvwcyrksplhsgycyfzo`

## Required Environment Variables (set in Netlify UI → Site settings → Build & deploy → Environment)
- `VITE_SUPABASE_URL` = `https://rtvwcyrksplhsgycyfzo.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = **Anon public key** from Supabase → Project Settings → API (for project `rtvwcyrksplhsgycyfzo`)
- `VITE_FUNCTIONS_URL` = `https://rtvwcyrksplhsgycyfzo.functions.supabase.co/instacart-proxy`
- `VITE_AI_FUNCTIONS_URL` = `https://rtvwcyrksplhsgycyfzo.functions.supabase.co/ai-proxy`
- (Optional) `VITE_SUPABASE_PROJECT_REF` = `rtvwcyrksplhsgycyfzo` (helps normalize URLs)

> ⚠️ Do **not** commit secrets like anon keys to the repo. Set them in Netlify's Environment UI only.

## Redeploy
After updating env vars, trigger a fresh deploy:
1. In Netlify, click **Deploys → Trigger deploy → Clear cache and deploy site**.
2. Open your site and navigate to **/debug/network** (if included) and your app login page.

## What to check
- Open DevTools Console:
  - You should NOT see messages about mismatched project refs.
- If the **Config Warning** banner appears, the anon key and project ref still disagree. Update envs and redeploy.