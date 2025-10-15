#!/bin/bash

# SEO Validation Script for SichrPlace
# Validates SEO basics and submits sitemap to search engines

set -e

echo "🔍 Running SEO validation for SichrPlace..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SITE_URL="https://sichrplace.com"
ERRORS=0

# Function to check if a URL returns 200
check_url() {
    local url=$1
    local description=$2
    
    echo -n "Checking $description... "
    
    if curl -s -f -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Function to validate meta tags
validate_meta_tags() {
    echo "📝 Validating meta tags..."
    
    local content=$(curl -s "$SITE_URL")
    
    # Check for title tag
    if echo "$content" | grep -q "<title>.*SichrPlace.*</title>"; then
        echo -e "${GREEN}✓${NC} Title tag present"
    else
        echo -e "${RED}✗${NC} Title tag missing or incomplete"
        ((ERRORS++))
    fi
    
    # Check for meta description
    if echo "$content" | grep -q 'name="description"'; then
        echo -e "${GREEN}✓${NC} Meta description present"
    else
        echo -e "${RED}✗${NC} Meta description missing"
        ((ERRORS++))
    fi
    
    # Check for Open Graph tags
    if echo "$content" | grep -q 'property="og:title"'; then
        echo -e "${GREEN}✓${NC} Open Graph tags present"
    else
        echo -e "${YELLOW}⚠${NC} Open Graph tags missing"
    fi
    
    # Check for canonical URL
    if echo "$content" | grep -q 'rel="canonical"'; then
        echo -e "${GREEN}✓${NC} Canonical URL present"
    else
        echo -e "${YELLOW}⚠${NC} Canonical URL missing"
    fi
}

echo "🌐 Checking core URLs..."

# Check main pages
check_url "$SITE_URL" "Homepage" || ((ERRORS++))
check_url "$SITE_URL/robots.txt" "Robots.txt" || ((ERRORS++))
check_url "$SITE_URL/sitemap.xml" "Sitemap" || ((ERRORS++))

echo ""
validate_meta_tags

echo ""
echo "🗺️ Validating sitemap..."

# Download and validate sitemap
SITEMAP_CONTENT=$(curl -s "$SITE_URL/sitemap.xml")

# Check sitemap format
if echo "$SITEMAP_CONTENT" | grep -q "<urlset"; then
    echo -e "${GREEN}✓${NC} Sitemap has valid XML structure"
    
    # Count URLs in sitemap
    URL_COUNT=$(echo "$SITEMAP_CONTENT" | grep -c "<url>" || echo "0")
    echo -e "${GREEN}✓${NC} Sitemap contains $URL_COUNT URLs"
    
    # Validate a sample of URLs from sitemap
    echo "🔗 Validating sample URLs from sitemap..."
    SAMPLE_URLS=$(echo "$SITEMAP_CONTENT" | grep -o 'https://[^<]*' | head -5)
    
    for url in $SAMPLE_URLS; do
        check_url "$url" "$(basename "$url")" || echo -e "${YELLOW}⚠${NC} URL may have issues: $url"
    done
    
else
    echo -e "${RED}✗${NC} Invalid sitemap format"
    ((ERRORS++))
fi

echo ""
echo "📡 Submitting sitemap to search engines..."

# Submit to Google
GOOGLE_PING="https://www.google.com/ping?sitemap=$SITE_URL/sitemap.xml"
if curl -s -f -o /dev/null "$GOOGLE_PING"; then
    echo -e "${GREEN}✓${NC} Sitemap submitted to Google"
else
    echo -e "${YELLOW}⚠${NC} Failed to submit to Google (may be rate limited)"
fi

# Submit to Bing
BING_PING="https://www.bing.com/ping?sitemap=$SITE_URL/sitemap.xml"
if curl -s -f -o /dev/null "$BING_PING"; then
    echo -e "${GREEN}✓${NC} Sitemap submitted to Bing"
else
    echo -e "${YELLOW}⚠${NC} Failed to submit to Bing (may be rate limited)"
fi

echo ""
echo "🏃‍♂️ Running Lighthouse SEO audit..."

# Install lighthouse if not present
if ! command -v lighthouse &> /dev/null; then
    echo "Installing Lighthouse CLI..."
    npm install -g lighthouse
fi

# Run Lighthouse SEO audit
LIGHTHOUSE_OUTPUT="lighthouse-seo-$(date +%Y%m%d-%H%M%S).json"

lighthouse "$SITE_URL" \
    --only-categories=seo \
    --output=json \
    --output-path="$LIGHTHOUSE_OUTPUT" \
    --chrome-flags="--headless --no-sandbox" \
    --quiet

# Extract SEO score
SEO_SCORE=$(cat "$LIGHTHOUSE_OUTPUT" | jq -r '.categories.seo.score * 100' 2>/dev/null || echo "N/A")

if [ "$SEO_SCORE" != "N/A" ] && [ "$SEO_SCORE" -ge 90 ]; then
    echo -e "${GREEN}✓${NC} Lighthouse SEO Score: $SEO_SCORE/100"
elif [ "$SEO_SCORE" != "N/A" ] && [ "$SEO_SCORE" -ge 70 ]; then
    echo -e "${YELLOW}⚠${NC} Lighthouse SEO Score: $SEO_SCORE/100 (needs improvement)"
    ((ERRORS++))
else
    echo -e "${RED}✗${NC} Lighthouse SEO Score: $SEO_SCORE/100 (poor)"
    ((ERRORS++))
fi

# Cleanup
rm -f "$LIGHTHOUSE_OUTPUT"

echo ""
echo "📋 SEO Validation Summary:"
echo "========================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All SEO checks passed!${NC}"
    echo "🎉 Your site is ready for search engines."
else
    echo -e "${RED}❌ $ERRORS issues found${NC}"
    echo "🔧 Please address the issues above."
fi

echo ""
echo "📚 Next steps:"
echo "1. Set up Google Search Console: https://search.google.com/search-console"
echo "2. Set up Bing Webmaster Tools: https://www.bing.com/webmasters"
echo "3. Monitor search performance regularly"
echo "4. Consider adding structured data (JSON-LD)"

exit $ERRORS