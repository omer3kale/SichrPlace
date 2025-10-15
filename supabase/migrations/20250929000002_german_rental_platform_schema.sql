-- 🏠 SICHRPLACE GERMAN RENTAL PLATFORM - COMPREHENSIVE SCHEMA
-- Complete German rental market database with proper terminology
-- Includes: Kaltmiete, Warmmiete, Nebenkosten, Kaution, etc.

-- ===== ENABLE EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For location data

-- ===== CLEAN SLATE - DROP ALL EXISTING TABLES =====
DROP TABLE IF EXISTS apartment_documents CASCADE;
DROP TABLE IF EXISTS apartment_amenities CASCADE;
DROP TABLE IF EXISTS apartment_images CASCADE;
DROP TABLE IF EXISTS energy_certificates CASCADE;
DROP TABLE IF EXISTS landlord_documents CASCADE;
DROP TABLE IF EXISTS tenant_documents CASCADE;
DROP TABLE IF EXISTS rental_applications CASCADE;
DROP TABLE IF EXISTS rental_contracts CASCADE;
DROP TABLE IF EXISTS payment_schedules CASCADE;
DROP TABLE IF EXISTS maintenance_requests CASCADE;
DROP TABLE IF EXISTS property_inspections CASCADE;
DROP TABLE IF EXISTS schufa_checks CASCADE;
DROP TABLE IF EXISTS employment_verifications CASCADE;
DROP TABLE IF EXISTS tenant_references CASCADE;
DROP TABLE IF EXISTS digital_contracts CASCADE;
DROP TABLE IF EXISTS viewing_schedule CASCADE;
DROP TABLE IF EXISTS matching_preferences CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS media_files CASCADE;
DROP TABLE IF EXISTS apartment_reviews CASCADE;
DROP TABLE IF EXISTS apartment_analytics CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
DROP TABLE IF EXISTS gdpr_tracking_logs CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS refund_requests CASCADE;
DROP TABLE IF EXISTS safety_reports CASCADE;
DROP TABLE IF EXISTS support_ticket_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS recently_viewed CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS viewing_requests CASCADE;
DROP TABLE IF EXISTS apartments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===== 1. CORE USER MANAGEMENT =====

-- 1.1 Users Table (Enhanced for German Market)
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    
    -- User Types (German Rental Market)
    role VARCHAR(20) DEFAULT 'mieter' CHECK (role IN ('mieter', 'vermieter', 'admin', 'kundenmanager')),
    user_type VARCHAR(20) DEFAULT 'mieter' CHECK (user_type IN ('mieter', 'vermieter', 'admin', 'kundenmanager')),
    
    -- Personal Information (German Format)
    anrede VARCHAR(10) CHECK (anrede IN ('Herr', 'Frau', 'Divers')),
    titel VARCHAR(20), -- Dr., Prof., etc.
    vorname VARCHAR(100),
    nachname VARCHAR(100),
    geburtsdatum DATE,
    geburtsort VARCHAR(100),
    staatsangehoerigkeit VARCHAR(50) DEFAULT 'Deutsch',
    
    -- Contact Information
    telefon VARCHAR(20),
    mobil VARCHAR(20),
    
    -- Address (German Format)
    strasse VARCHAR(255),
    hausnummer VARCHAR(10),
    zusatz VARCHAR(100), -- c/o, Apt., etc.
    plz VARCHAR(5),
    ort VARCHAR(100),
    bundesland VARCHAR(50),
    land VARCHAR(50) DEFAULT 'Deutschland',
    
    -- Account Status
    email_verified BOOLEAN DEFAULT false,
    verification_token_hash VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN DEFAULT FALSE,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP WITH TIME ZONE,
    
    -- GDPR Compliance
    gdpr_consent BOOLEAN DEFAULT false,
    gdpr_consent_date TIMESTAMP WITH TIME ZONE,
    data_processing_consent BOOLEAN DEFAULT false,
    marketing_consent BOOLEAN DEFAULT false,
    
    -- Profile Enhancement
    profile_image_url TEXT,
    bio TEXT,
    preferred_language VARCHAR(5) DEFAULT 'de-DE',
    preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    
    -- Account Management
    profile_completion_score INTEGER DEFAULT 0 CHECK (profile_completion_score >= 0 AND profile_completion_score <= 100),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending_verification', 'deactivated')),
    suspension_reason TEXT,
    suspended_until TIMESTAMP WITH TIME ZONE,
    
    -- Security
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    verification_level VARCHAR(20) DEFAULT 'basic' CHECK (verification_level IN ('basic', 'verified', 'premium')),
    
    -- Timestamps
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 2. PROPERTY MANAGEMENT (German Rental Market) =====

