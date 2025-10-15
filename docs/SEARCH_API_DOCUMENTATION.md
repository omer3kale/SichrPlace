# SichrPlace Search API Documentation

## Issues Addressed & Solutions

### 🔧 **Development Issues Fixed**

1. **Mobile Design**: Responsive filtering components with simplified mobile UI
2. **Feedback Form**: Fixed availability detection and button functionality  
3. **Smart Matching**: Implemented AI-powered property matching algorithm
4. **Secure Payments**: Enhanced PayPal integration with webhook verification
5. **Navigation**: Restored missing pages (About, FAQ, Customer Service)
6. **Reviews System**: Clarified as ratings system (not text reviews)
7. **Account Creation**: Fixed network error with proper error handling
8. **Language Selection**: Fixed button disappearing issue
9. **Search Complexity**: Simplified filters matching original plan

### 🎯 **Original Design Plan Implementation**

#### **Basic Search Filters (Top Row)**
```javascript
// City/Area Filter
city: string           // Location search
area: string          // Specific area/district

// Time Filters  
moveInDate: string    // YYYY-MM-DD format
moveOutDate: string   // YYYY-MM-DD format
earliestMoveIn: boolean // Sort by earliest available
timeSlotType: 'flexible' | 'fixed' // Timing flexibility

// Price Filters (German Rental System)
minKaltmiete: number  // Cold rent minimum
maxKaltmiete: number  // Cold rent maximum
minWarmmiete: number  // Warm rent minimum  
maxWarmmiete: number  // Warm rent maximum
priceType: 'kalt' | 'warm' | 'both' // Price preference

// Property Types
propertyType: 'shared_room' | 'private_room' | 'studio' | 'loft' | 'apartment' | 'house'

// Rooms & Beds
rooms: number         // Total rooms
singleBeds: number    // Number of single beds
doubleBeds: number    // Number of double beds

// Furnished Status
furnishedStatus: 'furnished' | 'unfurnished' | 'semi_furnished'
```

#### **Advanced Filters**
```javascript
// Amenities (Original Plan)
amenities: {
  washing_machine: boolean,
  dryer: boolean,
  dishwasher: boolean,
  tv: boolean,
  lift: boolean,
  kitchen: boolean,
  air_conditioning: boolean,
  wifi: boolean,
  heating: boolean,
  private_bathroom: boolean,
  wheelchair_accessible: boolean,
  balcony: boolean,
  terrace: boolean
}

// Additional Filters
excludeExchange: boolean    // Exclude exchange offers
petsAllowed: boolean       // Pet-friendly properties
```

---

## 🚀 **API Endpoints**

### **1. Advanced Search**
```
GET /api/search/advanced
```

**Supported Query Parameters:**
```javascript
{
  // Search term & keywords
  query: string,                 // Free text search
  keywords: string,              // Additional search terms

  // Location hierarchy
  location: string,              // Combined city/area string (optional helper)
  city: string,                  // Maps to German `ort`
  area: string,                  // Maps to German `stadtteil`

  // German rental price filters
  minKaltmiete: number,
  maxKaltmiete: number,
  minWarmmiete: number,
  maxWarmmiete: number,
  priceType: 'kalt' | 'warm' | 'both',

  // Availability window
  moveInDate: string,            // YYYY-MM-DD
  moveOutDate: string,           // YYYY-MM-DD
  timeSlotType: 'flexible' | 'fixed',
  earliestMoveIn: boolean,

  // Property types & layout
  propertyType: 'apartment' | 'studio' | 'loft' | 'house' | 'shared_room' | 'private_room',
  rooms: number,
  minRooms: number,
  maxRooms: number,
  bedrooms: number,
  bathrooms: number,
  singleBeds: number,
  doubleBeds: number,

  // Size & furnishings
  minSize: number,
  maxSize: number,
  furnishedStatus: 'furnished' | 'semi_furnished' | 'unfurnished',

  // Listing flags
  petsAllowed: boolean,
  excludeExchange: boolean,
  parkingType: string,

  // Amenities & location features (comma-separated lists)
  amenities: 'wifi,balcony,lift,...',
  locationFeatures: 'public_transport,schools,...',

  // Sorting & pagination
  sortBy: 'created_at' | 'kaltmiete' | 'warmmiete' | 'price' | 'size' | 'rooms' | 'available_from',
  sortOrder: 'asc' | 'desc',
  limit: number,                 // default 20
  offset: number                 // default 0
}
```

