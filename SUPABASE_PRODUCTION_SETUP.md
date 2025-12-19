# Supabase Production Setup Guide

## Problem
Getting "An error occurred during sign in" on production after Supabase Auth migration.

## Root Cause
Production domain is not whitelisted in Supabase redirect URL configuration.

## Required Configuration in Supabase Dashboard

### Step 1: Configure Redirect URLs

Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/url-configuration

**Site URL:**
- Set to: `https://www.rexeli.com` (or your production domain)

**Redirect URLs (Add all of these):**
```
https://www.rexeli.com/auth/callback
https://www.rexeli.com/auth/verify-email
https://www.rexeli.com/auth/reset-password
https://www.rexeli.com/tool
http://localhost:3000/auth/callback (for local development)
http://localhost:3000/auth/verify-email (for local development)
http://localhost:3000/auth/reset-password (for local development)
```

**Important:** Click "Save" after adding each URL.

### Step 2: Configure Email Templates

Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/templates

**Update all email templates to use production domain:**

1. **Confirm Signup Template:**
   - Replace any `localhost:3000` with `www.rexeli.com`
   - Confirmation link should be: `https://www.rexeli.com/auth/callback?token_hash={{ .TokenHash }}&type=signup`

2. **Reset Password Template:**
   - Replace any `localhost:3000` with `www.rexeli.com`
   - Reset link should be: `https://www.rexeli.com/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery`

3. **Magic Link Template:**
   - Replace any `localhost:3000` with `www.rexeli.com`
   - Magic link should be: `https://www.rexeli.com/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`

### Step 3: Configure OAuth Providers (If Using)

**For Google OAuth:**
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/providers
2. Click "Google" provider
3. Ensure "Callback URL (for Google)" is: `https://lddwbkefiucimrkfskzt.supabase.co/auth/v1/callback`
4. In Google Cloud Console, add authorized redirect URIs:
   - `https://lddwbkefiucimrkfskzt.supabase.co/auth/v1/callback`
   - `https://www.rexeli.com/auth/callback`

**For Azure AD OAuth:**
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/providers
2. Click "Azure" provider
3. Ensure "Callback URL (for Azure)" is: `https://lddwbkefiucimrkfskzt.supabase.co/auth/v1/callback`
4. In Azure Portal, add redirect URIs:
   - `https://lddwbkefiucimrkfskzt.supabase.co/auth/v1/callback`
   - `https://www.rexeli.com/auth/callback`

### Step 4: Verify Environment Variables on Vercel

Ensure these are set: https://vercel.com/camrjs-projects/rexeli-v1/settings/environment-variables

```
NEXT_PUBLIC_SUPABASE_URL=https://lddwbkefiucimrkfskzt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key_from_supabase>
```

### Step 5: Test the Sign-In Flow

1. Go to: https://www.rexeli.com/auth/signin
2. Try signing in with email/password
3. Check browser console for any errors (F12 > Console tab)
4. Look for detailed error messages now that logging is improved

## Troubleshooting

### Error: "Invalid redirect URL"
- **Cause:** Production domain not whitelisted in Supabase
- **Fix:** Add `https://www.rexeli.com/auth/callback` to redirect URLs in Step 1

### Error: "Email not confirmed"
- **Cause:** User's email not verified
- **Fix:** Check spam folder, or manually confirm user in Supabase Auth Dashboard

### Error: "Invalid login credentials"
- **Cause:** Wrong email/password
- **Fix:** Use the password you set when creating the admin user in Supabase Auth Dashboard

### Error: "Authentication service unavailable"
- **Cause:** Missing environment variables
- **Fix:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel

### OAuth Errors
- **Cause:** OAuth provider credentials not configured for production
- **Fix:** Update Google/Azure credentials in Supabase and add production redirect URIs

## After Configuration

1. **Redeploy** the application on Vercel (new commit was pushed with better error logging)
2. **Test signin** at https://www.rexeli.com/auth/signin
3. **Check browser console** for detailed error messages if it still fails
4. **Verify admin access** at https://www.rexeli.com/admin

## What Changed vs. NextAuth

| Feature | NextAuth (Old) | Supabase Auth (New) |
|---------|---------------|---------------------|
| Redirect URLs | Configured in code | Configured in Supabase Dashboard |
| Email Templates | Custom code | Supabase Dashboard templates |
| OAuth Providers | NextAuth config | Supabase + Provider console |
| Environment Vars | `NEXTAUTH_SECRET` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Session Management | JWT cookies | Supabase session + cookies |

The key difference is that Supabase requires explicit whitelisting of redirect URLs in the dashboard, whereas NextAuth was more permissive.
