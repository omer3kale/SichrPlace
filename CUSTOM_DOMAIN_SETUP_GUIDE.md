# 🌐 Custom Domain Setup Guide: www.sichrplace.com

## 📋 **DOMAIN ACQUISITION & SETUP CHECKLIST**

### **STEP 1: Domain Purchase** ⏰ (15-30 minutes)

#### **Option A: GoDaddy (Recommended)**
1. Go to [GoDaddy.com](https://www.godaddy.com)
2. Search for `sichrplace.com`
3. Purchase the domain (usually $12-15/year)
4. Complete checkout process

#### **Option B: Namecheap**
1. Go to [Namecheap.com](https://www.namecheap.com)
2. Search for `sichrplace.com`
3. Purchase domain (usually $10-13/year)

#### **Option C: Google Domains**
1. Go to [domains.google.com](https://domains.google.com)
2. Search and purchase `sichrplace.com`

---

### **STEP 2: DNS Configuration** ⏰ (10-15 minutes)

Once you own the domain, configure these DNS records in your domain provider:

#### **Required DNS Records:**

```
Type: CNAME
Name: www
Value: sichrplace.netlify.app
TTL: 300 (or Auto)

Type: A (Optional for root domain)
Name: @
Value: 75.2.60.5
TTL: 300

Type: CNAME (Alternative for root domain)
Name: @  
Value: sichrplace.netlify.app
TTL: 300
```

---

### **STEP 3: Netlify Domain Configuration** ⏰ (5-10 minutes)

1. **Login to Netlify Dashboard**
   - Go to [netlify.com](https://www.netlify.com)
   - Login to your account
   - Navigate to your SichrPlace site

2. **Add Custom Domain**
   - Go to Site Settings → Domain Management
   - Click "Add custom domain"
   - Enter: `www.sichrplace.com`
   - Click "Verify"

3. **Configure DNS**
   - Netlify will show DNS instructions
   - Verify your DNS records match above

4. **Enable HTTPS**
   - Netlify will automatically provision SSL certificate
   - Wait 24-48 hours for full propagation

---

### **STEP 4: Domain Redirects** ⏰ (5 minutes)

Add these redirects to your `netlify.toml` file:

```toml
# Domain redirects
[[redirects]]
  from = "https://sichrplace.com/*"
  to = "https://www.sichrplace.com/:splat"
  status = 301
  force = true

[[redirects]]
  from = "http://sichrplace.com/*"
  to = "https://www.sichrplace.com/:splat"
  status = 301
  force = true

[[redirects]]
  from = "http://www.sichrplace.com/*"
  to = "https://www.sichrplace.com/:splat"
  status = 301
  force = true
```

---

### **STEP 5: Update Application URLs** ⏰ (10 minutes)

Update these files with your new domain:

1. **Environment Variables (.env)**
```bash
FRONTEND_URL=https://www.sichrplace.com
DOMAIN=www.sichrplace.com
```

2. **Package.json**
```json
{
  "homepage": "https://www.sichrplace.com"
}
```

3. **Frontend JavaScript Files**
```javascript
const PRODUCTION_URL = 'https://www.sichrplace.com';
```

---

### **STEP 6: Test Everything** ⏰ (15 minutes)

After DNS propagation (24-48 hours):

1. **Test URLs:**
   - https://www.sichrplace.com
   - https://sichrplace.com (should redirect to www)
   - All API endpoints should work

2. **SSL Certificate:**
   - Check for green lock icon
   - Certificate should be valid

3. **Functionality Test:**
   - Run your test suite against new domain
   - Test authentication, payments, etc.

---

## 🎯 **ESTIMATED TIMELINE**

- **Domain Purchase**: 15-30 minutes
- **DNS Configuration**: 10-15 minutes  
- **Netlify Setup**: 5-10 minutes
- **Code Updates**: 10 minutes
- **DNS Propagation**: 24-48 hours
- **Testing**: 15 minutes

**Total Active Time**: ~1 hour
**Total Timeline**: 1-2 days (due to DNS propagation)

---

## 💡 **PRO TIPS**

1. **DNS Propagation**: Can take up to 48 hours globally
2. **SSL Certificate**: Netlify provides free SSL via Let's Encrypt
3. **Subdomain Strategy**: Always use www version for consistency
4. **Email Setup**: Consider setting up email@sichrplace.com
5. **Monitoring**: Set up uptime monitoring for the new domain

---

## 🚀 **WHAT TO DO RIGHT NOW**

1. **Purchase the domain** (sichrplace.com)
2. **Configure DNS records** as shown above
3. **Add domain to Netlify**
4. **Wait for DNS propagation**
5. **Test and celebrate!** 🎉

Once you've purchased the domain, let me know and I'll help you with the technical configuration!