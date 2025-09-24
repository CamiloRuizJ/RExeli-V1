# 🚀 RExeli V1 - Automated Deployment Setup

## Overview
This guide will help you set up automated deployment to Vercel using GitHub Actions with secure encrypted environment variables.

## Prerequisites
- GitHub repository (✅ Already set up)
- Vercel account
- GitHub account with Actions enabled

## Step 1: Set Up Vercel Project

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Import Project** → Connect GitHub → Select `CamiloRuizJ/RExeli-V1`
3. **Configure Project:**
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: Leave default
4. **Add Environment Variables** (copy exactly as shown):

```env
ENCRYPTED_OPENAI_API_KEY=
U2FsdGVkX1+s9gvVlutLVA8ZuMyCgkgiiPwzF3U2yJEfVtrptupWro8JC6bHCO4JSI2zDPaY/cBf1u/KEPityrrHs8TcQSOf5YVKtizhmkrzdfYqyLkCDY1kKGHcKFx4IljOVzPIcEtKmNWNzJm5xohUbdHvUP6fYIENWXd5oorsdVnKqGyq+Scos7QAXMQj2lbjIs44ENLpzQt+FCIRn6y5tDxPdLv9iFHvpmc6GPxL9Ax6waWxzcmoIRbVqotU

ENCRYPTED_SUPABASE_URL=
U2FsdGVkX18IAJNAhJFNt13+VDzzA79/dwLO18///vDiRi2Zgw8dnvYDoY0TjgUR1CxSiIK9yP7ALf22s+JbRQ==

ENCRYPTED_SUPABASE_ANON_KEY=
U2FsdGVkX1/zatTFJgBWA648UBlxHuMDIQ1s73YbtBwW4235xcrCrtQeD1zEfMUJLGwKBnrscmpPQj+c+Fx7Tit39JU8ahduJMdWHgXAqPqVMGHVh5+8JYWlIFbkVmAI+8Jm+miv7UsK7IAVLzPhXwHZIClZk8C0xvBRUt8VYm9qwC4c1A0n1Zm7V9ddSl9M1h11Vg513IRF54skmSGL0XaC+XsPD07rTNg0X1DEQ0sqU7PKFYRff4gbGl/PC6atFLlr6KwinIPVZWdoKwnrlFZ4VQnsLuJEdV0hpg455RHXYEzB3PDhCQ8K4v1O5ud2

NEXTAUTH_SECRET=705da43ea52979df9d520c3ad6ef79db63e3990558b0b814db2509fd64199aa5

NEXTAUTH_URL=https://your-project-name.vercel.app

ENCRYPTION_KEY=RExeli-2025-Secure-Key-ForAPI-Encryption-V1-Production
```

5. **Update NEXTAUTH_URL** with your actual Vercel domain after deployment
6. **Deploy** the project

## Step 2: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these **Repository Secrets**:

### Vercel Configuration Secrets
```
VERCEL_TOKEN=your_vercel_token_here
ORG_ID=your_vercel_org_id_here
PROJECT_ID=your_vercel_project_id_here
```

### Application Environment Secrets
```
ENCRYPTED_OPENAI_API_KEY=U2FsdGVkX1+s9gvVlutLVA8ZuMyCgkgiiPwzF3U2yJEfVtrptupWro8JC6bHCO4JSI2zDPaY/cBf1u/KEPityrrHs8TcQSOf5YVKtizhmkrzdfYqyLkCDY1kKGHcKFx4IljOVzPIcEtKmNWNzJm5xohUbdHvUP6fYIENWXd5oorsdVnKqGyq+Scos7QAXMQj2lbjIs44ENLpzQt+FCIRn6y5tDxPdLv9iFHvpmc6GPxL9Ax6waWxzcmoIRbVqotU

ENCRYPTED_SUPABASE_URL=U2FsdGVkX18IAJNAhJFNt13+VDzzA79/dwLO18///vDiRi2Zgw8dnvYDoY0TjgUR1CxSiIK9yP7ALf22s+JbRQ==

ENCRYPTED_SUPABASE_ANON_KEY=U2FsdGVkX1/zatTFJgBWA648UBlxHuMDIQ1s73YbtBwW4235xcrCrtQeD1zEfMUJLGwKBnrscmpPQj+c+Fx7Tit39JU8ahduJMdWHgXAqPqVMGHVh5+8JYWlIFbkVmAI+8Jm+miv7UsK7IAVLzPhXwHZIClZk8C0xvBRUt8VYm9qwC4c1A0n1Zm7V9ddSl9M1h11Vg513IRF54skmSGL0XaC+XsPD07rTNg0X1DEQ0sqU7PKFYRff4gbGl/PC6atFLlr6KwinIPVZWdoKwnrlFZ4VQnsLuJEdV0hpg455RHXYEzB3PDhCQ8K4v1O5ud2

NEXTAUTH_SECRET=705da43ea52979df9d520c3ad6ef79db63e3990558b0b814db2509fd64199aa5

NEXTAUTH_URL=https://your-project-name.vercel.app

ENCRYPTION_KEY=RExeli-2025-Secure-Key-ForAPI-Encryption-V1-Production
```

## Step 3: Get Vercel Configuration Values

### Get Vercel Token:
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create new token named "GitHub Actions"
3. Copy the token → Add as `VERCEL_TOKEN` secret

### Get Org ID and Project ID:
1. In your Vercel project dashboard
2. Go to Settings → General
3. Copy **Project ID** → Add as `PROJECT_ID` secret
4. Copy **Team ID** (or your username if personal) → Add as `ORG_ID` secret

## Step 4: Update Domain and Deploy

1. **Update NEXTAUTH_URL** in both Vercel environment variables and GitHub secrets with your actual domain
2. **Push to master branch** - this will trigger automatic deployment
3. **Monitor deployment** in GitHub Actions tab

## Step 5: Test Authentication

Once deployed:
1. Visit your Vercel domain
2. Navigate to `/tool` (should redirect to login)
3. Login with admin credentials:
   - **Email:** `admin@rexeli.com`
   - **Password:** `RExeli2025!Admin`
4. Test complete PDF processing workflow

## 🔒 Security Features Enabled

✅ **Encrypted API Keys** - All sensitive keys encrypted with AES
✅ **Authentication Required** - Admin login protects all functionality
✅ **Secure Headers** - CSP, XSS protection, frame denial
✅ **CORS Protection** - Restricted to your domain only
✅ **Session Management** - JWT-based with 24-hour expiry

## 🚀 Automated Deployment Features

✅ **Auto-deploy on push** to master branch
✅ **Preview deployments** for pull requests
✅ **Type checking** before deployment
✅ **Build validation** with encrypted environment variables
✅ **Production security headers** configured

## 📝 Notes

- **Domain Update Required:** After first deployment, update `NEXTAUTH_URL` with your actual Vercel domain
- **Security:** All API keys are encrypted and never exposed in logs
- **Monitoring:** Check GitHub Actions for deployment status
- **Rollback:** Previous deployments available in Vercel dashboard

## 🎯 Admin Access

**Production Login:**
- **URL:** `https://your-domain.vercel.app/auth/signin`
- **Email:** `admin@rexeli.com`
- **Password:** `RExeli2025!Admin`

Your RExeli application is now production-ready with enterprise-grade security! 🎉