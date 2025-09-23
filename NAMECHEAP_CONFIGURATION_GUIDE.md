# 🚀 Namecheap Domain Configuration for SichrPlace

## Current Status
- **Domain Owned**: sichrplace.com (via Namecheap)
- **Netlify Site**: sichrplace.netlify.app (Live ✅)
- **Target Domain**: www.sichrplace.com

## Step-by-Step Namecheap Configuration

### 1. Access Namecheap DNS Management
1. Login to [namecheap.com](https://namecheap.com)
2. Go to **Domain List** → **sichrplace.com** → **Manage**
3. Click **Advanced DNS** tab

### 2. Delete Current Records
Remove these existing records:
- Any URL Redirect records
- Any CNAME records pointing to parking pages
- Any A records pointing to Namecheap IPs

### 3. Add New DNS Records

#### Method 1: CNAME Configuration (Recommended)
```
Type: A Record
Host: @
Value: 75.2.60.5
TTL: Automatic (or 5 min)
```

```
Type: CNAME
Host: www
Value: sichrplace.netlify.app
TTL: Automatic (or 5 min)
```

#### Method 2: Netlify DNS (Alternative)
Change nameservers to:
- dns1.netlify.com
- dns2.netlify.com  
- dns3.netlify.com
- dns4.netlify.com

### 4. Netlify Domain Setup
After DNS changes, add domain in Netlify:

1. Go to [app.netlify.com](https://app.netlify.com)
2. Select your **sichrplace** site
3. Go to **Site settings** → **Domain management**
4. Click **Add custom domain**
5. Enter: `www.sichrplace.com`
6. Also add: `sichrplace.com` (for redirect)

### 5. SSL Certificate
- Netlify will automatically provision SSL certificate
- Wait 24-48 hours for full propagation
- Enable HTTPS redirect in Netlify settings

## Verification Commands
After configuration, test with:
```bash
nslookup www.sichrplace.com
nslookup sichrplace.com
curl -I https://www.sichrplace.com
```

## Expected Results
- `sichrplace.com` → redirects to `https://www.sichrplace.com`
- `www.sichrplace.com` → serves your SichrPlace platform
- SSL certificate active
- All 104 Netlify functions working on custom domain

## Troubleshooting
- **DNS propagation**: Takes 24-48 hours globally
- **SSL pending**: Normal, auto-provisions after DNS resolves
- **Functions not working**: Check Netlify function settings for custom domain

## Success Criteria ✅
- [ ] DNS records updated in Namecheap
- [ ] Custom domain added in Netlify
- [ ] SSL certificate provisioned
- [ ] www.sichrplace.com loads your platform
- [ ] All APIs work on custom domain
- [ ] Redirects properly configured