-- 2.1 Apartments Table (Complete German Rental Schema)
CREATE TABLE apartments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Basic Property Information
    titel VARCHAR(255) NOT NULL,
    beschreibung TEXT NOT NULL,
    
    -- Location (German Address Format)
    strasse VARCHAR(255) NOT NULL,
    hausnummer VARCHAR(10) NOT NULL,
    zusatz VARCHAR(100), -- Apartment number, floor, etc.
    plz VARCHAR(5) NOT NULL,
    ort VARCHAR(100) NOT NULL,
    bundesland VARCHAR(50),
    land VARCHAR(50) DEFAULT 'Deutschland',
    stadtteil VARCHAR(100),
    lage_beschreibung TEXT,
    
    -- Geographic Coordinates
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    location GEOGRAPHY(POINT, 4326),
    
    -- GERMAN RENTAL PRICING STRUCTURE
    -- Kaltmiete (Cold Rent - Base rent without utilities)
    kaltmiete DECIMAL(10,2) NOT NULL,
    
    -- Nebenkosten (Additional Costs)
    nebenkosten_warm DECIMAL(10,2) DEFAULT 0, -- Heating costs
    nebenkosten_kalt DECIMAL(10,2) DEFAULT 0, -- Cold utilities (water, garbage, etc.)
    betriebskosten DECIMAL(10,2) DEFAULT 0, -- Operating costs
    heizkosten DECIMAL(10,2) DEFAULT 0, -- Heating costs (separate)
    
    -- Warmmiete (Warm Rent - Including utilities)
    warmmiete DECIMAL(10,2) GENERATED ALWAYS AS (kaltmiete + COALESCE(nebenkosten_warm, 0) + COALESCE(nebenkosten_kalt, 0)) STORED,
    
    -- Deposits and Fees
    kaution DECIMAL(10,2), -- Security deposit (typically 2-3 months rent)
    kaution_type VARCHAR(20) DEFAULT 'geld' CHECK (kaution_type IN ('geld', 'buergschaft', 'bankgarantie')),
    provision DECIMAL(10,2) DEFAULT 0, -- Commission/broker fee
    provision_type VARCHAR(20) DEFAULT 'prozent' CHECK (provision_type IN ('prozent', 'betrag', 'keine')),
    
    -- Additional Costs
    sonstige_kosten DECIMAL(10,2) DEFAULT 0,
    sonstige_kosten_beschreibung TEXT,
    stellplatz_kosten DECIMAL(10,2) DEFAULT 0,
    garage_kosten DECIMAL(10,2) DEFAULT 0,
    
    -- Property Details
    wohnflaeche INTEGER NOT NULL, -- Living space in sqm
    gesamtflaeche INTEGER, -- Total area in sqm
    zimmer INTEGER NOT NULL,
    schlafzimmer INTEGER,
    badezimmer INTEGER DEFAULT 1,
    gaeste_wc BOOLEAN DEFAULT false,
    balkon_terrasse INTEGER DEFAULT 0, -- Number of balconies/terraces
    balkon_groesse DECIMAL(5,2), -- Balcony size in sqm
    garten BOOLEAN DEFAULT false,
    garten_groesse DECIMAL(10,2), -- Garden size in sqm
    keller BOOLEAN DEFAULT false,
    dachboden BOOLEAN DEFAULT false,
    
    -- Building Information
    etage INTEGER,
    etagen_gesamt INTEGER,
    aufzug BOOLEAN DEFAULT false,
    baujahr INTEGER,
    saniert_jahr INTEGER,
    bauweise VARCHAR(50), -- Massivbau, Fertigbau, etc.
    denkmalschutz BOOLEAN DEFAULT false,
    
    -- Energy Information (German Energy Certificate)
    energieausweis_typ VARCHAR(20) CHECK (energieausweis_typ IN ('verbrauch', 'bedarf')),
    energieeffizienzklasse VARCHAR(5), -- A+, A, B, C, D, E, F, G, H
    energieverbrauch DECIMAL(6,2), -- kWh/m²*a
    heizungsart VARCHAR(50), -- Zentralheizung, Gasetagenheizung, etc.
    heizungsart_detail TEXT,
    warmwasser VARCHAR(50), -- zentral, dezentral
    energietraeger VARCHAR(50), -- Gas, Öl, Strom, Fernwärme, etc.
    
    -- Amenities & Features
    moebliert BOOLEAN DEFAULT false,
    moebliert_typ VARCHAR(20) CHECK (moebliert_typ IN ('unmoebliert', 'teilmoebliert', 'vollmoebliert')),
    kueche VARCHAR(20) CHECK (kueche IN ('keine', 'pantry', 'kochnische', 'einbaukueche', 'offene_kueche')),
    kueche_ausstattung TEXT[],
    bad_ausstattung TEXT[], -- Badewanne, Dusche, Fenster, etc.
    
    -- Technical Features
    internet BOOLEAN DEFAULT false,
    internet_geschwindigkeit VARCHAR(20),
    kabel_tv BOOLEAN DEFAULT false,
    smart_home BOOLEAN DEFAULT false,
    sicherheit TEXT[], -- Alarmanlage, Videoüberwachung, etc.
    
    -- Parking & Storage
    stellplatz VARCHAR(20) CHECK (stellplatz IN ('keiner', 'tiefgarage', 'carport', 'freiplatz')),
    stellplaetze_anzahl INTEGER DEFAULT 0,
    garage BOOLEAN DEFAULT false,
    
    -- Pet & Smoking Policy
    haustiere VARCHAR(20) DEFAULT 'nach_vereinbarung' CHECK (haustiere IN ('nicht_erlaubt', 'kleine_tiere', 'alle_tiere', 'nach_vereinbarung')),
    rauchen VARCHAR(20) DEFAULT 'nicht_erlaubt' CHECK (rauchen IN ('nicht_erlaubt', 'erlaubt', 'nur_balkon')),
    
    -- Rental Terms
    verfuegbar_ab DATE,
    verfuegbar_bis DATE,
    mindestmietdauer INTEGER, -- Minimum rental duration in months
    hoechstmietdauer INTEGER, -- Maximum rental duration in months
    mietvertrag_typ VARCHAR(20) DEFAULT 'unbefristet' CHECK (mietvertrag_typ IN ('befristet', 'unbefristet', 'zwischenmiete')),
    
    -- Property Status
    status VARCHAR(20) DEFAULT 'verfuegbar' CHECK (status IN ('verfuegbar', 'vermietet', 'reserviert', 'wartung', 'offline')),
    vermietung_typ VARCHAR(20) DEFAULT 'langzeit' CHECK (vermietung_typ IN ('langzeit', 'kurzzeitmiete', 'zwischenmiete', 'wg_zimmer')),
    
    -- Landlord Information
    vermieter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    verwaltung_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Property management company
    
    -- Media & Documentation
    bilder TEXT[] DEFAULT '{}',
    grundriss_url TEXT,
    video_url TEXT,
    virtual_tour_url TEXT,
    dokumente TEXT[] DEFAULT '{}',
    
    -- Location Features
    oeffentliche_verkehrsmittel TEXT[],
    einkaufsmoeglichkeiten TEXT[],
    schulen_kitas TEXT[],
    aerzte_apotheken TEXT[],
    restaurants_cafes TEXT[],
    sport_freizeit TEXT[],
    
    -- House Rules & Additional Info
    hausordnung TEXT[],
    besonderheiten TEXT,
    sonstiges TEXT,
    
    -- Analytics & Performance
    featured BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    verification_status VARCHAR(20) DEFAULT 'ausstehend' CHECK (verification_status IN ('ausstehend', 'geprueft', 'abgelehnt')),
    verification_notes TEXT,
    average_rating DECIMAL(3,2) DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    inquiry_count INTEGER DEFAULT 0,
    
    -- Administrative
    admin_notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 3. VIEWING & COMMUNICATION SYSTEM =====

