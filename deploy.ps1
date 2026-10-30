# Direct deployment script for Kingdom Custom Print
# This bypasses the dashboard and deploys directly via CLI

Write-Host "🚀 Starting deployment to Cloudflare..." -ForegroundColor Cyan

# Check if logged in
Write-Host "`n📋 Checking Cloudflare authentication..." -ForegroundColor Yellow
$whoami = npx wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Cloudflare. Running login..." -ForegroundColor Red
    npx wrangler login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login failed. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Authenticated with Cloudflare" -ForegroundColor Green

# Build the project (skip local workerd since it crashes on Windows)
Write-Host "`n🔨 Building project..." -ForegroundColor Yellow
Write-Host "Note: Building without local preview (Windows workerd issue)" -ForegroundColor Gray

# Run Next.js build instead of Vite build to avoid workerd crash
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed" -ForegroundColor Green

# Deploy using cf CLI
Write-Host "`n📤 Deploying to Cloudflare..." -ForegroundColor Yellow
npx cf deploy --prebuilt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed. Check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Site: https://kingdomcustomprint.com" -ForegroundColor Cyan
Write-Host "`n⏳ Wait 30-60 seconds for CDN to update, then check the site." -ForegroundColor Yellow
