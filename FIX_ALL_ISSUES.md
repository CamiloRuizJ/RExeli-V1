# Fix All Supabase Issues - Simple Guide

## What This Fixes

✅ All RLS performance warnings (wraps `auth` functions in `SELECT`)
✅ All multiple permissive policies warnings (removes duplicate policies)
✅ Admin user creation error (trigger now uses UPSERT)
✅ Creates admin@rexeli.com if it doesn't exist

---

## Step 1: Run the Migration (2 min)

Go to Supabase SQL Editor:
**https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/sql/new**

Copy the entire contents of:
**`supabase/migrations/013_fix_security_warnings_and_admin.sql`**

Paste and click **Run**

✅ You should see: "✅ Admin user exists in public.users"

---

## Step 2: Create Admin in Auth (2 min)

Go to Auth Users:
**https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/auth/users**

Click **"Add user"**

Fill in:
- Email: `admin@rexeli.com`
- Password: `RExeli@Admin2024!Secure`
- Auto Confirm: ✅ YES
- User Metadata: `{"name":"RExeli Administrator"}`
- App Metadata: `{"role":"admin","provider":"email"}`

Click **"Create user"**

**This will now work!** The trigger will link it to the existing admin in public.users.

---

## Step 3: Test Login (1 min)

Go to: **https://rexeli.vercel.app/auth/signin**

Login with:
- Email: `admin@rexeli.com`
- Password: `RExeli@Admin2024!Secure`

✅ Should work and redirect to dashboard
✅ Try admin panel: https://rexeli.vercel.app/admin

---

## What Changed

### Fixed Trigger
- Now uses `UPSERT` logic
- If user exists in public.users, it just links the auth_user_id
- If user doesn't exist, it creates them
- **No more "Database error creating new user"**

### Fixed RLS Policies
- All `auth.uid()` calls now wrapped in `(SELECT auth.uid())`
- Prevents re-evaluation for each row
- **All RLS performance warnings gone**

### Fixed Duplicate Policies
- Removed redundant service_role policies
- Service role bypasses RLS anyway
- **All multiple permissive policies warnings gone**

---

## Verification

After running the migration, check the linter:
**https://supabase.com/dashboard/project/lddwbkefiucimrkfskzt/database/lint**

✅ Should show 0 warnings

---

**Total Time: ~5 minutes**