-- 3.1 Viewing Requests (German Market)
CREATE TABLE viewing_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    mieter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vermieter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Request Status
    status VARCHAR(20) DEFAULT 'ausstehend' CHECK (status IN ('ausstehend', 'bestaetigt', 'abgeschlossen', 'storniert', 'zahlung_erforderlich')),
    
    -- Preferred Dates
    wunschdatum_1 TIMESTAMP WITH TIME ZONE NOT NULL,
    wunschdatum_2 TIMESTAMP WITH TIME ZONE,
    wunschdatum_3 TIMESTAMP WITH TIME ZONE,
    bestaetigter_termin TIMESTAMP WITH TIME ZONE,
    
    -- Request Details
    nachricht TEXT,
    kontakt_telefon VARCHAR(20),
    kontakt_email VARCHAR(255),
    anzahl_personen INTEGER DEFAULT 1,
    besondere_wuensche TEXT,
    
    -- Service Fee (German Market Standard)
    besichtigungsgebuehr DECIMAL(10,2) DEFAULT 25.00,
    gebuehr_bezahlt BOOLEAN DEFAULT false,
    zahlung_erforderlich BOOLEAN DEFAULT true,
    zahlung_status VARCHAR(20) DEFAULT 'ausstehend' CHECK (zahlung_status IN ('ausstehend', 'bezahlt', 'fehlgeschlagen', 'rueckerstattet')),
    
    -- Customer Manager Assignment
    kundenmanager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Cancellation
    stornierungsgrund TEXT,
    storniert_von UUID REFERENCES users(id) ON DELETE SET NULL,
    storniert_am TIMESTAMP WITH TIME ZONE,
    
    -- Completion & Rating
    abschluss_notizen TEXT,
    bewertung INTEGER CHECK (bewertung >= 1 AND bewertung <= 5),
    
    -- Payment Reference
    payment_transaction_id UUID, -- Will reference payment_transactions table
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 Conversations
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    participant_1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    participants UUID[] DEFAULT ARRAY[]::UUID[],
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'archiviert', 'gesperrt')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, participant_1_id, participant_2_id)
);

