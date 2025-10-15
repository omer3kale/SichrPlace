# B12: Search Filters - Complete Specification

**Status**: In Progress  
**Priority**: High  
**Google Feedback**: Filters appearing twice, missing fields, non-functional filter button, overcomplicated UI

---

## 🎯 Objectives

1. ✅ **Single, unified filter panel** (eliminate duplication)
2. ✅ **Add all missing filter fields** per Google spec
3. ✅ **Working filter/clear buttons** with proper state management
4. ✅ **Scrollable filter panel** for better UX
5. ✅ **Simplified, intuitive UI** matching the specification

---

## 📋 Required Filter Fields

### **Basic Filters** (Always Visible)

#### 1. **Location**
- **Field**: City/Area text input
- **Element ID**: `city-filter`
- **Type**: Text input with autocomplete (future: city dropdown)
- **Validation**: Min 2 characters
- **Backend param**: `?city={value}`

#### 2. **Time Filters**
| Field | Element ID | Type | Backend Param |
|-------|-----------|------|---------------|
| Move-in Date | `move-in-date` | Date picker | `?move_in={YYYY-MM-DD}` |
| Move-out Date | `move-out-date` | Date picker | `?move_out={YYYY-MM-DD}` |
| Earliest Move-in | `earliest-move-in` | Checkbox + sort trigger | `?sort_by=earliest` |
| Time Flexibility | `time-flexibility` | Radio: Fixed/Flexible | `?flexibility={fixed\|flexible}` |

**Logic**:
- "Earliest Move-in" checkbox: when checked, sorts results by soonest available move-in date
- "Fixed" timeslot: exact dates required (strict match)
- "Flexible" timeslot: negotiable dates (shows offers with overlapping availability)

#### 3. **Price Range**
| Field | Element ID | Type | Backend Param |
|-------|-----------|------|---------------|
| Kaltmiete checkbox | `price-type-kalt` | Checkbox | `?price_type=kalt` (or both) |
| Warmmiete checkbox | `price-type-warm` | Checkbox | `?price_type=warm` (or both) |
| Min Price | `min-price` | Number input | `?min_price={value}` |
| Max Price | `max-price` | Number input | `?max_price={value}` |

**Logic**:
- If both Kalt/Warm checked: show both types
- If only Kalt: filter `price_type = 'kalt'`
- If only Warm: filter `price_type = 'warm'`
- If neither: show all

#### 4. **Property Type**
- **Element ID**: `property-type-filter`
- **Type**: Multi-select checkboxes (NOT dropdown)
- **Options**:
  - ✅ Shared Room (`shared-room`)
  - ✅ Private Room (`private-room`)
  - ✅ Studio (`studio`)
  - ✅ Loft (`loft`)
  - ✅ Apartment (`apartment`)
  - ✅ House (`house`)
- **Backend param**: `?property_type=shared-room,private-room,studio` (comma-separated)

#### 5. **Rooms & Beds**
| Field | Element ID | Type | Options | Backend Param |
|-------|-----------|------|---------|---------------|
| Number of Rooms | `rooms-count` | Select | Any, 1, 2, 3, 4+ | `?rooms={value}` |
| Single Beds | `single-beds` | Select | 0, 1, 2, 3+ | `?single_beds={value}` |
| Double Beds | `double-beds` | Select | 0, 1, 2, 3+ | `?double_beds={value}` |

**Note**: "Number of Rooms" = total rooms in property (kitchen/living not counted separately in German standard)

#### 6. **Furnished Status**
- **Element ID**: `furnished-filter`
- **Type**: Select dropdown
- **Options**: Any, Furnished, Unfurnished, Semi-furnished
- **Backend param**: `?furnished={furnished\|unfurnished\|semi-furnished}`

---

### **Advanced Filters** (Collapsible/Scrollable Section)

