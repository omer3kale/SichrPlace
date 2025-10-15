#!/bin/bash

# UptimeRobot Setup and Management Script for SichrPlace
# This script sets up external monitoring via UptimeRobot API

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
UPTIMEROBOT_API_URL="https://api.uptimerobot.com/v2"
SITE_URL="https://sichrplace.com"
API_HEALTH_URL="https://sichrplace.com/api/health"

echo -e "${BLUE}🔍 SichrPlace UptimeRobot Setup${NC}"
echo "================================"

# Check if API key is set
if [ -z "$UPTIMEROBOT_API_KEY" ]; then
    echo -e "${RED}❌ UPTIMEROBOT_API_KEY environment variable is required${NC}"
    echo ""
    echo "To get your API key:"
    echo "1. Sign up at https://uptimerobot.com"
    echo "2. Go to Settings > API Settings"
    echo "3. Create a new API key with read/write permissions"
    echo "4. Set the environment variable: export UPTIMEROBOT_API_KEY='your_key_here'"
    exit 1
fi

echo -e "${GREEN}✓${NC} API key found"

# Function to make API calls
uptimerobot_api() {
    local endpoint=$1
    local data=$2
    
    curl -s -X POST "$UPTIMEROBOT_API_URL/$endpoint" \
        -d "api_key=$UPTIMEROBOT_API_KEY" \
        -d "format=json" \
        ${data:+-d "$data"}
}

# Function to check if monitor exists
monitor_exists() {
    local search_term=$1
    local response=$(uptimerobot_api "getMonitors" "search=$search_term")
    
    if echo "$response" | jq -e '.monitors | length > 0' > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to create monitor
create_monitor() {
    local url=$1
    local name=$2
    local type=${3:-1}  # 1 = HTTP(s), 2 = Keyword, 3 = Ping, 4 = Port
    
    echo "Creating monitor for $name..."
    
    local response=$(uptimerobot_api "newMonitor" "type=$type&url=$url&friendly_name=$name&interval=300")
    
    if echo "$response" | jq -e '.stat == "ok"' > /dev/null 2>&1; then
        local monitor_id=$(echo "$response" | jq -r '.monitor.id')
        echo -e "${GREEN}✓${NC} Monitor created successfully (ID: $monitor_id)"
        return 0
    else
        echo -e "${RED}✗${NC} Failed to create monitor: $(echo "$response" | jq -r '.error.message // "Unknown error"')"
        return 1
    fi
}

# Function to setup alert contacts
setup_alert_contacts() {
    echo ""
    echo "📧 Setting up alert contacts..."
    
    # Check existing contacts
    local contacts_response=$(uptimerobot_api "getAlertContacts")
    local email_exists=false
    
    if echo "$contacts_response" | jq -e '.alert_contacts | map(select(.value == "omer3kale@gmail.com")) | length > 0' > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Email alert contact already exists"
        email_exists=true
    fi
    
    # Create email contact if it doesn't exist
    if [ "$email_exists" = false ]; then
        echo "Creating email alert contact..."
        local email_response=$(uptimerobot_api "newAlertContact" "type=2&value=omer3kale@gmail.com&friendly_name=SichrPlace Admin")
        
        if echo "$email_response" | jq -e '.stat == "ok"' > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Email alert contact created"
        else
            echo -e "${YELLOW}⚠${NC} Failed to create email contact: $(echo "$email_response" | jq -r '.error.message // "Unknown error"')"
        fi
    fi
    
    # Setup Slack webhook if provided
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        echo "Creating Slack webhook contact..."
        local slack_response=$(uptimerobot_api "newAlertContact" "type=11&value=$SLACK_WEBHOOK_URL&friendly_name=SichrPlace Slack")
        
        if echo "$slack_response" | jq -e '.stat == "ok"' > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Slack webhook contact created"
        else
            echo -e "${YELLOW}⚠${NC} Failed to create Slack contact: $(echo "$slack_response" | jq -r '.error.message // "Unknown error"')"
        fi
    fi
}

# Main setup function
setup_monitors() {
    echo ""
    echo "🔧 Setting up monitors..."
    
    # Monitor 1: Main website
    if monitor_exists "SichrPlace Main Site"; then
        echo -e "${GREEN}✓${NC} Main site monitor already exists"
    else
        create_monitor "$SITE_URL" "SichrPlace Main Site" 1
    fi
    
    # Monitor 2: API Health endpoint
    if monitor_exists "SichrPlace API Health"; then
        echo -e "${GREEN}✓${NC} API health monitor already exists"
    else
        create_monitor "$API_HEALTH_URL" "SichrPlace API Health" 2  # Keyword monitor
    fi
    
    # Monitor 3: Database connectivity (via API)
    if monitor_exists "SichrPlace Database"; then
        echo -e "${GREEN}✓${NC} Database monitor already exists"
    else
        create_monitor "$API_HEALTH_URL" "SichrPlace Database" 2
    fi
}

# Function to show current status
show_status() {
    echo ""
    echo "📊 Current monitoring status..."
    
    local monitors_response=$(uptimerobot_api "getMonitors" "logs=1&log_limit=5")
    
    if echo "$monitors_response" | jq -e '.stat == "ok"' > /dev/null 2>&1; then
        echo "$monitors_response" | jq -r '
            .monitors[] | 
            "Monitor: \(.friendly_name)
            Status: \(if .status == 2 then "✅ UP" elif .status == 9 then "⏸️ PAUSED" else "❌ DOWN" end)
            Uptime: \(.all_time_uptime_ratio)%
            URL: \(.url)
            "
        '
    else
        echo -e "${RED}✗${NC} Failed to get monitor status"
    fi
}

# Function to test webhook integration
test_webhook() {
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        echo ""
        echo "🧪 Testing Slack webhook..."
        
        curl -X POST -H 'Content-type: application/json' \
            --data '{
                "text": "🔍 UptimeRobot Setup Complete",
                "attachments": [{
                    "color": "good",
                    "fields": [{
                        "title": "Status",
                        "value": "SichrPlace monitoring is now active",
                        "short": true
                    }, {
                        "title": "Monitors",
                        "value": "Main site, API health, Database",
                        "short": true
                    }]
                }]
            }' \
            "$SLACK_WEBHOOK_URL" \
            && echo -e "${GREEN}✓${NC} Slack webhook test successful" \
            || echo -e "${YELLOW}⚠${NC} Slack webhook test failed"
    fi
}

# Main execution
case "${1:-setup}" in
    "setup")
        setup_alert_contacts
        setup_monitors
        show_status
        test_webhook
        
        echo ""
        echo -e "${GREEN}🎉 UptimeRobot setup complete!${NC}"
        echo ""
        echo "📋 What's been configured:"
        echo "• Main website monitoring (5-minute intervals)"
        echo "• API health endpoint monitoring"
        echo "• Email alerts to omer3kale@gmail.com"
        if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
            echo "• Slack notifications via webhook"
        fi
        echo ""
        echo "🔗 Access your dashboard: https://uptimerobot.com/dashboard"
        ;;
        
    "status")
        show_status
        ;;
        
    "test")
        test_webhook
        ;;
        
    "help"|"--help"|"-h")
        echo "UptimeRobot Management Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  setup     Set up all monitors and contacts (default)"
        echo "  status    Show current monitoring status"
        echo "  test      Test webhook integration"
        echo "  help      Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  UPTIMEROBOT_API_KEY    Your UptimeRobot API key (required)"
        echo "  SLACK_WEBHOOK_URL      Slack webhook URL (optional)"
        ;;
        
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac