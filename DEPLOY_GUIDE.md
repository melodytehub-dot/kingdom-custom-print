# Quick Deployment Guide

## The Problem
Cloudflare Dashboard builds are failing. CLI access is needed to deploy directly and see detailed error logs.

## Solution: Use the Deploy Script

### Simple One-Command Deployment

```powershell
.\deploy.ps1
```

That's it! This script will:
1. Check if you're logged into Cloudflare (login if needed)
2. Build the Cloudflare Worker bundle
3. Deploy the generated Cloudflare Build Output
4. Show you the live URL

---

## Alternative: Manual Cloudflare CLI Commands

If you prefer manual control:

### 1. Login to Cloudflare (first time only)
```powershell
npx wrangler login
```

### 2. Build the Project
```powershell
npm run build
```

### 3. Deploy
```powershell
npx cf deploy --prebuilt
```

---

## Check Your Deployment

After deploying:
```powershell
# List recent deployments
npx wrangler deployments list

# View deployment logs
npx wrangler tail
```

---

## Troubleshooting

### "Project not found" Error
This means the CLI is authenticated to a different Cloudflare account than where `kingdom-custom-print` lives. 

**Solution**: 
1. In your browser, go to https://dash.cloudflare.com/
2. Make sure you're on the correct account (check top-left dropdown)
3. Go to Workers & Pages → kingdom-custom-print → Settings → API Tokens
4. Create a new API token with edit permissions
5. Use it: `npx wrangler login --api-token YOUR_TOKEN`

### Build Fails with "workerd" Error
This is a Windows-specific local preview crash. The production build uses Vite/Vinext and runs in Cloudflare Workers Builds; the deploy script skips local preview and deploys the generated bundle.

### Dashboard Builds Keep Failing
Confirm that the build command is `npm run build` and the deploy command is `npx cf deploy --prebuilt`. Do not use `next build` or `npx wrangler deploy`; this project uses Cloudflare Build Output from `cloudflare.config.ts`.

---

## What's Different About This Setup?

- **Cloudflare Workers Builds**: Uses `npm run build` (Vite/Vinext) and `npx cf deploy --prebuilt`
- **Local Windows deployment**: Uses the same build and `deploy.ps1`, but skips local workerd preview

---

## Quick Commands Cheat Sheet

```powershell
# Deploy everything
.\deploy.ps1

# Just check auth status
npx wrangler whoami

# View live logs
npx wrangler tail

# List all deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback

# Check project details
npx wrangler pages project list
```

---

## Next Steps

1. Run `.\deploy.ps1` now to deploy your bug fixes
2. Wait 30-60 seconds for CDN to update
3. Clear browser cache and test the customizer
4. Check if the white rectangle is gone and mobile arrows appear