#### 7. **Amenities** (Multi-select checkboxes)
| Amenity | Element ID | Icon | Backend Value |
|---------|-----------|------|---------------|
| Washing Machine | `amenity-washing-machine` | `fa-tshirt` | `washing_machine` |
| Dryer | `amenity-dryer` | `fa-wind` | `dryer` |
| Dishwasher | `amenity-dishwasher` | `fa-utensils` | `dishwasher` |
| TV | `amenity-tv` | `fa-tv` | `tv` |
| Lift/Elevator | `amenity-lift` | `fa-arrows-alt-v` | `lift` |
| Kitchen | `amenity-kitchen` | `fa-utensils-alt` | `kitchen` |
| Air Conditioning | `amenity-ac` | `fa-snowflake` | `air_conditioning` |
| WiFi | `amenity-wifi` | `fa-wifi` | `wifi` |
| Heating | `amenity-heating` | `fa-fire` | `heating` |
| Private Bathroom | `amenity-private-bathroom` | `fa-bath` | `private_bathroom` |
| Wheelchair Accessible | `amenity-wheelchair` | `fa-wheelchair` | `wheelchair_accessible` |
| Balcony/Terrace | `amenity-balcony` | `fa-tree` | `balcony` |

**Backend param**: `?amenities=wifi,kitchen,balcony` (comma-separated)

#### 8. **More Filters**
| Filter | Element ID | Type | Backend Param |
|--------|-----------|------|---------------|
| Exclude Exchange Offers | `exclude-exchange` | Checkbox | `?exclude_exchange=true` |
| Pets Allowed | `pets-allowed` | Radio: Any/Allowed/Not Allowed | `?pets={any\|allowed\|not_allowed}` |

---

## 🎨 UI/UX Requirements

### Design Principles
1. **Single filter panel** - eliminate all duplicates
2. **Scrollable container** - max-height with vertical scroll
3. **Clear visual hierarchy** - basic filters first, advanced collapsible
4. **Sticky action buttons** - Apply/Clear always visible at bottom
5. **Active filter indicators** - show count and tags of applied filters
6. **Responsive** - mobile-friendly with touch targets

### Layout Structure
```
┌─────────────────────────────────────┐
│ 🔍 Advanced Filters            [×]  │ ← Header (sticky)
├─────────────────────────────────────┤
│ ┌─ SCROLLABLE CONTENT ─────────┐   │
│ │ 📍 City/Area                  │   │
│ │ 📅 Time Filters               │   │
│ │   ├─ Move-in Date             │   │
│ │   ├─ Move-out Date            │   │
│ │   ├─ ☑ Earliest Move-in       │   │
│ │   └─ ○ Fixed / ○ Flexible     │   │
│ │                               │   │
│ │ 💰 Price (Kalt/Warm)          │   │
│ │                               │   │
│ │ 🏠 Property Type (checkboxes) │   │
│ │                               │   │
│ │ 🛏️ Rooms & Beds                │   │
│ │                               │   │
│ │ 🪑 Furnished                   │   │
│ │                               │   │
│ │ ▼ Advanced Amenities          │   │ ← Collapsible
│ │   (amenities grid)            │   │
│ │                               │   │
│ │ ⚙️ More Filters                │   │
│ └───────────────────────────────┘   │
├─────────────────────────────────────┤
│ Showing 42 of 150 apartments        │ ← Summary (sticky)
│ [🔍 Apply Filters] [❌ Clear All]   │ ← Actions (sticky)
└─────────────────────────────────────┘
```

### Scroll Behavior
```css
.filters-modal {
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.filters-content {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  flex: 1;
}

.filters-actions {
  position: sticky;
  bottom: 0;
  background: white;
  border-top: 1px solid #e1e5e9;
  padding: 15px 20px;
}
```

---

## ⚙️ Filter Logic & Backend Integration