-- 3.3 Messages
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    read_by_recipient BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    language VARCHAR(5) DEFAULT 'de-DE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 4. PAYMENT & TRANSACTION SYSTEM =====

-- 4.1 Payment Transactions
CREATE TABLE payment_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_id VARCHAR(255) NOT NULL UNIQUE,
    payer_id VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    apartment_id UUID REFERENCES apartments(id) ON DELETE SET NULL,
    
    -- Payment Details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(50) DEFAULT 'paypal',
    payment_purpose VARCHAR(100) DEFAULT 'besichtigungsgebuehr',
    
    -- Transaction Status
    status VARCHAR(20) DEFAULT 'ausstehend' CHECK (status IN ('ausstehend', 'erstellt', 'genehmigt', 'abgeschlossen', 'storniert', 'fehlgeschlagen', 'rueckerstattet')),
    gateway_status VARCHAR(50),
    transaction_id VARCHAR(255),
    gateway_response JSONB,
    
    -- Fees & Calculations
    fees DECIMAL(10,2),
    net_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    refund_amount DECIMAL(10,2)
);

-- Add foreign key reference for viewing_requests
ALTER TABLE viewing_requests ADD CONSTRAINT fk_payment_transaction 
    FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL;

-- ===== 5. USER EXPERIENCE FEATURES =====

-- 5.1 User Favorites
CREATE TABLE user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    notizen TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- 5.2 Saved Searches
CREATE TABLE saved_searches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    search_criteria JSONB NOT NULL,
    alerts_enabled BOOLEAN DEFAULT true,
    last_alert_sent TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5.3 Recently Viewed
CREATE TABLE recently_viewed (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apartment_id)
);

-- 5.4 Reviews
CREATE TABLE reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    viewing_request_id UUID REFERENCES viewing_requests(id) ON DELETE SET NULL,
    
    -- Rating Details
    gesamtbewertung INTEGER NOT NULL CHECK (gesamtbewertung >= 1 AND gesamtbewertung <= 5),
    vermieter_bewertung INTEGER CHECK (vermieter_bewertung >= 1 AND vermieter_bewertung <= 5),
    lage_bewertung INTEGER CHECK (lage_bewertung >= 1 AND lage_bewertung <= 5),
    preis_leistung_bewertung INTEGER CHECK (preis_leistung_bewertung >= 1 AND preis_leistung_bewertung <= 5),
    ausstattung_bewertung INTEGER CHECK (ausstattung_bewertung >= 1 AND ausstattung_bewertung <= 5),
    
    -- Review Content
    titel VARCHAR(255),
    kommentar TEXT,
    vorteile TEXT,
    nachteile TEXT,
    empfehlung BOOLEAN,
    
    -- Review Management
    status VARCHAR(20) DEFAULT 'ausstehend' CHECK (status IN ('ausstehend', 'genehmigt', 'abgelehnt')),
    moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderation_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, user_id)
);

