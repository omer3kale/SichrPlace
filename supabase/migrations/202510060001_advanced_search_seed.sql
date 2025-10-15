-- Advanced search schema enhancements for German rental filters
-- Adds missing columns for cold/warm rent, bed configuration, amenities, and viewing slots
-- Seeds representative apartment records exposing the new metadata so demos/tests have realistic data

-- === Column alignment ===
-- Ensure the apartments table exposes the fields consumed by advanced search services
ALTER TABLE apartments
    ADD COLUMN IF NOT EXISTS kaltmiete DECIMAL(10,2);

ALTER TABLE apartments
    ADD COLUMN IF NOT EXISTS warmmiete DECIMAL(10,2);

ALTER TABLE apartments
    ADD COLUMN IF NOT EXISTS single_beds INTEGER;

ALTER TABLE apartments
    ADD COLUMN IF NOT EXISTS double_beds INTEGER;

ALTER TABLE apartments
    ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;

ALTER TABLE apartments
    ALTER COLUMN amenities SET DEFAULT '[]'::jsonb;

ALTER TABLE apartments
    ADD COLUMN IF NOT EXISTS timeslot_type VARCHAR(20) CHECK (timeslot_type IN ('flexible', 'fixed'));

-- Backfill existing listings so new columns are populated with sensible defaults
UPDATE apartments
SET kaltmiete = price
WHERE kaltmiete IS NULL;

UPDATE apartments
SET warmmiete = COALESCE(warmmiete, price);

UPDATE apartments
SET amenities = '[]'::jsonb
WHERE amenities IS NULL;

UPDATE apartments
SET timeslot_type = COALESCE(timeslot_type, 'flexible');

-- Provide deterministic defaults for bed metadata when rooms/bedrooms exist
UPDATE apartments
SET single_beds = COALESCE(single_beds, GREATEST(rooms - COALESCE(bedrooms, 1), 0))
WHERE single_beds IS NULL;

UPDATE apartments
SET double_beds = COALESCE(double_beds, GREATEST(COALESCE(bedrooms, rooms / 2), 0))
WHERE double_beds IS NULL;