> **Tip:** Boolean parameters can be provided as `true`/`false`, `1`/`0`, or `yes`/`no`. List parameters accept either comma-separated strings or repeated query keys.

**Response:**
```javascript
{
  success: true,
  data: {
    apartments: [
      {
        id: string,
        title: string,
        description: string,
        
        // Location
        address: string,
        city: string,
        postal_code: string,
        stadtteil: string,
        
        // Pricing (German system)
        kaltmiete: number,        // Cold rent
        warmmiete: number,        // Warm rent
        nebenkosten: number,      // Additional costs
        
        // Property details
        property_type: string,
        rooms: number,
        single_beds: number,
        double_beds: number,
        bathrooms: number,
        size: number,             // Square meters
        furnished_status: string,
        
        // Availability
        available_from: string,   // YYYY-MM-DD
        available_until: string,  // YYYY-MM-DD
        timeslot_type: string,
        
        // Amenities
        washing_machine: boolean,
        dryer: boolean,
        dishwasher: boolean,
        tv: boolean,
        lift: boolean,
        kitchen: boolean,
        air_conditioning: boolean,
        wifi: boolean,
        heating: boolean,
        private_bathroom: boolean,
        wheelchair_accessible: boolean,
        balcony: boolean,
        terrace: boolean,
        
        // Other
        pets_policy: string,
        listing_type: string,
        
        // Landlord
        landlord: {
          id: string,
          first_name: string,
          last_name: string,
          email: string,
          phone: string
        }
      }
    ],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number,
      hasNext: boolean,
      hasPrev: boolean
    },
    filters: {
      applied: object,          // Applied filters
      available: object         // Available filter options
    },
    meta: {
      count: number,
      searchTerm: string,
      timestamp: string,
      version: string
    }
  }
}
```

### **2. Filter Catalogue**
```
GET /api/search/filters
```

Returns curated filter metadata (property types, furnished options, rent bands, amenities, location features, time-slot choices) used to prime the frontend dropdowns.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "propertyTypes": [
      { "value": "apartment", "label": "Apartment", "count": 45 },
      { "value": "loft", "label": "Loft", "count": 14 }
    ],
    "rentBands": {
      "kaltmiete": [
        { "min": 0, "max": 600, "label": "Budget (bis €600)", "count": 22 }
      ],
      "warmmiete": [
        { "min": 0, "max": 900, "label": "Budget (bis €900)", "count": 19 }
      ]
    },
    "furnishedOptions": [
      { "value": "furnished", "label": "Fully furnished", "count": 33 }
    ],
    "amenities": [
      { "value": "washing_machine", "label": "Washing machine", "count": 78 }
    ],
    "locationFeatures": [
      { "value": "public_transport", "label": "Near public transport", "count": 64 }
    ],
    "timeSlots": [
      { "value": "flexible", "label": "Flexible availability", "count": 37 }
    ]
  }
}
```

### **3. Filter Analytics**
```
GET /api/advanced-search?action=complex_filters
```

**Response:**
```javascript
{
  success: true,
  data: {
    price_ranges: {
      kaltmiete: {
        min: number,
        max: number,
        median: number,
        quartiles: { q1: number, q3: number },
        ranges: [
          { label: 'Budget', min: number, max: number },
          { label: 'Mid-Range', min: number, max: number },
          { label: 'Premium', min: number, max: number },
          { label: 'Luxury', min: number, max: number }
        ]
      },
      warmmiete: { /* same structure */ },
      suggested_ranges: {
        budget: { min: 0, max: 800 },
        mid_range: { min: 800, max: 1500 },
        premium: { min: 1500, max: 5000 }
      }
    },
    locations: {
      cities: string[],         // Available cities
      districts: string[]       // Available districts
    },
    property_types: {
      available: string[],      // Currently available types
      options: [
        {
          value: 'shared_room',
          label: 'Shared Room',
          description: 'Room in shared apartment'
        }
        // ... etc
      ]
    },
    furnished_options: [
      {
        value: 'furnished',
        label: 'Furnished',
        description: 'Fully furnished with all essentials'
      }
      // ... etc
    ],
    amenities: {
      essential: string[],      // Essential amenities
      comfort: string[],        // Comfort amenities  
      luxury: string[]          // Luxury amenities
    },
    time_options: {
      timeslot_types: ['flexible', 'fixed'],
      move_in_options: ['immediately', 'within_week', 'within_month', 'specific_date']
    }
  }
}
```

### **3. Auto-Suggest**
```
GET /api/advanced-search?action=auto_suggest&query=berlin
```

**Response:**
```javascript
{
  success: true,
  data: {
    suggestions: string[]       // Location suggestions
  }
}
```

### **4. Search Suggestions**
```
GET /api/advanced-search?action=search_suggestions
```

**Response:**
```javascript
{
  success: true,
  data: {
    suggestions: string[]       // Popular search terms
  }
}
```

### **5. Save Search** (Authenticated)
```
POST /api/advanced-search?action=save_search
Authorization: Bearer <token>
```

**Body:**
```javascript
{
  name: string,              // Search name
  criteria: object           // Search criteria
}
```

### **6. Get Saved Searches** (Authenticated)
```
GET /api/advanced-search?action=get_saved_searches
Authorization: Bearer <token>
```

### **7. Delete Saved Search** (Authenticated)
```
POST /api/advanced-search?action=delete_saved_search
Authorization: Bearer <token>
```

**Body:**
```javascript
{
  search_id: string
}
```

### **8. Search Analytics**
```
GET /api/advanced-search?action=search_analytics
```

### **9. Popular Searches**
```
GET /api/advanced-search?action=popular_searches
```

**Response:**
```javascript
{
  success: true,
  data: {
    popular_searches: [
      { term: string, count: number }
    ]
  }
}
```

---

## 🎨 **Frontend Integration Examples**

### **Basic Search Form**
```javascript
// Search form component
const searchApartments = async (filters) => {
  const params = new URLSearchParams();
  
  // Add filters to params
  Object.keys(filters).forEach(key => {
    if (filters[key] !== null && filters[key] !== undefined) {
      params.append(key, filters[key]);
    }
  });
  
  const response = await fetch(`/api/search?${params}`);
  return await response.json();
};

