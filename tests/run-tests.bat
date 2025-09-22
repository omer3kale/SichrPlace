@echo off
echo.
echo ==========================================
echo  SichrPlace Functions Test Suite
echo ==========================================
echo.

cd /d "%~dp0"

echo Choose test type:
echo 1. Quick Test (6 critical functions)
echo 2. Full Test Suite (all 56 functions)
echo 3. Test against local development server
echo 4. Test against production site
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Running Quick Test...
    node quick-test.js
) else if "%choice%"=="2" (
    echo.
    echo Running Full Test Suite...
    node all-functions-test.js
) else if "%choice%"=="3" (
    echo.
    echo Testing against local development server...
    set NETLIFY_URL=http://localhost:8888
    node all-functions-test.js
) else if "%choice%"=="4" (
    echo.
    echo Testing against production site...
    set /p site_url="Enter your Netlify site URL: "
    set NETLIFY_URL=%site_url%
    node all-functions-test.js
) else (
    echo Invalid choice. Running quick test by default...
    node quick-test.js
)

echo.
pause