-- 5.5 Notifications
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('niedrig', 'normal', 'hoch', 'dringend')),
    language VARCHAR(5) DEFAULT 'de-DE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ===== 6. PERFORMANCE INDEXES =====

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_plz ON users(plz);
CREATE INDEX idx_users_ort ON users(ort);
CREATE INDEX idx_users_verification_token_hash ON users(verification_token_hash);

-- Apartments indexes
CREATE INDEX idx_apartments_vermieter_id ON apartments(vermieter_id);
CREATE INDEX idx_apartments_status ON apartments(status);
CREATE INDEX idx_apartments_plz ON apartments(plz);
CREATE INDEX idx_apartments_ort ON apartments(ort);
CREATE INDEX idx_apartments_kaltmiete ON apartments(kaltmiete);
CREATE INDEX idx_apartments_warmmiete ON apartments(warmmiete);
CREATE INDEX idx_apartments_zimmer ON apartments(zimmer);
CREATE INDEX idx_apartments_wohnflaeche ON apartments(wohnflaeche);
CREATE INDEX idx_apartments_featured ON apartments(featured);
CREATE INDEX idx_apartments_verfuegbar_ab ON apartments(verfuegbar_ab);
CREATE INDEX idx_apartments_created_at ON apartments(created_at DESC);
CREATE INDEX idx_apartments_location ON apartments USING GIST(location);

-- Viewing requests indexes
CREATE INDEX idx_viewing_requests_apartment_id ON viewing_requests(apartment_id);
CREATE INDEX idx_viewing_requests_mieter_id ON viewing_requests(mieter_id);
CREATE INDEX idx_viewing_requests_vermieter_id ON viewing_requests(vermieter_id);
CREATE INDEX idx_viewing_requests_status ON viewing_requests(status);
CREATE INDEX idx_viewing_requests_bestaetigter_termin ON viewing_requests(bestaetigter_termin);

