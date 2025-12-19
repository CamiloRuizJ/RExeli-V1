# 🚀 Production Deployment - Quick Start Guide

**Status**: ✅ Code committed and ready to deploy
**Commit**: `1b42823` - Migrate from NextAuth to Supabase Auth

---

## ⚠️ CRITICAL: Complete These Steps BEFORE Deploying

### 1️⃣ Install Required Packages (5 minutes)

You need to install packages locally first to ensure they're in `package.json`:

```bash
npm install @supabase/ssr @supabase/auth-helpers-nextjs
```

After installing, commit the package.json changes:
```bash
git add package.json package-lock.json
git commit -m "chore: Add Supabase Auth packages"
```

### 2️⃣ Configure Supabase Dashboard (15-20 minutes)

**CRITICAL**: Must be done BEFORE deploying code.

#### A. Enable Email Provider
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/providers
2. Click **Email** provider
3. ✅ Enable **Confirm email** (required for new signups)
4. ✅ Enable **Secure email change**
5. Set **Email OTP expiry**: `3600` (1 hour)
6. Click **Save**

#### B. Configure Site URLs
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/url-configuration
2. **Site URL**: `https://rexeli.vercel.app` (or your domain)
3. **Redirect URLs** - Add these (one per line):
   ```
   https://rexeli.vercel.app/auth/callback
   https://rexeli.vercel.app/auth/reset-password
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/reset-password
   ```
4. Click **Save**

#### C. Customize Email Templates (Optional but Recommended)
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/templates
2. Edit **Confirm signup** template:
   - Add your branding
   - Mention 25 free trial credits
3. Edit **Reset password** template:
   - Add your branding
4. Click **Save** for each

#### D. Configure Rate Limits (Recommended)
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/rate-limits
2. Set reasonable limits:
   - Email signups: 5 per hour per IP
   - Email signins: 10 per hour per IP
   - Password recovery: 5 per hour per email
3. Click **Save**

### 3️⃣ Run Database Migration (5 minutes)

**CRITICAL**: Run migrations 011 and 012 BEFORE deploying.

1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/sql/new
2. **First**, run migration 011 (security fixes):
   - Open: `supabase/migrations/011_fix_security_warnings.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run** (bottom right)
   - Verify: "Success. No rows returned"

3. **Then**, run migration 012 (Supabase Auth):
   - Open: `supabase/migrations/012_supabase_auth_integration.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**
   - Verify: "Success. No rows returned"

4. **Verify migrations** - Run this query:
   ```sql
   -- Check if columns exist
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'users'
     AND column_name IN ('auth_user_id', 'email_verified', 'provider');

   -- Should return 3 rows
   ```

### 4️⃣ Create Admin User (10 minutes)

**CRITICAL**: Create admin AFTER running migrations.

#### A. Create in Supabase Auth
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/users
2. Click **Add user** (top right)
3. Fill in:
   - **Email**: `admin@rexeli.com`
   - **Password**: [Generate strong password - SAVE IT SECURELY]
   - **Auto Confirm User**: ✅ YES
   - **User Metadata** (click "Add metadata"):
     ```json
     {
       "name": "RExeli Administrator"
     }
     ```
   - **App Metadata** (click "Add metadata"):
     ```json
     {
       "role": "admin",
       "provider": "email"
     }
     ```
