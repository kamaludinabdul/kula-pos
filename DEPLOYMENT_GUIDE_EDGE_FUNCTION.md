
# Deployment Guide: Staff Onboarding Edge Function

Follow these steps to deploy the `create-user` Edge Function to both **Staging** and **Production** environments.

## Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- You must be logged in (`npx supabase login`)

## 1. Deploy to Production
First, ensure you are linked to the **Production** project.

```bash
# 1. Link to Production (Replace <prod-project-ref> with your actual project ID)
npx supabase link --project-ref <prod-project-ref>

# 2. Deploy Function
npx supabase functions deploy create-user --no-verify-jwt

# 3. Set Environment Variables (if needed, e.g. service role key is auto-injected but others might not be)
# npx supabase secrets set --env-file .env
```

## 2. Deploy to Staging
Next, switch to the **Staging** project and deploy.

```bash
# 1. Link to Staging (Replace <staging-project-ref> with your actual project ID)
npx supabase link --project-ref <staging-project-ref>

# 2. Deploy Function
npx supabase functions deploy create-user --no-verify-jwt
```

## 3. Verify
After deployment, verify by trying to add a new staff member in the respective application URL.
