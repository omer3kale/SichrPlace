#!/bin/bash

# Domain Update Script for SichrPlace
# Updates all frontend files to use www.sichrplace.com

echo "🌐 Starting domain update to www.sichrplace.com..."

# Define old and new URLs
OLD_URL="https://sichrplace.netlify.app"
NEW_URL="https://www.sichrplace.com"

# Function to update files
update_file() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "Updating: $file"
        sed -i "s|$OLD_URL|$NEW_URL|g" "$file"
        sed -i "s|sichrplace.netlify.app|www.sichrplace.com|g" "$file"
    fi
}

# Update HTML files
echo "📄 Updating HTML files..."
find frontend -name "*.html" -type f | while read file; do
    update_file "$file"
done

# Update JavaScript files  
echo "📜 Updating JavaScript files..."
find frontend -name "*.js" -type f | while read file; do
    update_file "$file"
done

# Update CSS files
echo "🎨 Updating CSS files..."
find frontend -name "*.css" -type f | while read file; do
    update_file "$file"
done

# Update Netlify Functions
echo "⚡ Updating Netlify Functions..."
find netlify/functions -name "*.mjs" -type f | while read file; do
    update_file "$file"
done

# Update configuration files
echo "⚙️  Updating configuration files..."
update_file "package.json"
update_file ".env"
update_file ".env.production"

# Update specific important files
echo "🔧 Updating important configuration files..."

# Update package.json homepage
if [ -f "package.json" ]; then
    echo "Updating package.json homepage..."
    sed -i 's/"homepage": "[^"]*"/"homepage": "https:\/\/www.sichrplace.com"/g' package.json
fi

echo "✅ Domain update completed!"
echo "🔍 Please review the changes and test thoroughly"
echo "📋 Next steps:"
echo "   1. Purchase domain sichrplace.com"
echo "   2. Configure DNS records"
echo "   3. Add custom domain to Netlify"
echo "   4. Wait for DNS propagation"
echo "   5. Test all functionality"