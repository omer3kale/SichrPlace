-- Quick verification query for Supabase
-- Run this in Supabase SQL Editor to confirm all tables exist

-- Count total tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- List all created tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify critical tables exist (should return 18)
SELECT COUNT(*) as critical_tables_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'apartments', 'viewing_requests', 'conversations', 'messages', 'offers', 'feedback',
    'payment_transactions', 'refund_requests',
    'marketplace_listings', 'marketplace_contacts', 'marketplace_chats', 'chat_messages', 'marketplace_payments',
    'admin_audit_log', 'support_tickets', 'support_ticket_messages', 'trust_safety_reports'
);

-- Test table access (should all return 0, no errors)
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'apartments', COUNT(*) FROM apartments
UNION ALL
SELECT 'marketplace_listings', COUNT(*) FROM marketplace_listings
UNION ALL
SELECT 'payment_transactions', COUNT(*) FROM payment_transactions
UNION ALL
SELECT 'admin_audit_log', COUNT(*) FROM admin_audit_log
UNION ALL
SELECT 'support_tickets', COUNT(*) FROM support_tickets;
