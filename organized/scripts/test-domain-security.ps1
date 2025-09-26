# Domain Security Test Script for www.sichrplace.com
# Quick verification of domain setup, SSL, and security

param(
    [string]$Domain = "www.sichrplace.com",
    [switch]$Verbose
)

Write-Host "🔍 Testing Domain Security for $Domain" -ForegroundColor Cyan
Write-Host "=" * 50

# Test 1: Basic connectivity
Write-Host "`n1. 🌐 Testing Basic Connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://$Domain" -Method Head -TimeoutSec 10 -ErrorAction Stop
    Write-Host "   ✅ HTTPS connection successful (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ HTTPS connection failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: SSL Certificate
Write-Host "`n2. 🔒 Checking SSL Certificate..." -ForegroundColor Yellow
try {
    $request = [System.Net.WebRequest]::Create("https://$Domain")
    $request.GetResponse() | Out-Null
    $cert = $request.ServicePoint.Certificate
    $cert2 = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cert)
    
    $daysUntilExpiry = ($cert2.NotAfter - (Get-Date)).Days
    
    Write-Host "   ✅ SSL Certificate valid" -ForegroundColor Green
    Write-Host "   📅 Expires: $($cert2.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Cyan
    Write-Host "   ⏰ Days until expiry: $daysUntilExpiry" -ForegroundColor Cyan
    Write-Host "   🏢 Issued by: $($cert2.Issuer)" -ForegroundColor Cyan
    
    if ($daysUntilExpiry -lt 30) {
        Write-Host "   ⚠️  Certificate expires soon!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ SSL certificate check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Security Headers
Write-Host "`n3. 🛡️ Checking Security Headers..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://$Domain" -Method Head -TimeoutSec 10 -ErrorAction Stop
    
    $securityHeaders = @{
        "Strict-Transport-Security" = "HSTS"
        "X-Frame-Options" = "Clickjacking Protection"
        "X-XSS-Protection" = "XSS Protection"
        "X-Content-Type-Options" = "MIME Sniffing Protection"
        "Content-Security-Policy" = "Content Security Policy"
        "Referrer-Policy" = "Referrer Policy"
    }
    
    $headerScore = 0
    foreach ($header in $securityHeaders.Keys) {
        if ($response.Headers[$header]) {
            Write-Host "   ✅ $($securityHeaders[$header]): Present" -ForegroundColor Green
            $headerScore++
        } else {
            Write-Host "   ❌ $($securityHeaders[$header]): Missing" -ForegroundColor Red
        }
    }
    
    $grade = switch ($headerScore) {
        { $_ -ge 6 } { "A+" }
        { $_ -ge 5 } { "A" }
        { $_ -ge 4 } { "B" }
        { $_ -ge 3 } { "C" }
        { $_ -ge 2 } { "D" }
        default { "F" }
    }
    
    Write-Host "   📊 Security Score: $headerScore/6 (Grade: $grade)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Security header check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Redirect Tests
Write-Host "`n4. 🔄 Testing Redirects..." -ForegroundColor Yellow

$redirectTests = @(
    @{ From = "http://$($Domain.Replace('www.', ''))"; Expected = "https://$Domain" }
    @{ From = "https://$($Domain.Replace('www.', ''))"; Expected = "https://$Domain" }
    @{ From = "http://$Domain"; Expected = "https://$Domain" }
)

foreach ($test in $redirectTests) {
    try {
        $response = Invoke-WebRequest -Uri $test.From -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 301 -or $response.StatusCode -eq 302) {
            $location = $response.Headers.Location
            if ($location -eq $test.Expected) {
                Write-Host "   ✅ $($test.From) → $location" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  $($test.From) → $location (Expected: $($test.Expected))" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   ❌ $($test.From) - No redirect (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "   ❌ $($test.From) - Test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: API Endpoints
Write-Host "`n5. 🔗 Testing Key API Endpoints..." -ForegroundColor Yellow

$apiEndpoints = @(
    "/api/health"
    "/api/simple-health" 
    "/api/property-statistics"
    "/api/user-profile"
    "/api/financial-management"
)

$successCount = 0
foreach ($endpoint in $apiEndpoints) {
    try {
        $response = Invoke-WebRequest -Uri "https://$Domain$endpoint" -Method Get -TimeoutSec 10 -ErrorAction Stop
        Write-Host "   ✅ $endpoint (Status: $($response.StatusCode))" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "   ❌ $endpoint - Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$apiSuccessRate = [math]::Round(($successCount / $apiEndpoints.Count) * 100, 1)
Write-Host "   📊 API Success Rate: $apiSuccessRate% ($successCount/$($apiEndpoints.Count))" -ForegroundColor Cyan

# Test 6: Performance Check
Write-Host "`n6. ⚡ Performance Test..." -ForegroundColor Yellow
try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-WebRequest -Uri "https://$Domain" -Method Head -TimeoutSec 30 -ErrorAction Stop
    $stopwatch.Stop()
    
    $responseTime = $stopwatch.ElapsedMilliseconds
    Write-Host "   ⏱️  Response Time: ${responseTime}ms" -ForegroundColor Cyan
    
    if ($responseTime -lt 1000) {
        Write-Host "   🚀 Excellent performance!" -ForegroundColor Green
    } elseif ($responseTime -lt 3000) {
        Write-Host "   👍 Good performance" -ForegroundColor Yellow
    } else {
        Write-Host "   🐌 Slow response time" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Performance test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n" + "=" * 50
Write-Host "📋 DOMAIN SETUP SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50

Write-Host "Domain: $Domain"
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Next Steps
Write-Host "`n💡 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. If HTTPS connection failed, check DNS configuration"
Write-Host "2. If security headers are missing, verify netlify.toml deployment"
Write-Host "3. If redirects aren't working, check Netlify domain settings"
Write-Host "4. If APIs are failing, verify function deployment"
Write-Host "5. For SSL issues, check Netlify SSL certificate status"

Write-Host "`n🔗 USEFUL LINKS:" -ForegroundColor Cyan
Write-Host "• Netlify Dashboard: https://app.netlify.com"
Write-Host "• SSL Test: https://www.ssllabs.com/ssltest/"
Write-Host "• Security Headers: https://securityheaders.com/"
Write-Host "• DNS Checker: https://dnschecker.org/"

Write-Host "`n🎉 Test completed!" -ForegroundColor Green