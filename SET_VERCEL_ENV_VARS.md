# Set Vercel Environment Variables

## Problem
Production site shows `MIDDLEWARE_INVOCATION_FAILED` error because Supabase environment variables are missing.

## Required Environment Variables

### Supabase (REQUIRED)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://lddwbkefiucimrkfskzt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
```

### OpenAI (REQUIRED for document processing)
```bash
OPENAI_API_KEY=<your_openai_api_key>
```

## How to Set on Vercel

### Option 1: Vercel Dashboard (Easiest)
1. Go to https://vercel.com/camrjs-projects/rexeli-v1/settings/environment-variables
2. Add each variable:
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://lddwbkefiucimrkfskzt.supabase.co`
   - Environments: Production, Preview, Development (check all)
3. Add the anon key:
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: Your Supabase anon key from https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/settings/api
   - Environments: Production, Preview, Development (check all)
4. Add OpenAI key:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
   - Environments: Production, Preview, Development (check all)

### Option 2: Vercel CLI
```bash
# Set Supabase URL (all environments)
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development

# Set Supabase anon key (all environments)
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development

# Set OpenAI API key (all environments)
vercel env add OPENAI_API_KEY production preview development
```

## After Setting Variables

**IMPORTANT:** After adding the environment variables, you MUST redeploy:

```bash
# Method 1: Trigger redeploy via CLI
vercel --prod

# Method 2: Trigger redeploy via dashboard
# Go to Deployments tab and click "Redeploy" on the latest deployment
```

Or simply push a new commit:
```bash
git commit --allow-empty -m "Trigger redeploy after env vars"
git push
```

## Verify

After redeploying, check:
1. https://www.rexeli.com - Should load without 500 error
2. https://www.rexeli.com/auth/signin - Should show signin page
3. Browser console should not show any Supabase connection errors
