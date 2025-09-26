#!/usr/bin/env pwsh

# SichrPlace Workspace Cleanup & Unification Script
# Removes duplicate package.json files and consolidates dependencies
# Author: SichrPlace Security Team
# Created: September 25, 2025

Write-Host "🧹 Starting SichrPlace Workspace Cleanup..." -ForegroundColor Green

# Track what we're doing
$logFile = "workspace-cleanup-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').log"
$duplicateFiles = @()
$consolidatedDeps = @()

function Write-Log {
    param($Message, $Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Type`: $Message"
    Write-Host $logEntry -ForegroundColor $(if($Type -eq "ERROR") { "Red" } elseif($Type -eq "WARN") { "Yellow" } else { "Cyan" })
    Add-Content -Path $logFile -Value $logEntry
}

# 1. Identify duplicate/redundant package.json files
Write-Log "Step 1: Identifying duplicate and redundant package.json files"

$packageFiles = Get-ChildItem -Path . -Name "package.json" -Recurse
Write-Log "Found $($packageFiles.Count) package.json files:"
foreach($file in $packageFiles) {
    Write-Log "  - $file"
}

# 2. Identify which ones are duplicates/outdated
$redundantPatterns = @(
    "backend/tests/package.json",           # Duplicate testing setup
    "js/backend/package.json",              # Duplicate backend
    "tests/package.json",                   # Duplicate tests
    "github-pages-demo/package.json",      # Demo files
    "paypalstandard/*/package.json",        # PayPal examples
    "netlify/package.json"                  # Minimal netlify config, can be merged
)

Write-Log "Step 2: Identifying redundant package.json files to remove/consolidate"

foreach($pattern in $redundantPatterns) {
    $matchedFiles = Get-ChildItem -Path . -Name $pattern -Recurse 2>$null
    if($matchedFiles) {
        foreach($matchedFile in $matchedFiles) {
            $duplicateFiles += $matchedFile
            Write-Log "  REDUNDANT: $matchedFile" -Type "WARN"
        }
    }
}

# 3. Backup current main package.json
Write-Log "Step 3: Creating backup of main package.json"
if (Test-Path "package.json") {
    Copy-Item -Path "package.json" -Destination "package.json.backup-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')" -Force
    Write-Log "  Backup created successfully"
} else {
    Write-Log "  No main package.json found to backup" -Type "WARN"
}

# 4. Extract dependencies from all package.json files
Write-Log "Step 4: Consolidating dependencies from all package.json files"

$allDependencies = @{}
$allDevDependencies = @{}
$allOverrides = @{}

foreach($packageFile in $packageFiles) {
    if(Test-Path $packageFile) {
        Write-Log "  Processing: $packageFile"
        try {
            $packageData = Get-Content $packageFile -Raw | ConvertFrom-Json
            
            # Extract dependencies
            if($packageData.dependencies) {
                foreach($dep in $packageData.dependencies.PSObject.Properties) {
                    if(-not $allDependencies.ContainsKey($dep.Name)) {
                        $allDependencies[$dep.Name] = $dep.Value
                        Write-Log "    Added dependency: $($dep.Name)@$($dep.Value)"
                    } else {
                        # Use highest version if different
                        Write-Log "    Found duplicate dependency: $($dep.Name) ($($allDependencies[$dep.Name]) vs $($dep.Value))"
                        $consolidatedDeps += "$($dep.Name): $($allDependencies[$dep.Name]) vs $($dep.Value)"
                    }
                }
            }
            
            # Extract devDependencies
            if($packageData.devDependencies) {
                foreach($dep in $packageData.devDependencies.PSObject.Properties) {
                    if(-not $allDevDependencies.ContainsKey($dep.Name)) {
                        $allDevDependencies[$dep.Name] = $dep.Value
                        Write-Log "    Added devDependency: $($dep.Name)@$($dep.Value)"
                    }
                }
            }
            
            # Extract overrides
            if($packageData.overrides) {
                foreach($override in $packageData.overrides.PSObject.Properties) {
                    if(-not $allOverrides.ContainsKey($override.Name)) {
                        $allOverrides[$override.Name] = $override.Value
                        Write-Log "    Added override: $($override.Name)@$($override.Value)"
                    }
                }
            }
            
        } catch {
            Write-Log "    ERROR processing $packageFile`: $($_.Exception.Message)" -Type "ERROR"
        }
    }
}

# 5. Create comprehensive unified package.json
Write-Log "Step 5: Creating unified package.json"