4. Click **Create user**
5. **COPY THE UUID** from the user row (you'll need it next)

#### B. Link to Public User
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/sql/new
2. Replace `[AUTH_USER_UUID]` with the UUID you copied:
   ```sql
   UPDATE public.users
   SET
     auth_user_id = '[AUTH_USER_UUID]',
     role = 'admin',
     email_verified = true,
     provider = 'email',
     updated_at = NOW()
   WHERE email = 'admin@rexeli.com';

   -- Verify
   SELECT id, email, name, role, auth_user_id, email_verified
   FROM public.users
   WHERE email = 'admin@rexeli.com';
   ```
3. Click **Run**
4. Verify the SELECT returns your admin user with `auth_user_id` set

### 5️⃣ Verify Environment Variables (2 minutes)

Check these are set in Vercel:

1. Go to: https://vercel.com/your-team/rexeli/settings/environment-variables
2. Verify these exist (Production):
   ```
   ✅ NEXT_PUBLIC_SUPABASE_URL
   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
   ✅ SUPABASE_SERVICE_ROLE_KEY
   ```
3. **Remove these** (no longer needed):
   ```
   ❌ NEXTAUTH_URL
   ❌ NEXTAUTH_SECRET
   ```

---

## 🚀 Deploy to Production

### Option A: Deploy via Git Push (Recommended)

```bash
# Push to GitHub/GitLab (triggers Vercel auto-deploy)
git push origin master
```

Vercel will automatically:
1. Detect the push
2. Install packages (including new Supabase packages)
3. Build the project
4. Deploy to production

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Deploy to production
vercel --prod
```

---

## ✅ Post-Deployment Verification (15 minutes)

### Immediate Tests (Do these RIGHT AFTER deploy)

#### 1. Test Basic Auth
1. Go to: `https://your-domain.com/auth/signin`
2. Try to sign in with admin account
3. **Expected**: Redirected to `/tool` or `/dashboard`

#### 2. Test Admin Access
1. While signed in as admin, go to: `https://your-domain.com/admin`
2. **Expected**: Can access admin dashboard
3. Try viewing users, analytics

#### 3. Test Email Signup (New User)
1. Sign out
2. Go to: `https://your-domain.com/auth/signup`
3. Create test account with your email
4. **Expected**:
   - Redirected to email verification page
   - Receive verification email
   - Click link in email
   - Can sign in after verification

#### 4. Test Password Reset
1. Go to: `https://your-domain.com/auth/reset-password`
2. Enter your email
3. **Expected**:
   - Receive password reset email
   - Click link works
   - Can set new password

#### 5. Test Credit System
1. Sign in as regular user
2. Upload and process a document
3. **Expected**:
   - Credits deducted
   - Document processed successfully

### Monitor for Issues

#### Check Vercel Logs
1. Go to: https://vercel.com/your-team/rexeli/logs
2. Look for errors in last 5 minutes
3. Filter by "error" level
4. **Common issues to look for**:
   - `getSession is not defined` → Missing import
   - `Cannot read properties of undefined` → Session structure issue
   - `401 Unauthorized` → Auth not working
   - `RLS policy violation` → Database permissions issue

#### Check Supabase Logs
1. Go to: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/logs/explorer
2. Filter by:
   - Status: Error (500, 401, 403)
   - Time: Last 15 minutes
3. **Look for**:
   - Failed auth attempts
   - RLS policy violations
   - Trigger function errors

---

## 🐛 Troubleshooting

### Issue: "getSession is not defined"
**Fix**: Missing import in API route
```typescript
import { getSession } from '@/lib/auth-helpers'
```

### Issue: Admin can't access /admin
**Fix**: Check admin role in database
```sql
SELECT id, email, role, auth_user_id
FROM public.users
WHERE email = 'admin@rexeli.com';
-- Verify role = 'admin' and auth_user_id is set
```

### Issue: Email verification not working
**Fixes**:
1. Check Supabase email templates are saved
2. Verify redirect URLs include your domain
3. Check spam folder
4. Try resending verification email

### Issue: OAuth buttons don't work
**Note**: OAuth is configured but providers aren't set up yet. This is expected.
To enable:
1. Set up Google OAuth (see SUPABASE_AUTH_DEPLOYMENT.md Section 2, Step 4)
2. Set up Azure OAuth (see SUPABASE_AUTH_DEPLOYMENT.md Section 2, Step 5)

### Issue: Credits not awarded on signup
**Fix**: Check trigger function
```sql
-- Verify trigger exists
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Test manually for a user
SELECT * FROM credit_transactions
WHERE description LIKE '%signup%'
ORDER BY timestamp DESC
LIMIT 5;
```

---

## 🔄 Rollback Plan (If Things Go Wrong)

### Immediate Rollback
If critical issues occur:

```bash
# Option 1: Revert commit and redeploy
git revert 1b42823
git push origin master

# Option 2: Redeploy previous commit via Vercel
# Go to Vercel Dashboard > Deployments
# Find previous working deployment
# Click "..." menu > "Redeploy"
```

### Rollback Database (if needed)
Only if auth completely broken:
```sql
-- Run in Supabase SQL Editor
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_email_verified();
```

---

## 📊 Success Criteria

✅ Deployment successful if:
- Admin can sign in and access /admin
- New users can sign up and receive verification email
- Password reset works end-to-end
- Credits are awarded on signup (25 credits)
- Document processing still works
- No 401/403 errors in logs
- API routes return proper responses

---

## 🎯 Next Steps (After Successful Deploy)

### Day 1
- [ ] Monitor logs for auth errors
- [ ] Test all critical user flows
- [ ] Have admin credentials accessible for support

### Week 1
- [ ] Set up OAuth providers (Google, Azure) - optional
- [ ] Send email to existing users about password reset (if migrating)
- [ ] Monitor signup completion rates
- [ ] Collect user feedback

### Month 1
- [ ] Remove old `password` column from users table
- [ ] Uninstall NextAuth packages
- [ ] Enable MFA for admin accounts
- [ ] Review authentication analytics

---

## 📞 Support

If you encounter issues:

1. **Check logs first**:
   - Vercel: https://vercel.com/your-team/rexeli/logs
   - Supabase: https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/logs

2. **Review documentation**:
   - [SECURITY_REVIEW.md](SECURITY_REVIEW.md) - Security analysis
   - [SUPABASE_AUTH_DEPLOYMENT.md](SUPABASE_AUTH_DEPLOYMENT.md) - Full guide

3. **Common fixes**:
   - Clear browser cache and cookies
   - Check environment variables are set
   - Verify migrations ran successfully
   - Confirm admin user created correctly

---

## ✅ Deployment Checklist

Before you click deploy, confirm:

- [x] Code committed to git (commit 1b42823)
- [ ] Packages installed (`@supabase/ssr`, `@supabase/auth-helpers-nextjs`)
- [ ] Supabase email provider enabled with verification
- [ ] Supabase redirect URLs configured
- [ ] Database migrations 011 & 012 executed successfully
- [ ] Admin user created and linked
- [ ] Environment variables verified in Vercel
- [ ] Removed old NextAuth environment variables

**Once all checked, you're ready to deploy!** 🚀

---

**Estimated Deployment Time**: 1-2 hours (including testing)
**Risk Level**: Low (code reviewed, rollback plan ready)
**User Impact**: Minimal (existing sessions may need to re-login)

Good luck! 🍀