-- Communication indexes
CREATE INDEX idx_conversations_apartment_id ON conversations(apartment_id);
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Payment indexes
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- User experience indexes
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_apartment_id ON user_favorites(apartment_id);
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX idx_reviews_apartment_id ON reviews(apartment_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ===== 7. TRIGGERS FOR AUTO-UPDATES =====

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apartments_updated_at BEFORE UPDATE ON apartments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_viewing_requests_updated_at BEFORE UPDATE ON viewing_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON saved_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== 8. ROW LEVEL SECURITY =====

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can view available apartments" ON apartments
    FOR SELECT USING (status = 'verfuegbar');

CREATE POLICY "Landlords can manage own apartments" ON apartments
    FOR ALL USING (auth.uid() = vermieter_id);

CREATE POLICY "Users can view own viewing requests" ON viewing_requests
    FOR SELECT USING (auth.uid() = mieter_id OR auth.uid() = vermieter_id);

CREATE POLICY "Users can create viewing requests" ON viewing_requests
    FOR INSERT WITH CHECK (auth.uid() = mieter_id);

-- ===== 9. SAMPLE DATA WITH GERMAN RENTAL EXAMPLES =====

-- Create test users
INSERT INTO users (
    username, email, password, role, user_type, anrede, vorname, nachname,
    plz, ort, email_verified, verified, gdpr_consent, data_processing_consent,
    profile_completion_score
) VALUES
-- Admin User
('sichrplace_admin', 'admin@sichrplace.com', '$2b$12$LQv3c1yqBwEHxE6FuY4Jvu9HxgX9VrIqsUXdGP9E2QVGfKJ8qKjlq', 
 'admin', 'admin', 'Herr', 'Admin', 'SichrPlace', '50667', 'Köln', true, true, true, true, 100),

-- Sample Landlord
('vermieter_koeln', 'vermieter@test.com', '$2b$12$LQv3c1yqBwEHxE6FuY4Jvu9HxgX9VrIqsUXdGP9E2QVGfKJ8qKjlq',
 'vermieter', 'vermieter', 'Frau', 'Maria', 'Müller', '50667', 'Köln', true, true, true, true, 90),

-- Sample Tenant
('mieter_student', 'mieter@test.com', '$2b$12$LQv3c1yqBwEHxE6FuY4Jvu9HxgX9VrIqsUXdGP9E2QVGfKJ8qKjlq',
 'mieter', 'mieter', 'Herr', 'Max', 'Schmidt', '52062', 'Aachen', true, true, true, true, 75)
ON CONFLICT (email) DO NOTHING;

-- Sample Apartments with German Rental Structure
INSERT INTO apartments (
    titel, beschreibung, strasse, hausnummer, plz, ort, bundesland,
    kaltmiete, nebenkosten_warm, nebenkosten_kalt, kaution, kaution_type,
    wohnflaeche, zimmer, schlafzimmer, badezimmer,
    vermieter_id, etage, etagen_gesamt, aufzug, baujahr,
    energieeffizienzklasse, heizungsart, energietraeger,
    moebliert_typ, kueche, haustiere, rauchen,
    verfuegbar_ab, status, vermietung_typ,
    bilder, oeffentliche_verkehrsmittel, einkaufsmoeglichkeiten
) VALUES
(
    'Moderne 3-Zimmer-Wohnung in Köln-Innenstadt',
    'Schöne, helle 3-Zimmer-Wohnung in zentraler Lage von Köln. Renoviert, mit Einbauküche und Balkon. Perfekt für Berufstätige oder kleine Familien.',
    'Hohe Straße', '123', '50667', 'Köln', 'Nordrhein-Westfalen',
    1200.00, 180.00, 120.00, 2400.00, 'geld',
    85, 3, 2, 1,
    (SELECT id FROM users WHERE email = 'vermieter@test.com' LIMIT 1),
    3, 5, true, 2010,
    'B', 'Zentralheizung', 'Gas',
    'unmoebliert', 'einbaukueche', 'kleine_tiere', 'nur_balkon',
    CURRENT_DATE + INTERVAL '2 weeks', 'verfuegbar', 'langzeit',
    ARRAY['/img/koeln1.jpg', '/img/koeln2.jpg', '/img/koeln3.jpg'],
    ARRAY['U-Bahn Dom/Hbf 5 Min', 'Bus 140 vor der Tür', 'Straßenbahn 1,7,9'],
    ARRAY['REWE 2 Min zu Fuß', 'Hohe Straße Einkaufszone', 'Schildergasse']
),
(
    'Studenten-Apartment nahe Universität Köln',
    'Gemütliches 1-Zimmer-Apartment, perfekt für Studenten. Vollmöbliert mit Küchenzeile und eigenem Bad. Alle Nebenkosten inklusive.',
    'Universitätsstraße', '45', '50931', 'Köln', 'Nordrhein-Westfalen',
    550.00, 0.00, 0.00, 1100.00, 'geld',
    32, 1, 0, 1,
    (SELECT id FROM users WHERE email = 'vermieter@test.com' LIMIT 1),
    2, 4, false, 1995,
    'C', 'Gasetagenheizung', 'Gas',
    'vollmoebliert', 'kochnische', 'nicht_erlaubt', 'nicht_erlaubt',
    CURRENT_DATE + INTERVAL '1 month', 'verfuegbar', 'langzeit',
    ARRAY['/img/student1.jpg', '/img/student2.jpg'],
    ARRAY['Bus zur Uni 10 Min', 'Stadtbahn Linie 9'],
    ARRAY['Aldi 3 Min', 'Apotheke um die Ecke']
)
ON CONFLICT DO NOTHING;

-- ===== 10. SUCCESS MESSAGE =====
DO $$
BEGIN
    RAISE NOTICE '🏠 SICHRPLACE GERMAN RENTAL PLATFORM SCHEMA COMPLETED! 🏠';
    RAISE NOTICE '✅ German rental terminology implemented (Kaltmiete, Warmmiete, Nebenkosten, Kaution)';
    RAISE NOTICE '✅ Complete property pricing structure with automatic Warmmiete calculation';
    RAISE NOTICE '✅ German address format and user data structure';
    RAISE NOTICE '✅ Energy certificate and building information';
    RAISE NOTICE '✅ Comprehensive amenities and property features';
    RAISE NOTICE '✅ Payment system with German rental fees';
    RAISE NOTICE '✅ Viewing request system with service fees';
    RAISE NOTICE '✅ Sample data with realistic German rental properties';
    RAISE NOTICE '🚀 Ready for German rental market operations!';
END $$;