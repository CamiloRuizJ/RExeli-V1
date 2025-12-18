# Supabase Auth Migration - Deployment Guide

**Migration Status**: ✅ Code Complete - Ready for Configuration & Testing
**Migration Date**: 2025-12-18
**From**: NextAuth v5 (credentials)
**To**: Supabase Auth (OAuth + Email)

---

## Quick Start

1. Install packages: `npm install @supabase/ssr @supabase/auth-helpers-nextjs`
2. Configure Supabase Dashboard (see Section 2)
3. Run migration SQL (see Section 3)
4. Create admin user (see Section 4)
5. Test authentication flows (see Section 7)
6. Deploy to production (see Section 8)

---

## 1. Pre-Deployment Checklist

### ✅ Code Changes (COMPLETED)
- [x] Created server-side Supabase client ([src/lib/supabase-server.ts](src/lib/supabase-server.ts))
- [x] Created auth helper functions ([src/lib/auth-helpers.ts](src/lib/auth-helpers.ts))
- [x] Created browser auth client ([src/lib/supabase-auth-client.ts](src/lib/supabase-auth-client.ts))
- [x] Created useAuth hook ([src/hooks/useAuth.ts](src/hooks/useAuth.ts))
- [x] Created OAuth callback handler ([src/app/auth/callback/route.ts](src/app/auth/callback/route.ts))
- [x] Created email verification page ([src/app/auth/verify-email/page.tsx](src/app/auth/verify-email/page.tsx))
- [x] Created password reset page ([src/app/auth/reset-password/page.tsx](src/app/auth/reset-password/page.tsx))
- [x] Updated sign in page ([src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx))
- [x] Updated sign up page ([src/app/auth/signup/page.tsx](src/app/auth/signup/page.tsx))
- [x] Updated middleware ([src/middleware.ts](src/middleware.ts))
- [x] Updated 11 API routes to use `getSession()`
- [x] Created database migration ([supabase/migrations/012_supabase_auth_integration.sql](supabase/migrations/012_supabase_auth_integration.sql))
- [x] Conducted security review ([SECURITY_REVIEW.md](SECURITY_REVIEW.md))

### 📦 Package Installation (PENDING)
```bash
npm install @supabase/ssr @supabase/auth-helpers-nextjs
```

### 🔐 Environment Variables (VERIFY)
Ensure these are set in `.env.local` and Vercel:

```bash
# Public (exposed to client)
NEXT_PUBLIC_SUPABASE_URL=https://lddwbkefiucimrkfskzt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_anon_key]

# Private (server-side only)
SUPABASE_SERVICE_ROLE_KEY=[your_service_role_key]  # ⚠️ NEVER COMMIT!

# OAuth (if using)
GOOGLE_CLIENT_ID=[from_google_cloud_console]
GOOGLE_CLIENT_SECRET=[from_google_cloud_console]
AZURE_AD_CLIENT_ID=[from_azure_portal]
AZURE_AD_CLIENT_SECRET=[from_azure_portal]
AZURE_AD_TENANT_ID=common
```

**To remove after migration**:
```bash
# These will no longer be needed:
# NEXTAUTH_URL
# NEXTAUTH_SECRET
```

---

## 2. Supabase Dashboard Configuration

### Step 1: Enable Email Provider
1. Go to: **Authentication > Providers > Email**
2. **Enable email provider**: ON
3. **Confirm email**: ENABLED (required for new signups)
4. **Secure email change**: ENABLED (requires email confirmation)
5. **Email OTP expiry**: 3600 seconds (1 hour)

### Step 2: Customize Email Templates
1. Go to: **Authentication > Email Templates**
2. Customize templates for your brand:

**Confirm Signup Template:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your email address and activate your RExeli account:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
<p>You'll receive 25 free trial credits to get started!</p>
```

**Reset Password Template:**
```html
<h2>Reset your password</h2>
<p>Follow this link to reset your RExeli password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

### Step 3: Configure Site URL
1. Go to: **Authentication > URL Configuration**
2. **Site URL**: `https://your-domain.com`
3. **Redirect URLs**: Add these:
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/auth/reset-password`
   - `http://localhost:3000/auth/callback` (for development)
   - `http://localhost:3000/auth/reset-password` (for development)

### Step 4: Configure Google OAuth (Optional)
1. Go to: **Authentication > Providers > Google**
2. **Enable Google provider**: ON
3. **Client ID**: [from Google Cloud Console]
4. **Client Secret**: [from Google Cloud Console]
5. **Authorized redirect URI** (Google Cloud Console):
   ```
   https://lddwbkefiucimrkfskzt.supabase.co/auth/v1/callback
   ```

