# RExeli V1 Production Instructions

## 🎯 Quick Start Guide

### Current Status
- **✅ Deployed:** https://rexeli-v1.vercel.app
- **✅ Domain:** rexeli.com (configured)
- **✅ Environment:** All variables set
- **✅ Database:** Supabase operational
- **✅ AI:** OpenAI integration active

### Immediate Access
1. **Main Application:** https://rexeli-v1.vercel.app
2. **Custom Domain:** https://rexeli.com (once DNS propagated)
3. **Test Page:** Open `test_production_simple.html` in browser for manual testing

---

## 🚀 Making Application Public

### Remove Deployment Protection
1. Go to [Vercel Dashboard](https://vercel.com/camiloruizjs-projects/rexeli-v1)
2. Navigate to **Settings** → **Deployment Protection**
3. Turn off **Protection Bypass for Automation**
4. Save changes

### DNS Configuration (if needed)
If rexeli.com is not working, update DNS:
```
Type: CNAME
Name: @ (or www)
Value: rexeli-v1.vercel.app
TTL: 300
```

---

## 🧪 Testing Instructions

### Automated Testing
```bash
cd "C:\Users\cruiz\RExeli-V1"
node production_test.js
```

### Manual Testing
1. Open `test_production_simple.html` in browser
2. Click "Run All Tests" button
3. Verify all tests pass with green status

### Real Document Testing
1. Go to https://rexeli-v1.vercel.app
2. Upload a PDF real estate document
3. Verify AI classification works
4. Check data extraction results
5. Test Excel export functionality

---

## 📊 Monitoring & Maintenance

### Vercel Dashboard Monitoring
- **Deployments:** https://vercel.com/camiloruizjs-projects/rexeli-v1
- **Analytics:** Monitor usage and performance
- **Functions:** Check API endpoint logs
- **Domains:** Verify domain configuration

### Supabase Monitoring
- **Database:** https://app.supabase.com/project/lddwbkefiucimrkfskzt
- **Storage:** Monitor file uploads and storage usage
- **Auth:** Check authentication logs (if implemented)

---

## 🔧 Configuration Reference

### Environment Variables (Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://lddwbkefiucimrkfskzt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[584 characters - configured]
OPENAI_API_KEY=[164 characters - configured]
```

### Supabase Storage
- **Bucket:** documents
- **Access:** Public read
- **File Types:** PDF, JPEG, PNG
- **Max Size:** 25MB

### OpenAI Configuration
- **Model:** gpt-4o-mini
- **Usage:** Document classification and extraction
- **Rate Limits:** Standard OpenAI limits apply

---

## 🚨 Troubleshooting

### Common Issues

#### 1. API Endpoints Returning 500 Errors
**Cause:** Environment variables not loaded
**Solution:** 
- Verify variables in Vercel dashboard
- Redeploy with `npx vercel --prod --force`

#### 2. File Upload Failing
**Cause:** Supabase bucket permissions
**Solution:**
- Check bucket exists: Run `node verify_supabase.js`
- Verify bucket is public in Supabase dashboard

#### 3. AI Processing Not Working
**Cause:** OpenAI API key issues
**Solution:**
- Verify API key has sufficient credits
- Check key validity in OpenAI dashboard

#### 4. Domain Not Resolving
**Cause:** DNS propagation delay
**Solution:**
- Wait up to 24-48 hours for global DNS propagation
- Use direct Vercel URL in meantime

---

## 🔄 Redeployment Process

### Quick Redeploy
```bash
cd "C:\Users\cruiz\RExeli-V1"
npx vercel --prod
```

### Full Redeploy (if needed)
```bash
cd "C:\Users\cruiz\RExeli-V1"
npx vercel --prod --force
```

### Update Environment Variables
```bash
npx vercel env add VARIABLE_NAME production
# Enter value when prompted
npx vercel --prod --force  # Redeploy with new variables
```

---

## 📈 Performance Optimization

### Current Metrics
- **Load Time:** ~76ms (Excellent)
- **Bundle Size:** ~147kB
- **API Response:** <2s typical
- **Uptime:** 99.9% (Vercel SLA)

### Optimization Tips
1. **Images:** Use Next.js Image component
2. **Caching:** Enable aggressive caching for static assets
3. **API:** Implement request caching where appropriate
4. **Monitoring:** Set up Vercel Analytics for detailed insights

---

## 📱 Mobile Testing

### Test on Different Devices
1. **iPhone/Safari:** Verify touch interactions
2. **Android/Chrome:** Check responsive layout
3. **iPad/Tablet:** Test file upload flow
4. **Desktop:** Verify full functionality

### Mobile-Specific Issues
- File upload picker behavior
- Touch-friendly button sizes
- Responsive table layouts
- Loading state indicators

---

## 💾 Backup & Recovery

### Configuration Backup
- **Environment Variables:** Documented in this file
- **Supabase Schema:** Stored in project backup
- **Code Repository:** Version controlled
- **Deployment Config:** `vercel.json` in project

### Recovery Process
1. Restore from Git repository
2. Set environment variables in Vercel
3. Verify Supabase configuration
4. Redeploy to production

---

## 📞 Support Contacts

### Service Providers
- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **OpenAI Support:** https://platform.openai.com/help

### Documentation
- **Next.js Docs:** https://nextjs.org/docs
- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs

---

## ✅ Production Checklist

### Pre-Launch
- [x] Environment variables configured
- [x] Database and storage operational
- [x] AI integration verified
- [x] Performance tested
- [x] Security headers configured
- [x] Error handling implemented
- [x] Mobile responsiveness verified

### Post-Launch (Immediate)
- [ ] Remove deployment protection
- [ ] Test with real documents
- [ ] Monitor for errors
- [ ] Verify domain propagation

### Post-Launch (48 hours)
- [ ] Check analytics data
- [ ] Review performance metrics
- [ ] Address any user feedback
- [ ] Optimize based on usage patterns

---

**Last Updated:** August 28, 2025  
**Status:** Production Ready  
**Next Review:** 7 days post-launch