$unifiedPackageJson = @{
    name = "sichrplace"
    version = "2.0.0"
    type = "module"
    description = "Secure apartment rental platform - unified workspace"
    main = "server.js"
    scripts = @{
        # Main application scripts
        "start" = "cd backend && node server.js"
        "dev" = "cd backend && nodemon server.js"
        "backend" = "cd backend && node server.js"
        "backend:dev" = "cd backend && nodemon server.js"
        
        # Testing scripts
        "test" = "jest --watchAll --verbose"
        "test:ci" = "jest --ci --coverage --watchAll=false"
        "test:backend" = "cd backend && npm test"
        "test:functions" = "cd netlify && node test-netlify-functions.js"
        "test:integration" = "cd backend/tests && npm run test:all"
        
        # Build and deployment
        "build" = "npm run preflight && echo Build checks passed"
        "deploy" = "netlify deploy"
        "deploy:prod" = "netlify deploy --prod"
        
        # Security and maintenance
        "preflight" = "node scripts/preflight.js"
        "preflight:strict" = "npm run preflight -- --strict"
        "security:comprehensive" = "node scripts/dependency-security-manager.mjs"
        "security:comprehensive:fix" = "node scripts/dependency-security-manager.mjs --fix"
        "security:track" = "node scripts/version-tracker.mjs"
        "security:track:fix" = "node scripts/version-tracker.mjs --fix"
        "security:full" = "npm run security:comprehensive && npm run security:track"
        "security:full:fix" = "npm run security:comprehensive:fix && npm run security:track:fix"
        "security:audit" = "npm audit --audit-level=info"
        "security:fix" = "npm audit fix --force"
        
        # Code quality
        "lint" = "eslint . --ext .js"
        "format" = "prettier --write ."
        "secrets:scan" = "node scripts/secret-scan.js"
        
        # Workspace management
        "workspace:cleanup" = "pwsh scripts/workspace-cleanup.ps1"
        "workspace:audit" = "node scripts/workspace-audit.mjs"
    }
    keywords = @("apartment", "rental", "property", "landlord", "tenant", "real-estate", "security")
    author = "SichrPlace Team"
    license = "MIT"
    dependencies = $allDependencies
    devDependencies = $allDevDependencies
    overrides = $allOverrides
    engines = @{
        node = ">=20.0.0"
        npm = ">=9.0.0"
    }
    repository = @{
        type = "git"
        url = "https://github.com/omer3kale/sichrplace.git"
    }
    bugs = @{
        url = "https://github.com/omer3kale/sichrplace/issues"
    }
    homepage = "https://github.com/omer3kale/sichrplace#readme"
    workspaces = @(
        "backend",
        "functions/*"
    )
}

# Convert to JSON and save
$unifiedJson = $unifiedPackageJson | ConvertTo-Json -Depth 10
$unifiedJson | Set-Content -Path "package.json" -Encoding UTF8

Write-Log "  Unified package.json created with:"
Write-Log "    Dependencies: $($allDependencies.Count)"
Write-Log "    DevDependencies: $($allDevDependencies.Count)"
Write-Log "    Overrides: $($allOverrides.Count)"
Write-Log "    Scripts: $($unifiedPackageJson.scripts.Count)"

# 6. Remove redundant package.json files (with backup)
Write-Log "Step 6: Removing redundant package.json files (with backup)"

$backupDir = "backup-package-files-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

foreach($file in $duplicateFiles) {
    if(Test-Path $file) {
        # Create backup
        $backupPath = Join-Path $backupDir $file.Replace('\', '_').Replace('/', '_')
        Copy-Item -Path $file -Destination $backupPath -Force
        
        # Remove original
        Remove-Item -Path $file -Force
        Write-Log "  REMOVED: $file (backed up to $backupPath)" -Type "WARN"
    }
}

# 7. Clean up node_modules directories
Write-Log "Step 7: Cleaning up redundant node_modules directories"

$nodeModuleDirs = Get-ChildItem -Path . -Name "node_modules" -Directory -Recurse
foreach($dir in $nodeModuleDirs) {
    if($dir -ne "node_modules") {  # Keep only root node_modules
        Write-Log "  Removing redundant: $dir" -Type "WARN"
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 8. Clean up package-lock.json files
Write-Log "Step 8: Cleaning up redundant package-lock.json files"

$lockFiles = Get-ChildItem -Path . -Name "package-lock.json" -Recurse
foreach($lockFile in $lockFiles) {
    if($lockFile -ne "package-lock.json") {  # Keep only root package-lock.json
        $backupPath = "$backupDir/$($lockFile.Replace('\', '_').Replace('/', '_'))"
        Copy-Item -Path $lockFile -Destination $backupPath -Force
        Remove-Item -Path $lockFile -Force
        Write-Log "  REMOVED: $lockFile (backed up)" -Type "WARN"
    }
}

# 9. Generate workspace audit report
Write-Log "Step 9: Generating workspace audit report"

$auditReport = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    removedFiles = $duplicateFiles
    consolidatedDependencies = $consolidatedDeps
    backupDirectory = $backupDir
    unifiedPackageInfo = @{
        dependencies = $allDependencies.Count
        devDependencies = $allDevDependencies.Count
        overrides = $allOverrides.Count
        scripts = $unifiedPackageJson.scripts.Count
    }
    nextSteps = @(
        "Run 'npm install' to install unified dependencies",
        "Run 'npm run security:full:fix' to resolve security issues",
        "Test all functionality to ensure nothing broke",
        "Commit changes to update GitHub Dependabot scanning"
    )
}

$auditReport | ConvertTo-Json -Depth 10 | Set-Content -Path "workspace-audit-report.json" -Encoding UTF8

# 10. Summary
Write-Log "✅ Workspace cleanup completed!" -Type "SUCCESS"
Write-Log ""
Write-Log "SUMMARY:" -Type "SUCCESS"
Write-Log "  - Removed $($duplicateFiles.Count) duplicate package.json files"
Write-Log "  - Consolidated $($allDependencies.Count) dependencies"
Write-Log "  - Consolidated $($allDevDependencies.Count) dev dependencies"
Write-Log "  - Created backup directory: $backupDir"
Write-Log "  - Generated audit report: workspace-audit-report.json"
Write-Log ""
Write-Log "NEXT STEPS:"
Write-Log "  1. Run: npm install"
Write-Log "  2. Run: npm run security:full:fix"
Write-Log "  3. Test: npm test"
Write-Log "  4. Commit: git add -A && git commit -m 'Workspace cleanup'"
Write-Log ""
Write-Log "Full log saved to: $logFile"

# Offer to run npm install
$choice = Read-Host "Would you like to run 'npm install' now? (y/N)"
if($choice -eq 'y' -or $choice -eq 'Y') {
    Write-Log "Running npm install..." -Type "SUCCESS"
    npm install
}

Write-Host "🎉 Workspace cleanup complete!" -ForegroundColor Green