**Google Cloud Console Setup:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI (above)
4. Copy Client ID and Secret to Supabase

### Step 5: Configure Azure OAuth (Optional)
1. Go to: **Authentication > Providers > Azure**
2. **Enable Azure provider**: ON
3. **Client ID**: [from Azure Portal]
4. **Client Secret**: [from Azure Portal]
5. **Azure Tenant**: `common` (or specific tenant ID)
6. **Redirect URI** (Azure Portal):
   ```
   https://lddwbkefiucimrkfskzt.supabase.co/auth/v1/callback
   ```

**Azure Portal Setup:**
1. Go to: https://portal.azure.com/
2. Azure Active Directory > App registrations > New registration
3. Add redirect URI (above)
4. Create client secret in "Certificates & secrets"
5. Copy Application (client) ID and Secret to Supabase

### Step 6: Security Settings
1. Go to: **Authentication > Policies**
2. **Max password length**: 72 (bcrypt limit)
3. **Minimum password length**: 8
4. **Require uppercase**: Optional (recommended)
5. **Require numbers**: Optional (recommended)
6. **Require special characters**: Optional

### Step 7: Rate Limiting (Recommended)
1. Go to: **Authentication > Rate Limits**
2. **Email signups**: 5 per hour per IP
3. **Email signins**: 10 per hour per IP
4. **SMS OTP**: Disabled (not using SMS)
5. **Password recovery**: 5 per hour per email

---

## 3. Database Migration

### Run Migration 012

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to: **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy contents of `supabase/migrations/012_supabase_auth_integration.sql`
4. Paste into editor
5. Click **Run** (bottom right)
6. Verify success message

**Option B: Via Supabase CLI**
```bash
# If you have Supabase CLI installed
cd c:\Users\camrj\RExeli\RExeli-V1
supabase db push
```

### Verify Migration Success
Run this query in SQL Editor to verify:
```sql
-- Check if new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('auth_user_id', 'email_verified', 'provider', 'last_sign_in_at');

-- Check if triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_verified');

-- Check if functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('handle_new_user', 'handle_email_verified', 'get_user_profile', 'update_last_sign_in');
```

Expected results:
- 4 columns found (auth_user_id, email_verified, provider, last_sign_in_at)
- 2 triggers found (on_auth_user_created, on_auth_user_verified)
- 4 functions found

---

## 4. Create Admin User

### Step 1: Create User in Supabase Auth
1. Go to: **Authentication > Users** in Supabase Dashboard
2. Click **Add user** (top right)
3. **Email**: `admin@rexeli.com`
4. **Password**: [Generate strong password - save securely]
5. **Auto Confirm User**: ✅ YES (bypass email verification)
6. **User Metadata** (JSON):
   ```json
   {
     "name": "RExeli Administrator"
   }
   ```
7. **App Metadata** (JSON):
   ```json
   {
     "role": "admin",
     "provider": "email"
   }
   ```
8. Click **Create user**
9. **Copy the UUID** from the user row (this is the `auth_user_id`)

### Step 2: Link to Existing Public User
Go to **SQL Editor** and run:
```sql
-- Replace [AUTH_USER_UUID] with the UUID from Step 1
UPDATE public.users
SET
  auth_user_id = '[AUTH_USER_UUID]',
  role = 'admin',
  email_verified = true,
  provider = 'email',
  updated_at = NOW()
WHERE email = 'admin@rexeli.com';

-- Verify the update
SELECT id, email, name, role, auth_user_id, email_verified
FROM public.users
WHERE email = 'admin@rexeli.com';
```

### Step 3: Test Admin Login
1. Go to: `https://your-domain.com/auth/signin`
2. Sign in with `admin@rexeli.com` and the password you set
3. Verify you're redirected to `/tool` or `/dashboard`
4. Navigate to `/admin` - should have access
5. Check that admin features work (view users, analytics, etc.)

---

## 5. Migrate Existing Users (Optional)

### Option A: Force Password Reset (Recommended)
This is the safest approach for existing users.

1. **Email all existing users**:
   ```
   Subject: RExeli Security Update - Password Reset Required

   Hi [Name],

   We've upgraded RExeli's authentication system to provide you with:
   - More secure login with email verification
   - Sign in with Google and Microsoft
   - Improved password reset flow

   To complete this upgrade, please reset your password:
   [Link to password reset page]

   Your account data and credits are safe and unchanged.

   Thank you,
   The RExeli Team
   ```

2. **Create reset tokens** (run in SQL Editor):
   ```sql
   -- Get list of users without auth_user_id
   SELECT email, name, credits
   FROM public.users
   WHERE auth_user_id IS NULL
     AND is_active = true
   ORDER BY created_at;
   ```

