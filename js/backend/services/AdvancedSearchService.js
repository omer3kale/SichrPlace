const { supabase } = require('../config/supabase');

class AdvancedSearchService {
  /**
   * Advanced apartment search with comprehensive filtering
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Search results with metadata
   */
  static async searchApartments(searchParams = {}) {
    const startTime = Date.now();
    
    try {
      const {
        query = '',
        keywords = '',
        location = '',
        city = '',
        area = '',
        minPrice = 0,
        maxPrice = null,
        minKaltmiete = null,
        maxKaltmiete = null,
        minWarmmiete = null,
        maxWarmmiete = null,
        priceType = 'both',
        minRooms = null,
        maxRooms = null,
        rooms = null,
        bedrooms = null,
        bathrooms = null,
        singleBeds = null,
        doubleBeds = null,
        minSize = null,
        maxSize = null,
        propertyType = '',
        furnishedStatus = '',
        petsAllowed = null,
        excludeExchange = false,
        parkingType = '',
        amenities = [],
        locationFeatures = [],
        moveInDate = null,
        moveOutDate = null,
        timeSlotType = '',
        earliestMoveIn = false,
        sortBy = 'created_at',
        sortOrder = 'desc',
        limit = 20,
        offset = 0,
        userId = null,
        includeUnavailable = false
      } = searchParams;

      let queryBuilder = supabase
        .from('apartments')
        .select(`
          *,
          owner:users!apartments_owner_id_fkey(
            id,
            username,
            first_name,
            last_name,
            email
          )
        `);

      // Apply filters
      if (!includeUnavailable) {
        queryBuilder = queryBuilder.eq('status', 'available');
      }

      // Text search (title, description, location, city)
      const searchTerms = [query, keywords].filter(Boolean)
        .map(term => term.toString().trim())
        .filter(term => term.length > 0)
        .map(term => term.replace(/%/g, ''));

      if (searchTerms.length > 0) {
        const clauses = new Set();
        searchTerms.forEach(term => {
          const likeTerm = `%${term}%`;
          clauses.add(`title.ilike.${likeTerm}`);
          clauses.add(`description.ilike.${likeTerm}`);
          clauses.add(`location.ilike.${likeTerm}`);
          clauses.add(`city.ilike.${likeTerm}`);
          clauses.add(`address.ilike.${likeTerm}`);
        });
        queryBuilder = queryBuilder.or(Array.from(clauses).join(','));
      }

      // Location filters
      if (location) {
        queryBuilder = queryBuilder.ilike('location', `%${location}%`);
      }
      if (city) {
        queryBuilder = queryBuilder.ilike('ort', `%${city}%`);
      }
      if (area) {
        queryBuilder = queryBuilder.ilike('stadtteil', `%${area}%`);
      }

      // German rental price filters
      const normalizedPriceType = ['kalt', 'warm', 'both'].includes((priceType || '').toLowerCase())
        ? priceType.toLowerCase()
        : 'both';

      if (normalizedPriceType === 'kalt' || normalizedPriceType === 'both') {
        if (minKaltmiete) {
          queryBuilder = queryBuilder.gte('kaltmiete', minKaltmiete);
        }
        if (maxKaltmiete) {
          queryBuilder = queryBuilder.lte('kaltmiete', maxKaltmiete);
        }
      }

      if (normalizedPriceType === 'warm' || normalizedPriceType === 'both') {
        if (minWarmmiete) {
          queryBuilder = queryBuilder.gte('warmmiete', minWarmmiete);
        }
        if (maxWarmmiete) {
          queryBuilder = queryBuilder.lte('warmmiete', maxWarmmiete);
        }
      }

      if (!minKaltmiete && minPrice > 0) {
        queryBuilder = queryBuilder.gte('price', minPrice);
      }
      if (!maxKaltmiete && maxPrice) {
        queryBuilder = queryBuilder.lte('price', maxPrice);
      }

      // Room filters
      if (minRooms) {
        queryBuilder = queryBuilder.gte('rooms', minRooms);
      }
      if (maxRooms) {
        queryBuilder = queryBuilder.lte('rooms', maxRooms);
      }
      if (rooms) {
        queryBuilder = queryBuilder.eq('rooms', rooms);
      }

      // Bedroom filter
      if (bedrooms) {
        queryBuilder = queryBuilder.gte('bedrooms', bedrooms);
      }

      // Bathroom filter
      if (bathrooms) {
        queryBuilder = queryBuilder.gte('bathrooms', bathrooms);
      }

      // Bed configuration filters
      if (singleBeds) {
        queryBuilder = queryBuilder.eq('single_beds', singleBeds);
      }
      if (doubleBeds) {
        queryBuilder = queryBuilder.eq('double_beds', doubleBeds);
      }

      // Size filters
      if (minSize) {
        queryBuilder = queryBuilder.gte('size', minSize);
      }
      if (maxSize) {
        queryBuilder = queryBuilder.lte('size', maxSize);
      }

      // Property type filter (using description or title search since no property_type column)
      if (propertyType) {
        const normalizedType = propertyType.toString().toLowerCase().replace(/[\s-]+/g, '_');
        queryBuilder = queryBuilder.eq('property_type', normalizedType);
      }

      // Furnished status
      if (furnishedStatus) {
        queryBuilder = queryBuilder.eq('furnished_status', furnishedStatus);
      }

      // Pet policy
      if (petsAllowed === true) {
        queryBuilder = queryBuilder.eq('pets_policy', 'allowed');
      } else if (petsAllowed === false) {
        queryBuilder = queryBuilder.eq('pets_policy', 'not_allowed');
      }

      // Parking
      if (parkingType) {
        queryBuilder = queryBuilder.eq('parking_type', parkingType);
      }

      // Date filters
      if (moveInDate) {
        queryBuilder = queryBuilder.or(`available_from.is.null,available_from.lte.${moveInDate}`);
      }
      if (moveOutDate) {
        queryBuilder = queryBuilder.or(`available_to.is.null,available_to.gte.${moveOutDate}`);
      }
      if (timeSlotType) {
        queryBuilder = queryBuilder.eq('timeslot_type', timeSlotType);
      }

      if (excludeExchange) {
        queryBuilder = queryBuilder.neq('listing_type', 'exchange');
      }

      // Amenities filter (if amenities field exists as JSONB array)
      if (amenities && amenities.length > 0) {
        // This assumes amenities are stored as a JSONB array
        for (const amenity of amenities) {
          queryBuilder = queryBuilder.contains('amenities', [amenity]);
        }
      }

      // Sorting
      const sortFieldMapping = {
        price: normalizedPriceType === 'warm' ? 'warmmiete' : (minKaltmiete || maxKaltmiete ? 'kaltmiete' : 'price'),
        kaltmiete: 'kaltmiete',
        warmmiete: 'warmmiete',
        size: 'size',
        rooms: 'rooms',
        created_at: 'created_at',
        available_from: 'available_from'
      };

      const validSortFields = ['price', 'kaltmiete', 'warmmiete', 'created_at', 'updated_at', 'size', 'rooms', 'available_from'];
      const validSortOrders = ['asc', 'desc'];

      let resolvedSortField = sortFieldMapping[sortBy] || sortBy;
      if (!validSortFields.includes(resolvedSortField)) {
        resolvedSortField = 'created_at';
      }

      let resolvedSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

      if (earliestMoveIn) {
        resolvedSortField = 'available_from';
        resolvedSortOrder = 'asc';
      }

      queryBuilder = queryBuilder.order(resolvedSortField, { ascending: resolvedSortOrder === 'asc' });

      // Pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data: apartments, error, count } = await queryBuilder;

      if (error) {
        throw error;
      }

      const responseTime = Date.now() - startTime;

      // Log search analytics (if user provided)
      if (userId) {
        this.logSearchAnalytics({
          userId,
          query,
          filters: {
            location: { location, city, area },
            price: {
              minPrice,
              maxPrice,
              minKaltmiete,
              maxKaltmiete,
              minWarmmiete,
              maxWarmmiete,
              priceType: normalizedPriceType
            },
            rooms: { minRooms, maxRooms, rooms, bedrooms, bathrooms, singleBeds, doubleBeds },
            size: { minSize, maxSize },
            propertyType,
            furnishedStatus,
            petsAllowed,
            excludeExchange,
            parkingType,
            locationFeatures,
            timeSlotType,
            amenities
          },
          resultsCount: apartments ? apartments.length : 0,
          responseTime
        });
      }

      return {
        success: true,
        data: apartments || [],
        metadata: {
          totalResults: apartments ? apartments.length : 0,
          query,
          filters: {
            location: { location, city, area },
            priceRange: {
              minPrice,
              maxPrice,
              minKaltmiete,
              maxKaltmiete,
              minWarmmiete,
              maxWarmmiete,
              priceType: normalizedPriceType
            },
            rooms: { minRooms, maxRooms, rooms, bedrooms, bathrooms, singleBeds, doubleBeds },
            size: { minSize, maxSize },
            propertyType,
            furnishedStatus,
            petsAllowed,
            excludeExchange,
            parkingType,
            locationFeatures,
            amenities,
            timeSlotType,
            dateRange: { moveIn: moveInDate, moveOut: moveOutDate }
          },
          pagination: {
            limit,
            offset,
            hasMore: apartments && apartments.length === limit
          },
          performance: {
            responseTime: `${responseTime}ms`,
            searchTime: responseTime
          }
        }
      };

    } catch (error) {
      console.error('Advanced search error:', error);
      return {
        success: false,
        error: 'Search failed',
        data: [],
        metadata: {
          responseTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get search suggestions for autocomplete
   * @param {string} query - Partial search query
   * @param {number} limit - Number of suggestions to return
   */
  static async getSearchSuggestions(query, limit = 10) {
    try {
      const suggestions = [];

      // Location-based suggestions
      const { data: locationSuggestions } = await supabase
        .from('apartments')
        .select('location')
        .ilike('location', `%${query}%`)
        .limit(5);

      if (locationSuggestions) {
        const uniqueLocations = [...new Set(locationSuggestions.map(apt => apt.location))];
        suggestions.push(...uniqueLocations.map(loc => ({
          text: loc,
          type: 'location',
          icon: '📍'
        })));
      }

      // Title-based suggestions
      const { data: titleSuggestions } = await supabase
        .from('apartments')
        .select('title')
        .ilike('title', `%${query}%`)
        .limit(5);

      if (titleSuggestions) {
        suggestions.push(...titleSuggestions.map(apt => ({
          text: apt.title,
          type: 'title',
          icon: '🏠'
        })));
      }

      // Predefined suggestions
      const predefinedSuggestions = [
        { text: 'Studio apartment', type: 'property_type', icon: '🏠' },
        { text: 'Shared room', type: 'property_type', icon: '👥' },
        { text: 'WiFi included', type: 'amenity', icon: '📶' },
        { text: 'Pet friendly', type: 'amenity', icon: '🐕' },
        { text: 'Furnished', type: 'amenity', icon: '🛋️' }
      ].filter(suggestion => 
        suggestion.text.toLowerCase().includes(query.toLowerCase())
      );

      suggestions.push(...predefinedSuggestions);

      return {
        success: true,
        data: suggestions.slice(0, limit)
      };

    } catch (error) {
      console.error('Search suggestions error:', error);
      return {
        success: false,
        error: 'Failed to get suggestions',
        data: []
      };
    }
  }

  /**
   * Get popular search terms
   * @param {number} limit - Number of popular searches to return
   */
  static async getPopularSearches(limit = 10) {
    try {
      // For now, return predefined popular searches
      // This will be enhanced when we have the search_analytics table
      const popularSearches = [
        { query: 'Berlin', searchCount: 150, type: 'location' },
        { query: 'Munich', searchCount: 120, type: 'location' },
        { query: 'Studio apartment', searchCount: 95, type: 'property_type' },
        { query: 'WiFi included', searchCount: 80, type: 'amenity' },
        { query: 'Hamburg', searchCount: 75, type: 'location' },
        { query: 'Furnished', searchCount: 65, type: 'amenity' },
        { query: 'Cologne', searchCount: 55, type: 'location' },
        { query: 'Pet friendly', searchCount: 45, type: 'amenity' }
      ].slice(0, limit);

      return {
        success: true,
        data: popularSearches
      };

    } catch (error) {
      console.error('Popular searches error:', error);
      return {
        success: false,
        error: 'Failed to get popular searches',
        data: []
      };
    }
  }

  /**
   * Save a search alert for a user
   * @param {Object} alertData - Search alert data
   */
  static async saveSearchAlert(alertData) {
    try {
      const {
        userId,
        name,
        query,
        filters = {},
        emailNotifications = true,
        smsNotifications = false
      } = alertData;

      // For now, we'll simulate saving to a basic table
      // This will be enhanced when we have the saved_search_alerts table
      const alertId = Date.now(); // Temporary ID

      return {
        success: true,
        data: {
          id: alertId,
          userId,
          name,
          query,
          filters,
          emailNotifications,
          smsNotifications,
          isActive: true,
          createdAt: new Date().toISOString()
        },
        message: 'Search alert saved successfully'
      };

    } catch (error) {
      console.error('Save search alert error:', error);
      return {
        success: false,
        error: 'Failed to save search alert'
      };
    }
  }

  /**
   * Log search analytics (simplified version)
   * @param {Object} analyticsData - Search analytics data
   */
  static async logSearchAnalytics(analyticsData) {
    try {
      const {
        userId,
        query,
        filters,
        resultsCount,
        responseTime
      } = analyticsData;

      // For now, just log to console
      // This will be enhanced when we have the search_analytics table
      console.log('🔍 Search Analytics:', {
        userId,
        query,
        filters,
        resultsCount,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Search analytics logged'
      };

    } catch (error) {
      console.error('Log search analytics error:', error);
      return {
        success: false,
        error: 'Failed to log search analytics'
      };
    }
  }

  /**
   * Get search analytics summary
   * @param {Object} params - Analytics parameters
   */
  static async getSearchAnalytics(params = {}) {
    try {
      // Return mock analytics data for now
      // This will be enhanced when we have the search_analytics table
      const analyticsData = {
        totalSearches: 1250,
        uniqueUsers: 345,
        averageResponseTime: 85,
        popularTerms: [
          { term: 'Berlin', count: 150 },
          { term: 'Munich', count: 120 },
          { term: 'Studio', count: 95 }
        ],
        searchTrends: [
          { date: '2025-08-12', searches: 45 },
          { date: '2025-08-11', searches: 52 },
          { date: '2025-08-10', searches: 38 }
        ]
      };

      return {
        success: true,
        data: analyticsData
      };

    } catch (error) {
      console.error('Get search analytics error:', error);
      return {
        success: false,
        error: 'Failed to get search analytics'
      };
    }
  }
}

module.exports = AdvancedSearchService;