// Example usage
const results = await searchApartments({
  city: 'Berlin',
  minKaltmiete: 500,
  maxKaltmiete: 1200,
  propertyType: 'apartment',
  furnishedStatus: 'furnished',
  wifi: true,
  pets_allowed: true,
  page: 1,
  limit: 20
});
```

### **Filter Analytics Integration**
```javascript
// Get available filters for UI
const getFilterOptions = async () => {
  const response = await fetch('/api/advanced-search?action=complex_filters');
  const data = await response.json();
  
  // Use data.price_ranges for price sliders
  // Use data.locations.cities for city dropdown
  // Use data.property_types.options for property type selection
  // Use data.amenities for amenity checkboxes
  
  return data;
};
```

### **Auto-Complete Integration**
```javascript
// Location auto-complete
const getLocationSuggestions = async (query) => {
  const response = await fetch(`/api/advanced-search?action=auto_suggest&query=${query}`);
  const data = await response.json();
  return data.data.suggestions;
};
```

---

## 📱 **Mobile-Responsive Design Considerations**

1. **Simplified Filters**: Group related filters in collapsible sections
2. **Touch-Friendly**: Larger buttons and touch targets
3. **Progressive Disclosure**: Show basic filters first, advanced on demand
4. **Quick Filters**: Preset filter combinations for common searches
5. **Map Integration**: Mobile-optimized map view for location selection

---

## 🔐 **Security Features**

1. **Input Validation**: All inputs sanitized and validated
2. **Rate Limiting**: Prevent abuse of search endpoints
3. **Authentication**: Protected endpoints require valid JWT
4. **CORS**: Proper CORS headers for cross-origin requests
5. **Error Handling**: Consistent error responses without data leakage

---

## 📊 **Smart Matching Algorithm**

The search includes AI-powered matching that considers:
- Location preferences and proximity
- Price range compatibility 
- Property type preferences
- Amenity requirements
- Time availability matching
- User behavior patterns

---

This API implementation fully addresses the original design requirements while providing a robust, scalable search infrastructure for the SichrPlace platform.