3. **Users reset their password via Supabase Auth**:
   - User clicks "Forgot Password"
   - Enters email
   - Receives reset email from Supabase
   - Sets new password
   - Trigger function automatically links `auth_user_id`

### Option B: Manual Migration Script
For VIP users or if you want to migrate programmatically:

```typescript
// scripts/migrate-user.ts
import { supabaseAdmin } from '@/lib/supabase'

async function migrateUser(email: string, tempPassword: string) {
  // 1. Create user in Supabase Auth
  const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name: '[Name from public.users]'
    }
  })

  if (createError) {
    console.error('Failed to create auth user:', createError)
    return
  }

  // 2. Link to public.users
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ auth_user_id: authUser.user.id })
    .eq('email', email)

  if (updateError) {
    console.error('Failed to link user:', updateError)
    return
  }

  // 3. Send password reset email
  const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email
  })

  console.log('User migrated:', email)
}
```

---

## 6. Remove Old Auth Code (After 30 Days)

Once all users have migrated, clean up:

### Step 1: Remove NextAuth Files
```bash
rm -rf src/lib/auth.ts
rm -rf src/app/api/auth/[...nextauth]
rm -rf src/app/api/auth/signup
```

### Step 2: Remove Password Column
```sql
-- Run in SQL Editor after all users migrated
ALTER TABLE public.users DROP COLUMN IF EXISTS password;
```

### Step 3: Uninstall NextAuth
```bash
npm uninstall next-auth bcrypt
```

### Step 4: Remove Environment Variables
Remove from `.env.local` and Vercel:
```bash
NEXTAUTH_URL
NEXTAUTH_SECRET
```

---

## 7. Testing Checklist

### Authentication Tests
Test these flows before deploying to production:

**Email/Password Auth:**
- [ ] Sign up with new email (should send verification email)
- [ ] Verify email (click link in email)
- [ ] Sign in with verified account (should redirect to /tool)
- [ ] Sign in with unverified account (should show error)
- [ ] Request password reset
- [ ] Complete password reset (update password)
- [ ] Sign in with new password

**OAuth (Google):**
- [ ] Sign up with Google (first time)
- [ ] Verify profile created in public.users
- [ ] Verify 25 credits awarded
- [ ] Sign out and sign in again with Google

**OAuth (Azure):**
- [ ] Sign up with Azure/Microsoft (first time)
- [ ] Verify profile created
- [ ] Verify 25 credits awarded
- [ ] Sign out and sign in again with Azure

**Session Management:**
- [ ] Session persists on page reload
- [ ] Session works across multiple tabs
- [ ] Sign out clears session
- [ ] Protected routes redirect to sign in when logged out

### Authorization Tests
**Regular User:**
- [ ] Can access /tool
- [ ] Can access /dashboard
- [ ] Cannot access /admin (should redirect or show 403)
- [ ] Can view own documents
- [ ] Cannot view other user's documents (API returns 404)

**Admin User:**
- [ ] Can access /admin
- [ ] Can view all users
- [ ] Can view analytics
- [ ] Can add credits to users
- [ ] Can assign subscription plans
- [ ] Can activate/deactivate users

### Credit System Tests
- [ ] New user receives 25 credits (check credit_transactions table)
- [ ] Document processing deducts credits
- [ ] Insufficient credits blocks processing
- [ ] Admin can add credits
- [ ] Credit balance updates in real-time

### Security Tests
- [ ] SQL injection attempts fail
- [ ] XSS attempts are escaped
- [ ] CSRF protection works
- [ ] Cannot access other user's data
- [ ] Cannot escalate privileges to admin

---

## 8. Production Deployment

### Step 1: Deploy to Staging
```bash
# Deploy to Vercel staging
vercel --env=preview
```

1. Test all authentication flows
2. Test admin functionality
3. Verify emails are delivered
4. Check logs for errors

### Step 2: Update Production Environment Variables
In Vercel Dashboard:
1. Go to: **Project Settings > Environment Variables**
2. Add/Update:
   ```
   NEXT_PUBLIC_SUPABASE_URL (Production value)
   NEXT_PUBLIC_SUPABASE_ANON_KEY (Production value)
   SUPABASE_SERVICE_ROLE_KEY (Production value)
   GOOGLE_CLIENT_ID (if using OAuth)
   GOOGLE_CLIENT_SECRET (if using OAuth)
   AZURE_AD_CLIENT_ID (if using OAuth)
   AZURE_AD_CLIENT_SECRET (if using OAuth)
   ```

### Step 3: Deploy to Production
```bash
# Deploy to production
vercel --prod
```