-- === Demo landlord account ===
WITH upsert_user AS (
    SELECT id
    FROM users
    WHERE email = 'advanced-search-demo@sichrplace.test'

    UNION ALL

    SELECT id
    FROM (
        INSERT INTO users (
            username,
            email,
            password,
            role,
            user_type,
            first_name,
            last_name,
            email_verified,
            verified,
            gdpr_consent,
            gdpr_consent_date,
            data_processing_consent,
            created_at,
            updated_at
        )
        VALUES (
            'advanced_search_demo',
            'advanced-search-demo@sichrplace.test',
            '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt("password")
            'landlord',
            'landlord',
            'Demo',
            'Landlord',
            true,
            true,
            true,
            NOW(),
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO UPDATE
        SET
            role = EXCLUDED.role,
            user_type = EXCLUDED.user_type,
            email_verified = true,
            verified = true,
            updated_at = NOW()
        RETURNING id
    ) inserted
    LIMIT 1
)
-- === Seed apartments with full German metadata ===
INSERT INTO apartments (
    title,
    description,
    location,
    address,
    city,
    state,
    postal_code,
    country,
    price,
    kaltmiete,
    warmmiete,
    size,
    rooms,
    bedrooms,
    bathrooms,
    single_beds,
    double_beds,
    amenities,
    nearby_amenities,
    timeslot_type,
    status,
    available_from,
    available_until,
    furnished,
    pet_friendly,
    balcony,
    parking,
    elevator,
    garden,
    heating_type,
    energy_rating,
    deposit,
    utilities_included,
    internet_included,
    owner_id,
    images,
    house_rules,
    created_at,
    updated_at
)
SELECT
    'Berlin Familienwohnung mit Balkon',
    'Lichtdurchflutete 4-Zimmer-Wohnung in Berlin-Mitte mit großem Balkon und moderner Küche. Perfekt für Familien mit Bedarf an getrennten Schlafbereichen.',
    'Berlin, Mitte',
    'Weinbergsweg 24',
    'Berlin',
    'Berlin',
    '10119',
    'Germany',
    1350,
    1350,
    1550,
    105,
    4,
    3,
    2,
    2,
    1,
    '["wifi","washing_machine","dishwasher","heating","private_bathroom","balcony"]'::jsonb,
    ARRAY['U-Bahn Rosenthaler Platz (2 Min.)','Kinderspielplatz direkt vor der Tür','Bio-Supermarkt 5 Min. Fußweg'],
    'flexible',
    'available',
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_DATE + INTERVAL '12 months',
    true,
    true,
    true,
    false,
    true,
    false,
    'district heating',
    'B',
    4050,
    false,
    true,
    upsert_user.id,
    ARRAY['https://demo.sichrplace.com/img/berlin-family-1.jpg','https://demo.sichrplace.com/img/berlin-family-2.jpg'],
    ARRAY['Keine Partys nach 22 Uhr','Nichtraucherwohnung'],
    NOW(),
    NOW()
FROM upsert_user
WHERE NOT EXISTS (
    SELECT 1 FROM apartments WHERE title = 'Berlin Familienwohnung mit Balkon'
);

WITH upsert_user AS (
    SELECT id FROM users WHERE email = 'advanced-search-demo@sichrplace.test'
)
INSERT INTO apartments (
    title,
    description,
    location,
    address,
    city,
    state,
    postal_code,
    country,
    price,
    kaltmiete,
    warmmiete,
    size,
    rooms,
    bedrooms,
    bathrooms,
    single_beds,
    double_beds,
    amenities,
    nearby_amenities,
    timeslot_type,
    status,
    available_from,
    available_until,
    furnished,
    pet_friendly,
    balcony,
    parking,
    elevator,
    garden,
    heating_type,
    energy_rating,
    deposit,
    utilities_included,
    internet_included,
    owner_id,
    images,
    house_rules,
    created_at,
    updated_at
)
SELECT
    'München Business Loft am Isartor',
    'Exklusives Loft in zentraler Lage mit Homeoffice-Zone, Blick auf die Isar und Tiefgaragenstellplatz. Ideal für Wochenpendler:innen.',
    'Munich, Altstadt-Lehel',
    'Thomas-Wimmer-Ring 12',
    'Munich',
    'Bavaria',
    '80539',
    'Germany',
    1750,
    1750,
    2050,
    87,
    3,
    2,
    2,
    1,
    1,
    '["wifi","air_conditioning","dishwasher","heating","private_bathroom","lift","parking"]'::jsonb,
    ARRAY['S-Bahn Isartor 1 Min.','Isarufer für Jogger','Premium-Supermarkt im Haus'],
    'fixed',
    'available',
    CURRENT_DATE + INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '18 months',
    true,
    false,
    true,
    true,
    true,
    false,
    'floor heating',
    'A',
    5250,
    false,
    true,
    upsert_user.id,
    ARRAY['https://demo.sichrplace.com/img/munich-loft-1.jpg','https://demo.sichrplace.com/img/munich-loft-2.jpg'],
    ARRAY['Haustiere nur nach Absprache','Keine lauten Meetings nach 21 Uhr'],
    NOW(),
    NOW()
FROM upsert_user
WHERE NOT EXISTS (
    SELECT 1 FROM apartments WHERE title = 'München Business Loft am Isartor'
);

WITH upsert_user AS (
    SELECT id FROM users WHERE email = 'advanced-search-demo@sichrplace.test'
)
INSERT INTO apartments (
    title,
    description,
    location,
    address,
    city,
    state,
    postal_code,
    country,
    price,
    kaltmiete,
    warmmiete,
    size,
    rooms,
    bedrooms,
    bathrooms,
    single_beds,
    double_beds,
    amenities,
    nearby_amenities,
    timeslot_type,
    status,
    available_from,
    available_until,
    furnished,
    pet_friendly,
    balcony,
    parking,
    elevator,
    garden,
    heating_type,
    energy_rating,
    deposit,
    utilities_included,
    internet_included,
    owner_id,
    images,
    house_rules,
    created_at,
    updated_at
)
SELECT
    'Hamburg Studentenwohnung nahe Uni',
    'Praktische 2-Zimmer-Wohnung in Harvestehude mit schneller Anbindung zur Universität. Möbliert, WLAN inklusive und sofort bezugsfertig.',
    'Hamburg, Harvestehude',
    'Rothenbaumchaussee 74',
    'Hamburg',
    'Hamburg',
    '20148',
    'Germany',
    890,
    890,
    1030,
    58,
    2,
    1,
    1,
    1,
    0,
    '["wifi","washing_machine","heating","kitchen","private_bathroom","balcony"]'::jsonb,
    ARRAY['Uni Hamburg 4 Min.','StadtRAD Station vor der Tür','Wochenmarkt Turmweg'],
    'flexible',
    'available',
    CURRENT_DATE + INTERVAL '7 days',
    CURRENT_DATE + INTERVAL '9 months',
    true,
    false,
    true,
    false,
    false,
    false,
    'central heating',
    'C',
    2670,
    true,
    true,
    upsert_user.id,
    ARRAY['https://demo.sichrplace.com/img/hamburg-students-1.jpg','https://demo.sichrplace.com/img/hamburg-students-2.jpg'],
    ARRAY['Rauchen nur auf dem Balkon','Keine Haustiere'],
    NOW(),
    NOW()
FROM upsert_user
WHERE NOT EXISTS (
    SELECT 1 FROM apartments WHERE title = 'Hamburg Studentenwohnung nahe Uni'
);
