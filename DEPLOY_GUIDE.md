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
2. Build the project using Next.js build
3. Deploy directly to Cloudflare Workers
4. Show you the live URL

---

## Alternative: Manual Wrangler Commands

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
npx wrangler deploy
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
This is a Windows-specific crash. Use the deploy script which uses Next.js build instead.

### Dashboard Builds Keep Failing
The FAQ page had a TypeScript error (now fixed in commit f37b5d4). The next dashboard build should succeed. But if not, use the deploy script to bypass the dashboard entirely.

---

## What's Different About This Setup?

- **Dashboard deployment**: Uses Vite/Vinext build system (crashes on Windows)
- **CLI deployment**: Uses standard Next.js build (works everywhere)
- Both produce the same result on Cloudflare's servers

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
