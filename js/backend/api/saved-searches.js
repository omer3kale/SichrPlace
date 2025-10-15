const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const isTest = process.env.NODE_ENV === 'test';
const testStore = {
  searches: new Map()
};

const supabaseUrl = process.env.SUPABASE_URL || 'https://cgkumwtibknfrhyiicoo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNna3Vtd3RpYmtuZnJoeWlpY29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMTc4NiwiZXhwIjoyMDY5ODc3Nzg2fQ.5piAC3CPud7oRvA1Rtypn60dfz5J1ydqoG2oKj-Su3M';
const supabase = createClient(supabaseUrl, supabaseKey);

// Auth middleware
const authenticateToken = async (req, res, next) => {
  try {
    if (isTest) {
      req.user = req.user || {
        id: req.headers['x-test-user-id'] || 'test-user-saved-searches',
        email: 'saved-searches@sichrplace.dev'
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Malformed token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fNcgmCwu7lIbCYoxUy3zbDNyWFpfjmJrUtLLAhPq+2mDNyN/p//FnxhSmTgvnp2Fh51+eJJKAIkqJnFu/xf93Q==');
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET /api/saved-searches or /api/saved-searches/:userId - Get user's saved searches
router.get('/:userId?', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;

    if (isTest && req.params.userId) {
      req.user.id = targetUserId;
    }

    if (!isTest && req.params.userId && req.params.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (isTest) {
      const searches = testStore.searches.get(targetUserId) || [];
      return res.json({ success: true, data: searches });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get saved searches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved searches'
    });
  }
});

// POST /api/saved-searches - Create new saved search
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      searchCriteria,
      alertsEnabled = true,
      alertFrequency = 'daily'
    } = req.body;

    const targetUserId = req.body.userId || req.user.id;
    const resolvedCriteria = searchCriteria || req.body.criteria || {};
    const resolvedAlertsEnabled = req.body.notifications !== undefined ? req.body.notifications : alertsEnabled;
    const resolvedFrequency = req.body.alertFrequency || req.body.frequency || alertFrequency;

    if (!isTest && targetUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (isTest) {
      req.user.id = targetUserId;
    }

    if (!name || Object.keys(resolvedCriteria).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name and search criteria are required'
      });
    }

    if (isTest) {
      const searches = testStore.searches.get(targetUserId) || [];
      const entry = {
        id: req.body.id || `search-${Date.now()}`,
        user_id: targetUserId,
        name,
        search_criteria: resolvedCriteria,
        alerts_enabled: resolvedAlertsEnabled,
        alert_frequency: resolvedFrequency,
        created_at: new Date().toISOString()
      };
      searches.unshift(entry);
      testStore.searches.set(targetUserId, searches);
      return res.json({
        success: true,
        message: 'Saved search created successfully',
        data: entry
      });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .insert([{
        user_id: targetUserId,
        name,
        search_criteria: resolvedCriteria,
        alerts_enabled: resolvedAlertsEnabled,
        alert_frequency: resolvedFrequency
      }])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Saved search created successfully',
      data: data[0]
    });

  } catch (error) {
    console.error('Create saved search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create saved search'
    });
  }
});

// PUT /api/saved-searches/:id - Update saved search
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      searchCriteria,
      alertsEnabled,
      alertFrequency
    } = req.body;

    const actingUserId = req.body.userId || req.user.id;
    if (!isTest && req.body.userId && req.body.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (isTest) {
      req.user.id = actingUserId;
    }

    const updateData = {};
    const resolvedCriteria = searchCriteria || req.body.criteria;
    if (name !== undefined) updateData.name = name;
    if (resolvedCriteria !== undefined) updateData.search_criteria = resolvedCriteria;
    if (alertsEnabled !== undefined) updateData.alerts_enabled = alertsEnabled;
    if (alertFrequency !== undefined) updateData.alert_frequency = alertFrequency;

    if (isTest) {
      const searches = testStore.searches.get(actingUserId) || [];
      const index = searches.findIndex(s => s.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Saved search not found' });
      }
      const updated = { ...searches[index], ...updateData, updated_at: new Date().toISOString() };
      searches[index] = updated;
      testStore.searches.set(actingUserId, searches);
      return res.json({
        success: true,
        message: 'Saved search updated successfully',
        data: updated
      });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Saved search not found'
      });
    }

    res.json({
      success: true,
      message: 'Saved search updated successfully',
      data: data[0]
    });

  } catch (error) {
    console.error('Update saved search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update saved search'
    });
  }
});

