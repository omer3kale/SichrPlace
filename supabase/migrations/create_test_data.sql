-- ============================================================================
-- SICHRPLACE - TEST DATA
-- ============================================================================
-- Creates realistic test data for development and testing
-- Run this AFTER creating all tables
-- ============================================================================

-- ============================================================================
-- CLEAN EXISTING TEST DATA (Optional - Comment out if you want to keep data)
-- ============================================================================

-- TRUNCATE TABLE reviews CASCADE;
-- TRUNCATE TABLE recently_viewed CASCADE;
-- TRUNCATE TABLE saved_searches CASCADE;
-- TRUNCATE TABLE user_favorites CASCADE;
-- TRUNCATE TABLE email_logs CASCADE;
-- TRUNCATE TABLE notifications CASCADE;
-- TRUNCATE TABLE trust_safety_reports CASCADE;
-- TRUNCATE TABLE support_ticket_messages CASCADE;
-- TRUNCATE TABLE support_tickets CASCADE;
-- TRUNCATE TABLE admin_audit_log CASCADE;
-- TRUNCATE TABLE marketplace_payments CASCADE;
-- TRUNCATE TABLE chat_messages CASCADE;
-- TRUNCATE TABLE marketplace_chats CASCADE;
-- TRUNCATE TABLE marketplace_contacts CASCADE;
-- TRUNCATE TABLE marketplace_listings CASCADE;
-- TRUNCATE TABLE refund_requests CASCADE;
-- TRUNCATE TABLE payment_transactions CASCADE;
-- TRUNCATE TABLE feedback CASCADE;
-- TRUNCATE TABLE offers CASCADE;
-- TRUNCATE TABLE messages CASCADE;
-- TRUNCATE TABLE conversations CASCADE;
-- TRUNCATE TABLE viewing_requests CASCADE;
-- TRUNCATE TABLE apartments CASCADE;
-- TRUNCATE TABLE consents CASCADE;
-- TRUNCATE TABLE users CASCADE;

-- ============================================================================
-- 1. USERS (Admin, Landlords, Tenants)
-- ============================================================================