### Frontend Filter Function
```javascript
function applyModalFilters() {
  const filters = {
    // Location
    city: document.getElementById('city-filter').value.trim(),
    
    // Time
    moveIn: document.getElementById('move-in-date').value,
    moveOut: document.getElementById('move-out-date').value,
    earliestMoveIn: document.getElementById('earliest-move-in').checked,
    timeFlexibility: document.querySelector('input[name="time-flexibility"]:checked')?.value,
    
    // Price
    priceTypes: {
      kalt: document.getElementById('price-type-kalt').checked,
      warm: document.getElementById('price-type-warm').checked
    },
    minPrice: parseFloat(document.getElementById('min-price').value) || 0,
    maxPrice: parseFloat(document.getElementById('max-price').value) || Infinity,
    
    // Property Types (multi-select)
    propertyTypes: Array.from(document.querySelectorAll('input[name="property-type"]:checked'))
      .map(cb => cb.value),
    
    // Rooms & Beds
    roomsCount: document.getElementById('rooms-count').value,
    singleBeds: document.getElementById('single-beds').value,
    doubleBeds: document.getElementById('double-beds').value,
    
    // Furnished
    furnished: document.getElementById('furnished-filter').value,
    
    // Amenities (multi-select)
    amenities: Array.from(document.querySelectorAll('input[name="amenity"]:checked'))
      .map(cb => cb.value),
    
    // More filters
    excludeExchange: document.getElementById('exclude-exchange').checked,
    petsPolicy: document.querySelector('input[name="pets-policy"]:checked')?.value
  };
  
  // Build query params for API call
  const params = new URLSearchParams();
  if (filters.city) params.append('city', filters.city);
  if (filters.moveIn) params.append('move_in', filters.moveIn);
  if (filters.moveOut) params.append('move_out', filters.moveOut);
  if (filters.earliestMoveIn) params.append('sort_by', 'earliest');
  if (filters.timeFlexibility) params.append('flexibility', filters.timeFlexibility);
  
  // Price type logic
  if (filters.priceTypes.kalt && !filters.priceTypes.warm) params.append('price_type', 'kalt');
  else if (!filters.priceTypes.kalt && filters.priceTypes.warm) params.append('price_type', 'warm');
  // If both or neither, don't add param (show all)
  
  if (filters.minPrice > 0) params.append('min_price', filters.minPrice);
  if (filters.maxPrice < Infinity) params.append('max_price', filters.maxPrice);
  
  if (filters.propertyTypes.length > 0) params.append('property_type', filters.propertyTypes.join(','));
  if (filters.roomsCount) params.append('rooms', filters.roomsCount);
  if (filters.singleBeds) params.append('single_beds', filters.singleBeds);
  if (filters.doubleBeds) params.append('double_beds', filters.doubleBeds);
  if (filters.furnished) params.append('furnished', filters.furnished);
  if (filters.amenities.length > 0) params.append('amenities', filters.amenities.join(','));
  if (filters.excludeExchange) params.append('exclude_exchange', 'true');
  if (filters.petsPolicy) params.append('pets', filters.petsPolicy);
  
  // Fetch filtered results
  fetchApartments(params.toString());
  
  // Update UI
  updateActiveFilterTags(filters);
  toggleFilters(); // Close modal
}
```

