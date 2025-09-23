-- STEP 5: Advanced Search & Analytics (OPTIONAL ENHANCEMENT)
-- Execute this AFTER Step 4 is complete and working

-- Search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Popular searches tracking
CREATE TABLE IF NOT EXISTS popular_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query TEXT UNIQUE NOT NULL,
    search_count INTEGER DEFAULT 1,
    last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced location data for geospatial search
CREATE TABLE IF NOT EXISTS locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255),
    country VARCHAR(255) DEFAULT 'Germany',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    zoom_level INTEGER DEFAULT 12,
    apartment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, state, country)
);

-- Search autocomplete suggestions
CREATE TABLE IF NOT EXISTS search_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    suggestion TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'general', -- 'location', 'amenity', 'property_type', 'general'
    search_count INTEGER DEFAULT 0,
    relevance_score DECIMAL(3,2) DEFAULT 1.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_popular_searches_count ON popular_searches(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_category ON search_suggestions(category);

-- Enable RLS
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE popular_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own search analytics" ON search_analytics
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can view popular searches" ON popular_searches
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view locations" ON locations
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view active suggestions" ON search_suggestions
    FOR SELECT USING (is_active = true);

-- Insert some sample German cities
INSERT INTO locations (city, state, country, latitude, longitude) VALUES
('Berlin', 'Berlin', 'Germany', 52.5200, 13.4050),
('Hamburg', 'Hamburg', 'Germany', 53.5511, 9.9937),
('Munich', 'Bavaria', 'Germany', 48.1351, 11.5820),
('Cologne', 'North Rhine-Westphalia', 'Germany', 50.9375, 6.9603),
('Frankfurt', 'Hesse', 'Germany', 50.1109, 8.6821),
('Stuttgart', 'Baden-Württemberg', 'Germany', 48.7758, 9.1829),
('Düsseldorf', 'North Rhine-Westphalia', 'Germany', 51.2277, 6.7735),
('Dortmund', 'North Rhine-Westphalia', 'Germany', 51.5136, 7.4653),
('Essen', 'North Rhine-Westphalia', 'Germany', 51.4556, 7.0116),
('Leipzig', 'Saxony', 'Germany', 51.3397, 12.3731)
ON CONFLICT (city, state, country) DO NOTHING;

-- Success message
SELECT 'Step 5 Advanced Search Schema created successfully!' as status;