INSERT INTO users (id, username, email, password, role, first_name, last_name, phone, email_verified, gdpr_consent, gdpr_consent_date, created_at) VALUES
-- Admin User
('11111111-1111-1111-1111-111111111111', 'admin', 'admin@sichrplace.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'admin', 'Admin', 'User', '+49151234567890', true, true, NOW(), NOW()),

-- Landlords
('22222222-2222-2222-2222-222222222222', 'landlord_max', 'max.mueller@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'vermieter', 'Max', 'Müller', '+49151234567891', true, true, NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'landlord_anna', 'anna.schmidt@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'vermieter', 'Anna', 'Schmidt', '+49151234567892', true, true, NOW(), NOW()),

-- Tenants
('44444444-4444-4444-4444-444444444444', 'tenant_lisa', 'lisa.weber@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'mieter', 'Lisa', 'Weber', '+49151234567893', true, true, NOW(), NOW()),
('55555555-5555-5555-5555-555555555555', 'tenant_tom', 'tom.fischer@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'mieter', 'Tom', 'Fischer', '+49151234567894', true, true, NOW(), NOW()),
('66666666-6666-6666-6666-666666666666', 'tenant_sarah', 'sarah.becker@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890', 'mieter', 'Sarah', 'Becker', '+49151234567895', true, true, NOW(), NOW());

-- ============================================================================
-- 2. APARTMENTS
-- ============================================================================

INSERT INTO apartments (id, owner_id, title, description, location, price, deposit, size, rooms, bathrooms, status, available_from, city, postal_code, pet_friendly, furnished, balcony, parking, created_at) VALUES
-- Available Apartments
('aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 
 'Moderne 2-Zimmer Wohnung in Mitte', 
 'Schöne helle Wohnung mit Balkon im Herzen von Berlin. Vollständig renoviert mit modernen Annehmlichkeiten.',
 'Friedrichstraße 120, Berlin', 1200.00, 2400.00, 65, 2, 1, 'verfuegbar', '2025-11-01', 'Berlin', '10117', false, true, true, false, NOW()),

('aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
 'Geräumige 3-Zimmer Altbauwohnung',
 'Charmante Altbauwohnung mit hohen Decken und Parkettboden in Prenzlauer Berg.',
 'Schönhauser Allee 45, Berlin', 1500.00, 3000.00, 85, 3, 1, 'verfuegbar', '2025-10-15', 'Berlin', '10435', true, false, true, true, NOW()),

('aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
 'Gemütliches Studio-Apartment',
 'Perfekt für Singles oder Studenten. Komplett möbliert mit allem was man braucht.',
 'Kantstraße 78, Berlin', 800.00, 1600.00, 35, 1, 1, 'verfuegbar', '2025-10-20', 'Berlin', '10623', false, true, false, false, NOW()),

-- Rented Apartment
('aaaa0004-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
 'Penthouse mit Dachterrasse',
 'Luxuriöse Penthouse-Wohnung mit atemberaubender Aussicht.',
 'Kurfürstendamm 200, Berlin', 2500.00, 5000.00, 120, 4, 2, 'vermietet', '2025-09-01', 'Berlin', '10719', false, true, true, true, NOW());

-- ============================================================================
-- 3. VIEWING REQUESTS
-- ============================================================================

INSERT INTO viewing_requests (id, apartment_id, requester_id, landlord_id, requested_date, status, payment_status, payment_amount, booking_fee, created_at) VALUES
-- Pending request
('vvvv0001-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '2025-10-10 14:00:00', 'ausstehend', 'pending', 10.00, 10.00, NOW()),

-- Confirmed request
('vvvv0002-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', '2025-10-12 15:00:00', 'bestaetigt', 'paid', 10.00, 10.00, NOW()),

-- Completed request
('vvvv0003-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '2025-10-08 16:00:00', 'abgeschlossen', 'paid', 10.00, 10.00, NOW());

-- ============================================================================
-- 4. PAYMENT TRANSACTIONS
-- ============================================================================

INSERT INTO payment_transactions (id, user_id, amount, currency, payment_method, transaction_id, status, resource_type, resource_id, description, created_at, completed_at) VALUES
-- Completed payment
('pppp0001-pppp-pppp-pppp-pppppppppppp', '55555555-5555-5555-5555-555555555555', 10.00, 'EUR', 'paypal', 'PAYPAL-TXN-001', 'completed', 'viewing_request', 'vvvv0002-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Viewing request booking fee', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

('pppp0002-pppp-pppp-pppp-pppppppppppp', '66666666-6666-6666-6666-666666666666', 10.00, 'EUR', 'stripe', 'STRIPE-TXN-001', 'completed', 'viewing_request', 'vvvv0003-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Viewing request booking fee', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- ============================================================================
-- 5. MARKETPLACE LISTINGS
-- ============================================================================

INSERT INTO marketplace_listings (id, user_id, title, description, category, condition, price, negotiable, location, status, created_at) VALUES
('mmmm0001-mmmm-mmmm-mmmm-mmmmmmmmmmmm', '44444444-4444-4444-4444-444444444444',
 'IKEA Sofa - Fast wie neu',
 'Komfortables 3-Sitzer Sofa in grau. Nur 6 Monate alt, verkaufe wegen Umzug.',
 'Möbel', 'like_new', 250.00, true, 'Berlin Mitte', 'active', NOW()),

('mmmm0002-mmmm-mmmm-mmmm-mmmmmmmmmmmm', '55555555-5555-5555-5555-555555555555',
 'Waschmaschine Bosch',
 'Voll funktionsfähige Waschmaschine, 2 Jahre alt.',
 'Haushaltsgeräte', 'good', 180.00, true, 'Berlin Prenzlauer Berg', 'active', NOW()),

('mmmm0003-mmmm-mmmm-mmmm-mmmmmmmmmmmm', '66666666-6666-6666-6666-666666666666',
 'Schreibtisch mit Stuhl',
 'Höhenverstellbarer Schreibtisch mit ergonomischem Stuhl.',
 'Möbel', 'good', 120.00, false, 'Berlin Charlottenburg', 'active', NOW());

-- ============================================================================
-- 6. MARKETPLACE CONTACTS
-- ============================================================================

INSERT INTO marketplace_contacts (id, listing_id, buyer_id, seller_id, initial_message, status, created_at) VALUES
('mccc0001-mccc-mccc-mccc-mcccccccccccc', 'mmmm0001-mmmm-mmmm-mmmm-mmmmmmmmmmmm', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444',
 'Hallo, ist das Sofa noch verfügbar? Kann ich es heute abholen?', 'replied', NOW());

-- ============================================================================
-- 7. MARKETPLACE CHATS
-- ============================================================================

INSERT INTO marketplace_chats (id, listing_id, buyer_id, seller_id, status, created_at) VALUES
('chat0001-chat-chat-chat-chatchatcha1', 'mmmm0001-mmmm-mmmm-mmmm-mmmmmmmmmmmm', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'active', NOW());

-- ============================================================================
-- 8. CHAT MESSAGES
-- ============================================================================

INSERT INTO chat_messages (id, chat_id, sender_id, message, message_type, read, created_at) VALUES
('chmg0001-chmg-chmg-chmg-chmgchmgchmg', 'chat0001-chat-chat-chat-chatchatcha1', '22222222-2222-2222-2222-222222222222',
 'Hallo, ist das Sofa noch verfügbar?', 'text', true, NOW() - INTERVAL '1 hour'),

('chmg0002-chmg-chmg-chmg-chmgchmgchmg', 'chat0001-chat-chat-chat-chatchatcha1', '44444444-4444-4444-4444-444444444444',
 'Ja, es ist noch da! Wann möchten Sie es sich ansehen?', 'text', true, NOW() - INTERVAL '50 minutes'),

('chmg0003-chmg-chmg-chmg-chmgchmgchmg', 'chat0001-chat-chat-chat-chatchatcha1', '22222222-2222-2222-2222-222222222222',
 'Ich biete 200 Euro. Was meinen Sie?', 'text', false, NOW() - INTERVAL '30 minutes');

-- ============================================================================
-- 9. CONVERSATIONS
-- ============================================================================

INSERT INTO conversations (id, apartment_id, participant_1_id, participant_2_id, created_at) VALUES
('conv0001-conv-conv-conv-convconvcon1', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', NOW()),
('conv0002-conv-conv-conv-convconvcon2', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', NOW());

-- ============================================================================
-- 10. MESSAGES
-- ============================================================================

INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES
('msg00001-msg0-msg0-msg0-msg0msg0msg1', 'conv0001-conv-conv-conv-convconvcon1', '44444444-4444-4444-4444-444444444444',
 'Hallo, ich interessiere mich für die Wohnung. Sind Haustiere erlaubt?', NOW() - INTERVAL '2 hours'),

('msg00002-msg0-msg0-msg0-msg0msg0msg2', 'conv0001-conv-conv-conv-convconvcon1', '22222222-2222-2222-2222-222222222222',
 'Hallo! Leider sind in dieser Wohnung keine Haustiere erlaubt.', NOW() - INTERVAL '1 hour');

-- ============================================================================
-- 11. OFFERS
-- ============================================================================

INSERT INTO offers (id, apartment_id, tenant_id, landlord_id, offer_amount, move_in_date, lease_duration, message, status, created_at) VALUES
('off00001-off0-off0-off0-off0off0off1', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222',
 1500.00, '2025-11-01', 12, 'Ich würde gerne die Wohnung für 12 Monate mieten.', 'pending', NOW());

-- ============================================================================
-- 12. NOTIFICATIONS
-- ============================================================================

INSERT INTO notifications (id, user_id, type, title, message, read, created_at) VALUES
('notif001-noti-noti-noti-notinotinoti', '44444444-4444-4444-4444-444444444444', 'viewing_confirmed',
 'Besichtigung bestätigt', 'Ihre Besichtigung für "Moderne 2-Zimmer Wohnung" wurde bestätigt.', false, NOW()),

('notif002-noti-noti-noti-notinotinoti', '22222222-2222-2222-2222-222222222222', 'new_message',
 'Neue Nachricht', 'Sie haben eine neue Nachricht von Lisa Weber erhalten.', false, NOW());

-- ============================================================================
-- 13. SUPPORT TICKETS
-- ============================================================================

INSERT INTO support_tickets (id, user_id, subject, description, category, priority, status, created_at) VALUES
('tick0001-tick-tick-tick-tickticktick', '44444444-4444-4444-4444-444444444444',
 'Zahlung nicht durchgegangen',
 'Ich habe versucht, die Besichtigungsgebühr zu bezahlen, aber die Zahlung wurde abgelehnt.',
 'payment', 'high', 'open', NOW());

-- ============================================================================
-- 14. GDPR CONSENTS
-- ============================================================================

INSERT INTO consents (user_id, purpose_id, granted, granted_at)
SELECT u.id, cp.id, true, NOW()
FROM users u
CROSS JOIN consent_purposes cp
WHERE u.gdpr_consent = true;

-- ============================================================================
-- 15. ADMIN AUDIT LOG
-- ============================================================================

INSERT INTO admin_audit_log (admin_id, action, resource_type, resource_id, details, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'user_created', 'user', '44444444-4444-4444-4444-444444444444',
 '{"action": "created_test_user", "username": "tenant_lisa"}', NOW());

-- ============================================================================
-- 16. USER FAVORITES
-- ============================================================================

INSERT INTO user_favorites (user_id, apartment_id, created_at) VALUES
('44444444-4444-4444-4444-444444444444', 'aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW()),
('55555555-5555-5555-5555-555555555555', 'aaaa0002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW()),
('66666666-6666-6666-6666-666666666666', 'aaaa0003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'TEST DATA CREATED SUCCESSFULLY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - 6 Users (1 Admin, 2 Landlords, 3 Tenants)';
    RAISE NOTICE '  - 4 Apartments (3 Available, 1 Rented)';
    RAISE NOTICE '  - 3 Viewing Requests';
    RAISE NOTICE '  - 2 Payment Transactions';
    RAISE NOTICE '  - 3 Marketplace Listings';
    RAISE NOTICE '  - 1 Marketplace Contact';
    RAISE NOTICE '  - 1 Marketplace Chat with 3 Messages';
    RAISE NOTICE '  - 2 Conversations with Messages';
    RAISE NOTICE '  - 1 Rental Offer';
    RAISE NOTICE '  - 2 Notifications';
    RAISE NOTICE '  - 1 Support Ticket';
    RAISE NOTICE '  - GDPR Consents for all users';
    RAISE NOTICE '  - 3 User Favorites';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Accounts:';
    RAISE NOTICE '  Admin:    admin@sichrplace.com';
    RAISE NOTICE '  Landlord: max.mueller@example.com';
    RAISE NOTICE '  Landlord: anna.schmidt@example.com';
    RAISE NOTICE '  Tenant:   lisa.weber@example.com';
    RAISE NOTICE '  Tenant:   tom.fischer@example.com';
    RAISE NOTICE '  Tenant:   sarah.becker@example.com';
    RAISE NOTICE '';
    RAISE NOTICE 'Note: All passwords are hashed. Use your auth system to set real passwords.';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- END OF TEST DATA
-- ============================================================================