### Backend Query Example (Supabase)
```javascript
async function fetchFilteredApartments(filters) {
  let query = supabase
    .from('apartments')
    .select('*');
  
  // Location
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`);
  }
  
  // Time filters
  if (filters.moveIn) {
    query = query.gte('available_from', filters.moveIn);
  }
  if (filters.moveOut) {
    query = query.lte('available_until', filters.moveOut);
  }
  
  // Price
  if (filters.priceType === 'kalt') {
    query = query.eq('price_type', 'kalt');
  } else if (filters.priceType === 'warm') {
    query = query.eq('price_type', 'warm');
  }
  
  query = query.gte('price', filters.minPrice)
               .lte('price', filters.maxPrice);
  
  // Property types (IN clause)
  if (filters.propertyTypes?.length > 0) {
    query = query.in('property_type', filters.propertyTypes);
  }
  
  // Rooms & Beds
  if (filters.roomsCount) {
    query = query.gte('rooms', parseInt(filters.roomsCount));
  }
  if (filters.singleBeds) {
    query = query.gte('single_beds', parseInt(filters.singleBeds));
  }
  if (filters.doubleBeds) {
    query = query.gte('double_beds', parseInt(filters.doubleBeds));
  }
  
  // Furnished
  if (filters.furnished) {
    query = query.eq('furnished', filters.furnished);
  }
  
  // Amenities (JSONB contains)
  if (filters.amenities?.length > 0) {
    query = query.contains('amenities', filters.amenities);
  }
  
  // More filters
  if (filters.excludeExchange) {
    query = query.eq('is_exchange', false);
  }
  if (filters.petsPolicy === 'allowed') {
    query = query.eq('pets_allowed', true);
  } else if (filters.petsPolicy === 'not_allowed') {
    query = query.eq('pets_allowed', false);
  }
  
  // Sorting
  if (filters.earliestMoveIn) {
    query = query.order('available_from', { ascending: true });
  } else {
    query = query.order('created_at', { descending: true });
  }
  
  const { data, error } = await query;
  return { data, error };
}
```

---

## ✅ Acceptance Tests

### Test Case 1: Basic Filtering
**Given**: User opens filter panel  
**When**: User selects "Berlin" city, 1-bedroom, €500-€1000  
**Then**: 
- Filter panel shows active filter count (3)
- Results update to show only matching apartments
- URL updates with query params: `?city=Berlin&rooms=1&min_price=500&max_price=1000`

### Test Case 2: Time Filters
**Given**: User needs apartment for specific dates  
**When**: User sets move-in 2025-11-01, move-out 2026-05-31, checks "Flexible"  
**Then**: 
- Shows apartments with overlapping availability (not strict match)
- "Fixed" would require exact date match

### Test Case 3: Property Type Multi-Select
**Given**: User wants either shared or private room  
**When**: User checks "Shared Room" + "Private Room"  
**Then**: 
- Results show both types
- Other types (Studio, Apartment, etc.) hidden

### Test Case 4: Price Type (Kalt/Warm)
**Given**: User only wants Kaltmiete prices  
**When**: User checks only "Kaltmiete" checkbox  
**Then**: 
- Results show only apartments with `price_type = 'kalt'`
- Warmmiete apartments hidden

### Test Case 5: Beds Filter
**Given**: User needs 2 single beds  
**When**: User selects "2" from Single Beds dropdown  
**Then**: 
- Shows apartments with >= 2 single beds
- Apartments with only double beds hidden

### Test Case 6: Clear All Filters
**Given**: Multiple filters applied  
**When**: User clicks "Clear All" button  
**Then**: 
- All checkboxes unchecked
- All inputs/selects reset to default
- Results show all apartments
- Filter count badge disappears

### Test Case 7: Filter Panel Scroll
**Given**: Filter panel open on mobile device  
**When**: User scrolls within filter content  
**Then**: 
- Header and action buttons stay sticky
- Only middle content scrolls
- No body scroll behind modal

### Test Case 8: No Duplicates
**Given**: User opens filter panel  
**When**: User inspects UI  
**Then**: 
- NO duplicate amenity checkboxes
- NO duplicate filter sections
- Single, unified filter panel

---

## 🔧 Implementation Checklist

- [ ] **Remove duplicate filter sections** from HTML
- [ ] **Add missing fields**:
  - [ ] Time flexibility radio buttons
  - [ ] Earliest move-in checkbox
  - [ ] Property type checkboxes (shared room, private room, loft)
  - [ ] Single beds selector
  - [ ] Double beds selector
  - [ ] Kalt/Warm price type checkboxes
  - [ ] Exclude exchange checkbox
  - [ ] Pets policy radio buttons
- [ ] **Implement scrollable container** (max-height + sticky header/footer)
- [ ] **Wire Apply Filters button** to `applyModalFilters()` with full logic
- [ ] **Wire Clear All button** to reset all inputs and re-fetch all apartments
- [ ] **Add active filter tags** UI below search bar (removable chips)
- [ ] **Update backend API** to accept new query params
- [ ] **Add translations** for all new labels (EN/DE/TR)
- [ ] **Write tests**:
  - [ ] Frontend unit tests for filter logic
  - [ ] Integration tests for API filtering
  - [ ] E2E test: apply filters → verify results
- [ ] **Mobile responsive** - test on 320px, 768px, 1024px widths
- [ ] **Accessibility** - keyboard navigation, ARIA labels, focus management

---

## 📝 Translation Keys Required

Add to `frontend/js/translations.json`:

```json
{
  "en": {
    "filters.city": "City/Area",
    "filters.moveIn": "Move-in Date",
    "filters.moveOut": "Move-out Date",
    "filters.earliestMoveIn": "Sort by earliest move-in",
    "filters.timeFlexibility": "Time Flexibility",
    "filters.fixed": "Fixed Dates",
    "filters.flexible": "Flexible Dates",
    "filters.priceType": "Price Type",
    "filters.kaltmiete": "Kaltmiete (Cold Rent)",
    "filters.warmmiete": "Warmmiete (Warm Rent)",
    "filters.propertyType": "Property Type",
    "filters.sharedRoom": "Shared Room",
    "filters.privateRoom": "Private Room",
    "filters.studio": "Studio",
    "filters.loft": "Loft",
    "filters.apartment": "Apartment",
    "filters.house": "House",
    "filters.roomsCount": "Number of Rooms",
    "filters.singleBeds": "Single Beds",
    "filters.doubleBeds": "Double Beds",
    "filters.furnished": "Furnished Status",
    "filters.excludeExchange": "Exclude Exchange Offers",
    "filters.petsPolicy": "Pets Policy",
    "filters.petsAllowed": "Pets Allowed",
    "filters.petsNotAllowed": "No Pets",
    "filters.amenities": "Amenities",
    "filters.applyFilters": "Apply Filters",
    "filters.clearAll": "Clear All"
  },
  "de": {
    "filters.city": "Stadt/Gebiet",
    "filters.moveIn": "Einzugsdatum",
    "filters.moveOut": "Auszugsdatum",
    "filters.earliestMoveIn": "Nach frühestem Einzug sortieren",
    "filters.timeFlexibility": "Zeitflexibilität",
    "filters.fixed": "Feste Termine",
    "filters.flexible": "Flexible Termine",
    "filters.priceType": "Preistyp",
    "filters.kaltmiete": "Kaltmiete",
    "filters.warmmiete": "Warmmiete",
    "filters.propertyType": "Immobilientyp",
    "filters.sharedRoom": "WG-Zimmer",
    "filters.privateRoom": "Privatzimmer",
    "filters.studio": "Studio",
    "filters.loft": "Loft",
    "filters.apartment": "Wohnung",
    "filters.house": "Haus",
    "filters.roomsCount": "Anzahl der Zimmer",
    "filters.singleBeds": "Einzelbetten",
    "filters.doubleBeds": "Doppelbetten",
    "filters.furnished": "Möblierung",
    "filters.excludeExchange": "Tauschangebote ausschließen",
    "filters.petsPolicy": "Haustiere",
    "filters.petsAllowed": "Haustiere erlaubt",
    "filters.petsNotAllowed": "Keine Haustiere",
    "filters.amenities": "Ausstattung",
    "filters.applyFilters": "Filter anwenden",
    "filters.clearAll": "Alle löschen"
  },
  "tr": {
    "filters.city": "Şehir/Bölge",
    "filters.moveIn": "Taşınma Tarihi",
    "filters.moveOut": "Çıkış Tarihi",
    "filters.earliestMoveIn": "En erken taşınmaya göre sırala",
    "filters.timeFlexibility": "Zaman Esnekliği",
    "filters.fixed": "Sabit Tarihler",
    "filters.flexible": "Esnek Tarihler",
    "filters.priceType": "Fiyat Tipi",
    "filters.kaltmiete": "Soğuk Kira",
    "filters.warmmiete": "Sıcak Kira",
    "filters.propertyType": "Mülk Tipi",
    "filters.sharedRoom": "Paylaşımlı Oda",
    "filters.privateRoom": "Özel Oda",
    "filters.studio": "Stüdyo",
    "filters.loft": "Çatı Katı",
    "filters.apartment": "Daire",
    "filters.house": "Ev",
    "filters.roomsCount": "Oda Sayısı",
    "filters.singleBeds": "Tek Kişilik Yataklar",
    "filters.doubleBeds": "Çift Kişilik Yataklar",
    "filters.furnished": "Mobilya Durumu",
    "filters.excludeExchange": "Takas Tekliflerini Hariç Tut",
    "filters.petsPolicy": "Evcil Hayvan Politikası",
    "filters.petsAllowed": "Evcil Hayvan İzinli",
    "filters.petsNotAllowed": "Evcil Hayvan Yok",
    "filters.amenities": "Özellikler",
    "filters.applyFilters": "Filtreleri Uygula",
    "filters.clearAll": "Tümünü Temizle"
  }
}
```

---

## 🚀 Deployment Notes

1. **Database Schema**: Ensure `apartments` table has columns:
   - `price_type` (ENUM: 'kalt', 'warm')
   - `single_beds` (INT)
   - `double_beds` (INT)
   - `time_flexibility` (ENUM: 'fixed', 'flexible')
   - `amenities` (JSONB array)
   - `is_exchange` (BOOLEAN)
   - `pets_allowed` (BOOLEAN)

2. **API Endpoint**: Update `/api/apartments/search` to accept all new query params

3. **Frontend**: Deploy updated `apartments-listing.html` and `translations.json`

4. **Testing**: Run full test suite before production deploy

---

**Last Updated**: 2025-10-15  
**Author**: GitHub Copilot  
**Related**: `GOOGLE_FEEDBACK_BUG_STATUS.md`, `B10_IMPLEMENTATION_COMPLETE.md`