### Step 4: Create Admin User in Production
Repeat **Section 4** (Create Admin User) using production Supabase Dashboard.

### Step 5: Monitor Deployment
1. **Check logs**: Vercel Dashboard > Deployments > [Latest] > Logs
2. **Test authentication**: Sign in with admin account
3. **Monitor errors**: Vercel Dashboard > Analytics > Errors
4. **Check Supabase logs**: Supabase Dashboard > Logs

---

## 9. Post-Deployment

### Immediate (Day 1)
- [ ] Test all authentication flows in production
- [ ] Verify admin access works
- [ ] Check email delivery (signup, reset password)
- [ ] Monitor error logs for auth issues
- [ ] Test OAuth flows (Google, Azure)

### Short-term (Week 1)
- [ ] Monitor failed login attempts
- [ ] Check for any RLS policy violations in logs
- [ ] Verify credit system working correctly
- [ ] Collect user feedback on new auth flow
- [ ] Fix any reported issues

### Medium-term (Month 1)
- [ ] Review authentication analytics
- [ ] Check session metrics (duration, devices)
- [ ] Assess OAuth adoption rate
- [ ] Plan for additional security features (MFA, etc.)
- [ ] Remove old password column (after all users migrated)

---

## 10. Rollback Plan

If critical issues occur, rollback with these steps:

### Step 1: Revert Code
```bash
# Revert to previous deployment
git revert [commit_hash]
vercel --prod
```

### Step 2: Rollback Database (if needed)
```sql
-- Run rollback script from migration file
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_email_verified();
DROP FUNCTION IF EXISTS public.get_user_profile(UUID);
DROP FUNCTION IF EXISTS public.update_last_sign_in(UUID);
ALTER TABLE users DROP COLUMN IF EXISTS auth_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users DROP COLUMN IF EXISTS provider;
ALTER TABLE users DROP COLUMN IF EXISTS last_sign_in_at;
```

### Step 3: Restore Environment Variables
Restore old NextAuth environment variables in Vercel.

### Step 4: Communicate
Email users about the temporary issue and expected resolution time.

---

## 11. Support & Troubleshooting

### Common Issues

**Issue**: User can't verify email
- Check Supabase email templates are configured
- Verify redirect URLs in Supabase settings
- Check spam folder
- Resend verification email

**Issue**: OAuth redirect fails
- Verify OAuth credentials in Supabase
- Check redirect URIs in Google/Azure console
- Ensure Supabase callback URL is whitelisted

**Issue**: Admin can't access /admin
- Verify `role` in public.users is 'admin'
- Check middleware admin role check
- Verify session includes role field

**Issue**: Credits not awarded on signup
- Check trigger function logs in Supabase
- Verify trigger is enabled
- Check credit_transactions table for entries

### Getting Help
- **Supabase Docs**: https://supabase.com/docs/guides/auth
- **Supabase Discord**: https://discord.supabase.com/
- **Security Review**: See [SECURITY_REVIEW.md](SECURITY_REVIEW.md)

---

## 12. Success Metrics

Track these metrics to measure migration success:

### Technical Metrics
- Auth API response time < 500ms (p95)
- Session refresh success rate > 99%
- Email delivery rate > 95%
- OAuth success rate > 90%
- Zero RLS policy violations

### User Metrics
- User signup completion rate > 80%
- Email verification rate > 70%
- OAuth adoption rate (target: 30%)
- Support tickets related to auth (target: < 5%)
- User satisfaction with new auth (target: > 4/5)

---

## Summary

### ✅ Ready to Deploy
All code changes are complete. Next steps:
1. Install packages
2. Configure Supabase Dashboard
3. Run migration
4. Create admin user
5. Test thoroughly
6. Deploy to production

### 📋 Quick Reference
- **Security Review**: [SECURITY_REVIEW.md](SECURITY_REVIEW.md)
- **Migration SQL**: [supabase/migrations/012_supabase_auth_integration.sql](supabase/migrations/012_supabase_auth_integration.sql)
- **Auth Helpers**: [src/lib/auth-helpers.ts](src/lib/auth-helpers.ts)
- **Use Auth Hook**: [src/hooks/useAuth.ts](src/hooks/useAuth.ts)

### 🔐 Security Notes
- Never commit `SUPABASE_SERVICE_ROLE_KEY` to git
- Use strong passwords for admin accounts
- Enable MFA for admin accounts (post-launch)
- Monitor authentication logs regularly
- Review and update security settings quarterly

---

**Deployment Owner**: [Your Name]
**Expected Duration**: 2-4 hours (including testing)
**Risk Level**: Medium (auth is critical, but rollback plan exists)
**User Impact**: Minimal (users need to reset password once)

Good luck with your deployment! 🚀
