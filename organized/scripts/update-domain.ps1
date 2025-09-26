# Domain Update Script for SichrPlace (PowerShell)
# Updates all frontend files to use www.sichrplace.com

Write-Host "🌐 Starting domain update to www.sichrplace.com..." -ForegroundColor Green

# Define old and new URLs
$oldUrl = "https://sichrplace.netlify.app"
$newUrl = "https://www.sichrplace.com"
$oldDomain = "sichrplace.netlify.app"
$newDomain = "www.sichrplace.com"

# Function to update files
function Update-File {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        Write-Host "Updating: $FilePath" -ForegroundColor Yellow
        $content = Get-Content $FilePath -Raw
        $content = $content -replace [regex]::Escape($oldUrl), $newUrl
        $content = $content -replace [regex]::Escape($oldDomain), $newDomain
        Set-Content $FilePath $content -NoNewline
    }
}

# Update HTML files
Write-Host "📄 Updating HTML files..." -ForegroundColor Cyan
Get-ChildItem -Path "frontend" -Filter "*.html" -Recurse | ForEach-Object {
    Update-File $_.FullName
}

# Update JavaScript files
Write-Host "📜 Updating JavaScript files..." -ForegroundColor Cyan
Get-ChildItem -Path "frontend" -Filter "*.js" -Recurse | ForEach-Object {
    Update-File $_.FullName
}

# Update CSS files
Write-Host "🎨 Updating CSS files..." -ForegroundColor Cyan
Get-ChildItem -Path "frontend" -Filter "*.css" -Recurse | ForEach-Object {
    Update-File $_.FullName
}

# Update Netlify Functions
Write-Host "⚡ Updating Netlify Functions..." -ForegroundColor Cyan
Get-ChildItem -Path "netlify/functions" -Filter "*.mjs" -Recurse | ForEach-Object {
    Update-File $_.FullName
}

# Update configuration files
Write-Host "⚙️  Updating configuration files..." -ForegroundColor Cyan
@("package.json", ".env", ".env.production") | ForEach-Object {
    if (Test-Path $_) {
        Update-File $_
    }
}

# Update package.json homepage specifically
if (Test-Path "package.json") {
    Write-Host "🔧 Updating package.json homepage..." -ForegroundColor Cyan
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $packageJson.homepage = "https://www.sichrplace.com"
    $packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"
}

Write-Host "✅ Domain update completed!" -ForegroundColor Green
Write-Host "🔍 Please review the changes and test thoroughly" -ForegroundColor Yellow
Write-Host "📋 Next steps:" -ForegroundColor White
Write-Host "   1. Purchase domain sichrplace.com" -ForegroundColor White
Write-Host "   2. Configure DNS records" -ForegroundColor White
Write-Host "   3. Add custom domain to Netlify" -ForegroundColor White
Write-Host "   4. Wait for DNS propagation" -ForegroundColor White
Write-Host "   5. Test all functionality" -ForegroundColor White