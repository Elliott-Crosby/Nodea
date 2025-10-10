# Deployment Rotation Script for Nodea MVP 2.1
# This script creates a new deployment with rotated keys

param(
    [string]$NewDeploymentName = "secure-nodea-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Nodea Deployment Rotation Script" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Configuration
$CURRENT_DEPLOYMENT = "posh-setter-840"

Write-Host "📋 Current deployment: $CURRENT_DEPLOYMENT" -ForegroundColor Yellow
Write-Host "🆕 New deployment name: $NewDeploymentName" -ForegroundColor Yellow

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Not in project root directory" -ForegroundColor Red
    exit 1
}

# Check if Convex is initialized
if (-not (Test-Path "convex")) {
    Write-Host "❌ Error: Convex not initialized" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔐 Step 1: Generate new keys" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan

# Run key rotation script
node scripts/rotate-keys.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Key rotation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔑 Step 2: Get new keys" -ForegroundColor Cyan
Write-Host "----------------------" -ForegroundColor Cyan

# Get the latest generated keys
$LATEST_JWT_PRIVATE = Get-ChildItem -Path "rotated-keys" -Filter "jwt-private-key-*.pem" | Sort-Object LastWriteTime | Select-Object -Last 1
$LATEST_JWKS = Get-ChildItem -Path "rotated-keys" -Filter "jwks-*.json" | Sort-Object LastWriteTime | Select-Object -Last 1

if (-not $LATEST_JWT_PRIVATE -or -not $LATEST_JWKS) {
    Write-Host "❌ Error: Generated keys not found" -ForegroundColor Red
    exit 1
}

Write-Host "📁 JWT Private Key: $($LATEST_JWT_PRIVATE.FullName)" -ForegroundColor Yellow
Write-Host "📁 JWKS: $($LATEST_JWKS.FullName)" -ForegroundColor Yellow

# Read the keys
$JWT_PRIVATE_KEY = (Get-Content $LATEST_JWT_PRIVATE.FullName -Raw) -replace "`n", "\n"
$JWKS_CONTENT = Get-Content $LATEST_JWKS.FullName -Raw

Write-Host ""
Write-Host "🆕 Step 3: Create new deployment" -ForegroundColor Cyan
Write-Host "-------------------------------" -ForegroundColor Cyan

# Create new deployment
Write-Host "Creating new deployment: $NewDeploymentName" -ForegroundColor Yellow
npx convex deploy --prod --name $NewDeploymentName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment creation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Step 4: Set environment variables" -ForegroundColor Cyan
Write-Host "-----------------------------------" -ForegroundColor Cyan

# Set environment variables for new deployment
Write-Host "Setting CONVEX_OPENAI_API_KEY..." -ForegroundColor Yellow
$NEW_OPENAI_KEY = Read-Host "Enter new OpenAI API key"

Write-Host "Setting JWT_PRIVATE_KEY..." -ForegroundColor Yellow
npx convex env set JWT_PRIVATE_KEY $JWT_PRIVATE_KEY

Write-Host "Setting JWKS..." -ForegroundColor Yellow
npx convex env set JWKS $JWKS_CONTENT

Write-Host "Setting CONVEX_OPENAI_API_KEY..." -ForegroundColor Yellow
npx convex env set CONVEX_OPENAI_API_KEY $NEW_OPENAI_KEY

Write-Host ""
Write-Host "🧪 Step 5: Test new deployment" -ForegroundColor Cyan
Write-Host "-----------------------------" -ForegroundColor Cyan

# Test the deployment
Write-Host "Testing new deployment..." -ForegroundColor Yellow
npx convex run boards:listBoards

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment test failed" -ForegroundColor Red
    Write-Host "🔧 You may need to fix issues before proceeding" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Step 6: Deployment rotation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "🎉 New deployment created successfully!" -ForegroundColor Green
Write-Host "📊 Deployment name: $NewDeploymentName" -ForegroundColor Yellow
Write-Host "🌐 Dashboard: https://dashboard.convex.dev/d/$NewDeploymentName" -ForegroundColor Yellow

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Test all application functionality"
Write-Host "2. Update frontend to use new deployment URL"
Write-Host "3. Monitor for 24-48 hours"
Write-Host "4. Revoke old deployment after confirming new one works"
Write-Host "5. Update documentation with new deployment info"

Write-Host ""
Write-Host "⚠️  Security Notes:" -ForegroundColor Yellow
Write-Host "- Old deployment: $CURRENT_DEPLOYMENT"
Write-Host "- New deployment: $NewDeploymentName"
Write-Host "- Keep old deployment active until new one is verified"
Write-Host "- Monitor audit logs for any issues"
Write-Host "- Force user re-authentication"

Write-Host ""
Write-Host "🔗 Useful Commands:" -ForegroundColor Cyan
Write-Host "npx convex dashboard  # Open new deployment dashboard"
Write-Host "npx convex env list   # List environment variables"
Write-Host "npx convex logs       # View deployment logs"

Write-Host ""
Write-Host "🎯 Deployment rotation completed successfully!" -ForegroundColor Green