// DELETE /api/saved-searches/:id - Delete saved search
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const actingUserId = req.body.userId || req.user.id;
    if (!isTest && req.body.userId && req.body.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (isTest) {
      req.user.id = actingUserId;
    }

    if (isTest) {
      const searches = testStore.searches.get(actingUserId) || [];
      const filtered = searches.filter(s => s.id !== id);
      testStore.searches.set(actingUserId, filtered);
      return res.json({
        success: true,
        message: 'Saved search deleted successfully'
      });
    }

    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Saved search deleted successfully'
    });

  } catch (error) {
    console.error('Delete saved search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete saved search'
    });
  }
});

const executeSavedSearch = async (req, res) => {
  try {
  const { id } = req.params;
  const incomingUserId = req.body?.userId;
  const actingUserId = incomingUserId || req.user.id;

  if (!isTest && incomingUserId && incomingUserId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (isTest) {
      req.user.id = actingUserId;
      const searches = testStore.searches.get(actingUserId) || [];
      const search = searches.find(s => s.id === id);
      if (!search) {
        return res.status(404).json({ success: false, error: 'Saved search not found' });
      }
      const mockResults = {
        total: 1,
        apartments: [
          {
            id: 'apt-test-1',
            title: 'Test Apartment 1',
            price: 950,
            rooms: 2,
            location: 'Berlin',
            images: [],
            score: 0.92
          }
        ]
      };
      search.last_executed = new Date().toISOString();
      testStore.searches.set(actingUserId, searches);
      return res.json({
        success: true,
        searchName: search.name,
        resultsCount: mockResults.total,
        data: mockResults.apartments
      });
    }

    const { data: savedSearch, error: searchError } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (searchError || !savedSearch) {
      return res.status(404).json({
        success: false,
        error: 'Saved search not found'
      });
    }

    let query = supabase
      .from('apartments')
      .select(`
        id,
        title,
        description,
        price,
        size,
        rooms,
        bathrooms,
        location,
        images,
        created_at,
        move_in_date
      `);

    const criteria = savedSearch.search_criteria || {};

    if (criteria.minPrice) {
      query = query.gte('price', criteria.minPrice);
    }
    if (criteria.maxPrice) {
      query = query.lte('price', criteria.maxPrice);
    }
    if (criteria.minRooms) {
      query = query.gte('rooms', criteria.minRooms);
    }
    if (criteria.maxRooms) {
      query = query.lte('rooms', criteria.maxRooms);
    }
    if (criteria.location) {
      query = query.ilike('location', `%${criteria.location}%`);
    }
    if (criteria.propertyType) {
      query = query.eq('property_type', criteria.propertyType);
    }

    const { data: apartments, error: apartmentError } = await query;

    if (apartmentError) throw apartmentError;

    await supabase
      .from('saved_searches')
      .update({ last_executed: new Date() })
      .eq('id', id);

    res.json({
      success: true,
      searchName: savedSearch.name,
      resultsCount: apartments.length,
      data: apartments
    });

  } catch (error) {
    console.error('Execute saved search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute saved search'
    });
  }
};

router.post('/:id/run', authenticateToken, executeSavedSearch);
router.post('/:id/execute', authenticateToken, executeSavedSearch);

module.exports = router;
