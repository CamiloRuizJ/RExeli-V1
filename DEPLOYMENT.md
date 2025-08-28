# RExeli V1 Deployment Guide

This guide provides step-by-step instructions for deploying RExeli V1 to production environments.

## 🚀 Vercel Deployment (Recommended)

### Prerequisites
- GitHub/GitLab repository with your code
- Vercel account (free tier available)
- Supabase project set up
- OpenAI API key

### Step 1: Prepare Your Repository

1. **Push your code to GitHub**
```bash
git add .
git commit -m "Initial RExeli V1 implementation"
git push origin main
```

2. **Verify environment variables**
Ensure `.env.example` is in your repository but `.env.local` is in `.gitignore`.

### Step 2: Connect to Vercel

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with GitHub/GitLab

2. **Import Project**
   - Click "New Project"
   - Select your RExeli repository
   - Click "Import"

3. **Configure Project Settings**
   - Project Name: `rexeli-v1` or `rexeli-production`
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./` (default)
   - Build and Output Settings: Use defaults

### Step 3: Environment Variables

In the Vercel project settings, add these environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key

# OpenAI Configuration
OPENAI_API_KEY=sk-...your-openai-key

# Next.js Configuration (Optional)
NEXTAUTH_SECRET=your-random-secret-string
NEXTAUTH_URL=https://your-domain.vercel.app

# Application Configuration
NEXT_PUBLIC_APP_NAME=RExeli V1
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_MAX_FILE_SIZE=26214400
```

### Step 4: Deploy

1. **Initial Deployment**
   - Click "Deploy" in Vercel dashboard
   - Wait for build to complete (~2-3 minutes)

2. **Verify Deployment**
   - Visit your deployed URL
   - Test file upload functionality
   - Verify Supabase connection
   - Test AI processing

### Step 5: Custom Domain (Optional)

1. **Add Domain**
   - Go to Project Settings → Domains
   - Add your custom domain (e.g., `rexeli.com`)
   - Configure DNS settings as instructed

2. **SSL Certificate**
   - Vercel automatically provisions SSL
   - Verify HTTPS is working

## 🔧 Environment Configuration

### Supabase Setup for Production

1. **Storage Bucket Configuration**
```sql
-- Create documents bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true);

-- Set up RLS policies
CREATE POLICY "Public upload access" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Public download access" 
ON storage.objects FOR SELECT 
TO PUBLIC;
```

2. **CORS Configuration**
Add your Vercel domain to Supabase CORS settings:
```
https://your-domain.vercel.app
https://rexeli.com (if using custom domain)
```

### OpenAI API Considerations

1. **Usage Limits**
   - Monitor your OpenAI usage
   - Set up billing alerts
   - Consider usage limits for production

2. **Rate Limiting**
   - Implement client-side rate limiting
   - Add request queuing for high traffic

## 🔒 Security Checklist

- [ ] API keys are server-side only (no `NEXT_PUBLIC_` prefix)
- [ ] Supabase RLS policies are configured
- [ ] File upload validation is implemented
- [ ] CORS is properly configured
- [ ] HTTPS is enabled
- [ ] Error messages don't expose sensitive information

## 📊 Performance Optimization

### Next.js Configuration

1. **Update `next.config.ts`**
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp']
  },
  images: {
    domains: ['your-supabase-domain.supabase.co']
  },
  // Enable compression
  compress: true,
  // Optimize builds
  swcMinify: true
}

export default nextConfig;
```

2. **Add Vercel Analytics (Optional)**
```bash
npm install @vercel/analytics
```

Add to your layout.tsx:
```typescript
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Monitoring Setup

1. **Vercel Analytics**
   - Enable in project settings
   - Monitor Core Web Vitals
   - Track user interactions

2. **Error Tracking**
```bash
npm install @sentry/nextjs
```

3. **Uptime Monitoring**
   - Use Vercel's built-in monitoring
   - Or integrate with external services

## 🚨 Troubleshooting

### Common Deployment Issues

1. **Build Failures**
```bash
# Check for TypeScript errors locally
npm run type-check

# Fix linting issues
npm run lint:fix
```

2. **API Route Errors**
   - Verify environment variables are set
   - Check Vercel function logs
   - Ensure API routes are in correct directories

3. **File Upload Issues**
   - Verify Supabase bucket exists and is public
   - Check CORS configuration
   - Validate file size limits

4. **OpenAI API Errors**
   - Verify API key is valid
   - Check usage limits and billing
   - Test with smaller files first

### Debug Commands

```bash
# Local debugging
npm run dev
npm run build
npm run type-check

# Vercel CLI debugging
vercel logs
vercel env ls
vercel domains ls
```

## 🔄 CI/CD Pipeline

### Automatic Deployments

1. **Connect GitHub**
   - Vercel automatically deploys on push to main
   - Preview deployments for pull requests

2. **Branch Protection**
```bash
# Set up branch protection rules
# Require status checks
# Require up-to-date branches
```

3. **Custom Build Commands** (if needed)
```json
{
  "scripts": {
    "vercel-build": "npm run type-check && npm run build"
  }
}
```

## 📈 Scaling Considerations

### Traffic Growth

1. **Vercel Pro Plan**
   - Higher bandwidth limits
   - Enhanced analytics
   - Priority support

2. **Supabase Scaling**
   - Monitor storage usage
   - Consider Pro plan for higher limits
   - Set up database connection pooling

3. **OpenAI Usage**
   - Implement caching for repeated requests
   - Consider batch processing
   - Monitor token usage

### Performance Monitoring

1. **Key Metrics**
   - Page load times
   - API response times
   - File upload success rates
   - User engagement

2. **Alerts Setup**
   - High error rates
   - Slow response times
   - Storage quota limits
   - API usage limits

## 🎯 Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Supabase bucket and policies set up
- [ ] OpenAI API tested and working
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate verified
- [ ] Error tracking implemented
- [ ] Analytics set up
- [ ] Performance optimizations applied
- [ ] Security measures verified
- [ ] Backup strategy in place
- [ ] Monitoring and alerts configured

## 🆘 Support

If you encounter issues during deployment:

1. Check the [Vercel documentation](https://vercel.com/docs)
2. Review [Next.js deployment guide](https://nextjs.org/docs/deployment)
3. Check our [GitHub issues](https://github.com/rexeli/rexeli-v1/issues)
4. Contact support: support@rexeli.com

---

**Happy Deploying!** 🚀