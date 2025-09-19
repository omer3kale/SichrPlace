# Netlify Custom Domain Roadmap — www.sichrplace.com

This roadmap describes the exact steps to connect your GitHub repository to Netlify (GitHub integration), deploy the site, and configure the custom domain `www.sichrplace.com` with HTTPS. Follow each section in order. Where Netlify provides specific values (A records, nameservers) you must copy them from the Netlify dashboard — do not invent values.

## Prerequisites
- You own the domain `sichrplace.com` and can manage its DNS at your registrar (or plan to transfer DNS to Netlify).
- Repository is pushed to GitHub at `omer3kale/SichrPlace77` (already done).
- `netlify.toml` present in the repo (publish directory = `frontend`, functions dir = `netlify/functions`).
- Netlify account and access to the Netlify app (https://app.netlify.com) with permission to connect GitHub repos.

---

## High-level checklist
1. Link GitHub repo to Netlify (Import from Git).
2. Verify build settings and environment variables.
3. Trigger a successful production deploy and verify site lives at `<generated-site>.netlify.app`.
4. Add custom domain `www.sichrplace.com` in Netlify site settings.
5. Configure DNS at your registrar (or use Netlify DNS). Copy values Netlify shows.
6. Wait for DNS propagation and SSL provisioning; enable HTTPS and set `www` as primary.
7. Test the site and API endpoints, enable redirects & security headers.

---

## Step A — Connect GitHub and deploy
1. In Netlify app: New site → Import from Git → GitHub → select `omer3kale/SichrPlace77` → branch `main`.
2. Build settings:
   - You can leave Build command empty so Netlify uses `netlify.toml`.
   - Publish directory: `frontend` (already in `netlify.toml`).
   - Functions directory: `netlify/functions` (already in `netlify.toml`).
3. Click Deploy. Monitor the Deploy logs. Fix any missing env variables or build errors.

Notes on environment variables
- Add secrets in Site settings → Build & deploy → Environment → Environment variables.
- Likely keys to add (search your codebase for usages): `SUPABASE_URL`, `SUPABASE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, any DB or third-party API keys.

Verification after deploy
- Confirm the site URL shown in Netlify dashboard (example `yoursite-XXXX.netlify.app`) is working.
- Call an API redirect defined in `netlify.toml` to verify functions mapping, e.g. `https://<yoursite>.netlify.app/api/health`.

---

## Step B — Add the custom domain in Netlify
1. In Netlify site dashboard → Domain management → Add custom domain.
2. Enter `www.sichrplace.com` (add `sichrplace.com` as well if you want the apex to resolve to the site).
3. Netlify will verify and show recommended DNS records or offer Netlify DNS.

Two recommended DNS approaches (choose one):

A) Use your existing registrar DNS (simpler for many registrars)
- For the `www` subdomain: create a CNAME record pointing `www` to the Netlify subdomain that Netlify shows (something like `yoursite-XXXX.netlify.app`).
- For the root/apex (`sichrplace.com`): use an ALIAS / ANAME record if your registrar supports it, or use the A records Netlify shows. Netlify dashboard will display the correct A records if needed — copy those exact values.
- Netlify may also ask you to add a TXT record for domain verification — add it when shown.

B) Transfer DNS to Netlify (recommended if you want Netlify to manage DNS)
- In Netlify Domain settings choose "Set up Netlify DNS" and follow prompts — Netlify will provide nameservers.
- At your domain registrar, update the domain's nameservers to the Netlify nameservers Netlify provides.
- Return to Netlify and verify. Netlify DNS automatically configures the required records (A/CNAME, CAA) for you.

Important: Always copy the records Netlify displays; do not type guesses. Netlify's dashboard gives authoritative values.

---

## Step C — Wait for propagation and enable HTTPS
- After DNS changes, propagation can take minutes to hours depending on TTLs.
- Once DNS is valid, Netlify automatically provisions a Let’s Encrypt certificate. Watch Site settings → HTTPS.
- When HTTPS is ready, enable "Force HTTPS" and optionally HTTP -> HTTPS redirects.

Check status commands (PowerShell examples)
```powershell
# Check that www resolves to Netlify CNAME
Resolve-DnsName -Name www.sichrplace.com -Type CNAME

# Check TLS/response
curl -I https://www.sichrplace.com
```
Or with dig (Linux/macOS):
```bash
dig +short CNAME www.sichrplace.com
curl -I https://www.sichrplace.com
```

---

## Step D — Make `www` the primary domain and configure redirects
1. In Netlify domain settings, set `www.sichrplace.com` as the primary domain.
2. Add a redirect from the apex `sichrplace.com` to `https://www.sichrplace.com` if apex is not primary (Netlify can do this automatically when you set the primary domain).
3. Confirm `https://sichrplace.com` redirects to `https://www.sichrplace.com`.

---

## Step E — Post-deploy verification and hardening
- Visit key pages and make sure client assets load from `/frontend` paths.
- Test serverless functions under `/api/*` as defined in `netlify.toml`.
- From Netlify Dashboard → Site settings → Build & deploy → Environment variables, confirm all secrets exist.
- Security headers already defined in `netlify.toml` — verify they appear in responses (use `curl -I` and inspect headers).
- Optionally enable HSTS and other advanced security controls in Netlify settings.

---

## Troubleshooting common issues
- Build fails: Check deploy log for missing env vars or failing build command. Add missing variables and re-deploy.
- DNS not verified: Ensure you added exact record values Netlify shows, and wait for TTL propagation.
- SSL stuck: Usually resolves after DNS correct; if not, verify CAA records at registrar allow Let's Encrypt.
- Apex not working: Use Netlify DNS or ANAME/ALIAS support from registrar; otherwise add Netlify-provided A records for apex.

---

## Rollout plan (recommended)
1. Connect repo → do a test production deploy to Netlify using `main` branch.
2. Verify site and functions using Netlify subdomain.
3. Add custom domain `www.sichrplace.com` and choose DNS option (Netlify DNS recommended).
4. Configure environment variables (PROD keys) in Netlify.
5. After successful verification, make `www` primary, enable Force HTTPS, and monitor logs for 24–48 hours.
6. Once stable, enable branch deploys / previews for your team and document the DNS/Netlify admin process in `docs/NETLIFY_CUSTOM_DOMAIN_ROADMAP.md` (this file).

---

## Optional: CLI automation hints
- After `netlify login`, you can create and link site to GitHub via:
```powershell
netlify sites:create --repo=omer3kale/SichrPlace77 --repo-branch=main --publish-dir=frontend --functions=netlify/functions
```
- To set DNS and custom domain via CLI, follow the Netlify CLI prompts or use the Netlify web UI for domain verification — it is simpler for DNS record copy/paste.

---

If you want, I can:
- Attempt a Netlify CLI flow from this environment (you will need to run `netlify login` when prompted).
- Or walk you through the Netlify web UI steps; once you add the domain, paste the DNS records here and I can verify them.

File created: `docs/NETLIFY_CUSTOM_DOMAIN_ROADMAP.md`

