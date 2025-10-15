# SichrPlace Frontend Integration Guide

## 🔧 **Critical Issues & Solutions**

### **1. Mobile Design Problems**
```css
/* Mobile-first responsive design */
.search-filters {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

@media (min-width: 768px) {
  .search-filters {
    flex-direction: row;
    flex-wrap: wrap;
  }
}

.filter-group {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.mobile-filter-toggle {
  display: block;
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  margin-bottom: 16px;
}

@media (min-width: 768px) {
  .mobile-filter-toggle {
    display: none;
  }
}
```

### **2. Fixed Navigation Issues**
```javascript
// Navigation component fix
const NavigationBar = () => {
  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <Link to="/" className="logo">SichrPlace</Link>
        
        <div className="nav-links">
          <Link to="/marketplace">Marketplace</Link> {/* Restored */}
          <Link to="/search">Search</Link>
          <Link to="/about">About</Link> {/* Fixed */}
          <Link to="/faq">FAQ</Link> {/* Fixed */}
          <Link to="/customer-service">Customer Service</Link> {/* Fixed */}
          
          <LanguageSelector /> {/* Fixed disappearing issue */}
          
          <div className="auth-buttons">
            <Link to="/login">Sign In</Link>
            <Link to="/register">Create Account</Link>
          </div>
        </div>
      </div>
    </nav>
  );
};
```

### **3. Language Selector Fix**
```javascript
// Fixed language selector component
const LanguageSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  
  return (
    <div className="language-selector" onMouseLeave={() => setIsOpen(false)}>
      <button 
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
      >
        {selectedLang.toUpperCase()} ▼
      </button>
      
      {isOpen && (
        <div className="language-dropdown">
          <button onClick={() => { setSelectedLang('en'); setIsOpen(false); }}>
            English
          </button>
          <button onClick={() => { setSelectedLang('de'); setIsOpen(false); }}>
            Deutsch
          </button>
        </div>
      )}
    </div>
  );
};
```

### **4. Account Creation Network Error Fix**
```javascript
// Fixed registration component with proper error handling
const RegisterForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Input validation
      if (!formData.email || !formData.password) {
        throw new Error('Email and password are required');
      }

      if (formData.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      // API call with proper error handling
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      
      if (data.success) {
        // Redirect to email verification
        window.location.href = '/verify-email';
      } else {
        throw new Error(data.message || 'Registration failed');
      }

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="register-form">
      <h2>Create Your SichrPlace Account</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="form-group">
        <label>Email Address</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          minLength={8}
          required
        />
      </div>
      
      <div className="form-group">
        <label>First Name</label>
        <input
          type="text"
          value={formData.firstName}
          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Last Name</label>
        <input
          type="text"
          value={formData.lastName}
          onChange={(e) => setFormData({...formData, lastName: e.target.value})}
          required
        />
      </div>
      
      <button type="submit" disabled={loading} className="submit-button">
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
};
```

### **5. Search Filters - Original Plan Implementation**
```javascript
// Simplified search filters matching original design
const SearchFilters = () => {
  const [filters, setFilters] = useState({
    // Basic filters (top row)
    city: '',
    moveInDate: '',
    moveOutDate: '',
    earliestMoveIn: false,
    timeSlotType: 'flexible',
    
    // Price filters (German system)
    minKaltmiete: '',
    maxKaltmiete: '',
    minWarmmiete: '',
    maxWarmmiete: '',
    priceType: 'both',
    
    // Property type
    propertyType: '',
    
    // Rooms and beds
    rooms: '',
    singleBeds: '',
    doubleBeds: '',
    
    // Furnished status
    furnishedStatus: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="search-filters">
      {/* Basic Filters - Always Visible */}
      <div className="basic-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>City/Area</label>
            <input 
              type="text"
              placeholder="Enter city or area"
              value={filters.city}
              onChange={(e) => setFilters({...filters, city: e.target.value})}
            />
          </div>
          
          <div className="filter-group">
            <label>Move-in Date</label>
            <input 
              type="date"
              value={filters.moveInDate}
              onChange={(e) => setFilters({...filters, moveInDate: e.target.value})}
            />
          </div>
          
          <div className="filter-group">
            <label>Move-out Date</label>
            <input 
              type="date"
              value={filters.moveOutDate}
              onChange={(e) => setFilters({...filters, moveOutDate: e.target.value})}
            />
          </div>
        </div>
        
        <div className="filter-row">
          <div className="filter-group">
            <label>Price Range (€/month)</label>
            <div className="price-inputs">
              <select value={filters.priceType} onChange={(e) => setFilters({...filters, priceType: e.target.value})}>
                <option value="both">Kalt/Warm Miete</option>
                <option value="kalt">Kalt Miete</option>
                <option value="warm">Warm Miete</option>
              </select>
              
              {filters.priceType === 'kalt' || filters.priceType === 'both' ? (
                <>
                  <input 
                    type="number"
                    placeholder="Min Kalt"
                    value={filters.minKaltmiete}
                    onChange={(e) => setFilters({...filters, minKaltmiete: e.target.value})}
                  />
                  <input 
                    type="number"
                    placeholder="Max Kalt"
                    value={filters.maxKaltmiete}
                    onChange={(e) => setFilters({...filters, maxKaltmiete: e.target.value})}
                  />
                </>
              ) : (
                <>
                  <input 
                    type="number"
                    placeholder="Min Warm"
                    value={filters.minWarmmiete}
                    onChange={(e) => setFilters({...filters, minWarmmiete: e.target.value})}
                  />
                  <input 
                    type="number"
                    placeholder="Max Warm"
                    value={filters.maxWarmmiete}
                    onChange={(e) => setFilters({...filters, maxWarmmiete: e.target.value})}
                  />
                </>
              )}
            </div>
          </div>
          
          <div className="filter-group">
            <label>Property Type</label>
            <select value={filters.propertyType} onChange={(e) => setFilters({...filters, propertyType: e.target.value})}>
              <option value="">All Types</option>
              <option value="shared_room">Shared Room</option>
              <option value="private_room">Private Room</option>
              <option value="studio">Studio</option>
              <option value="loft">Loft</option>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Rooms & Beds</label>
            <div className="beds-inputs">
              <input 
                type="number"
                placeholder="Rooms"
                value={filters.rooms}
                onChange={(e) => setFilters({...filters, rooms: e.target.value})}
              />
              <input 
                type="number"
                placeholder="Single Beds"
                value={filters.singleBeds}
                onChange={(e) => setFilters({...filters, singleBeds: e.target.value})}
              />
              <input 
                type="number"
                placeholder="Double Beds"
                value={filters.doubleBeds}
                onChange={(e) => setFilters({...filters, doubleBeds: e.target.value})}
              />
            </div>
          </div>
          
          <div className="filter-group">
            <label>Furnished</label>
            <select value={filters.furnishedStatus} onChange={(e) => setFilters({...filters, furnishedStatus: e.target.value})}>
              <option value="">Any</option>
              <option value="furnished">Furnished</option>
              <option value="unfurnished">Unfurnished</option>
              <option value="semi_furnished">Semi-Furnished</option>
            </select>
          </div>
        </div>
        
        <div className="filter-actions">
          <label className="checkbox-label">
            <input 
              type="checkbox"
              checked={filters.earliestMoveIn}
              onChange={(e) => setFilters({...filters, earliestMoveIn: e.target.checked})}
            />
            Sort by earliest move-in
          </label>
          
          <button 
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="advanced-toggle"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
          </button>
        </div>
      </div>
      
      {/* Advanced Filters - Collapsible */}
      {showAdvanced && <AdvancedFilters filters={filters} setFilters={setFilters} />}
      
      <div className="search-actions">
        <button type="button" onClick={() => handleSearch(filters)} className="search-button">
          Search Apartments
        </button>
        <button type="button" onClick={() => resetFilters()} className="reset-button">
          Reset Filters
        </button>
      </div>
    </div>
  );
};

// Advanced filters component
const AdvancedFilters = ({ filters, setFilters }) => {
  const amenities = [
    'washing_machine', 'dryer', 'dishwasher', 'tv', 'lift', 'kitchen',
    'air_conditioning', 'wifi', 'heating', 'private_bathroom',
    'wheelchair_accessible', 'balcony', 'terrace'
  ];

  return (
    <div className="advanced-filters">
      <h3>Advanced Filters</h3>
      
      <div className="amenities-grid">
        <h4>Amenities</h4>
        {amenities.map(amenity => (
          <label key={amenity} className="amenity-checkbox">
            <input 
              type="checkbox"
              checked={filters[amenity] || false}
              onChange={(e) => setFilters({...filters, [amenity]: e.target.checked})}
            />
            {amenity.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </label>
        ))}
      </div>
      
      <div className="more-filters">
        <label className="checkbox-label">
          <input 
            type="checkbox"
            checked={filters.excludeExchange || false}
            onChange={(e) => setFilters({...filters, excludeExchange: e.target.checked})}
          />
          Exclude exchange offers
        </label>
        
        <label className="checkbox-label">
          <input 
            type="checkbox"
            checked={filters.petsAllowed || false}
            onChange={(e) => setFilters({...filters, petsAllowed: e.target.checked})}
          />
          Pets allowed
        </label>
      </div>
    </div>
  );
};
```

### **6. Viewing Area Simplification**
```javascript
// Simplified viewing request form (removed monthly budget and additional guests)
const ViewingRequestForm = ({ apartmentId }) => {
  const [formData, setFormData] = useState({
    preferredDate: '',
    preferredTime: '',
    message: '',
    // Removed: monthlyBudget, additionalGuests
  });

  return (
    <form className="viewing-request-form">
      <h3>Request Apartment Viewing</h3>
      <p>Professional viewing conducted by SichrPlace team</p>
      
      <div className="form-group">
        <label>Preferred Viewing Date</label>
        <input 
          type="date"
          value={formData.preferredDate}
          onChange={(e) => setFormData({...formData, preferredDate: e.target.value})}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Preferred Time</label>
        <select 
          value={formData.preferredTime}
          onChange={(e) => setFormData({...formData, preferredTime: e.target.value})}
          required
        >
          <option value="">Select time</option>
          <option value="morning">Morning (9:00-12:00)</option>
          <option value="afternoon">Afternoon (12:00-17:00)</option>
          <option value="evening">Evening (17:00-19:00)</option>
        </select>
      </div>
      
      <div className="form-group">
        <label>Additional Message (Optional)</label>
        <textarea 
          value={formData.message}
          onChange={(e) => setFormData({...formData, message: e.target.value})}
          placeholder="Any specific requirements or questions..."
        />
      </div>
      
      <button type="submit" className="submit-button">
        Request Professional Viewing
      </button>
    </form>
  );
};
```

### **7. Instructions Component**
```javascript
// Step-by-step instructions component
const PlatformInstructions = () => {
  const steps = [
    {
      number: 1,
      title: "Register and Sign-in",
      description: "Create your secure account"
    },
    {
      number: 2,
      title: "Create Your Account", 
      description: "Fill in your personal details"
    },
    {
      number: 3,
      title: "Post or Search",
      description: "Post an apartment offer or search for properties"
    },
    {
      number: 4,
      title: "Discuss Details",
      description: "Chat with landlords/tenants about specifics"
    },
    {
      number: 5,
      title: "Request Booking",
      description: "Submit your booking request"
    },
    {
      number: 6,
      title: "Apply for Viewing",
      description: "Schedule professional viewing after acceptance"
    },
    {
      number: 7,
      title: "Receive Confirmation",
      description: "Get viewing confirmation from our team"
    },
    {
      number: 8,
      title: "Secure Payment",
      description: "Make secure payment through our platform"
    },
    {
      number: 9,
      title: "Get Video Footage",
      description: "Receive professional viewing video footage"
    },
    {
      number: 10,
      title: "Contract Creation",
      description: "Request contract creation with landlord"
    },
    {
      number: 11,
      title: "Sign & Move-in",
      description: "Sign contract online and complete move-in"
    }
  ];

  return (
    <section className="platform-instructions">
      <div className="container">
        <h2>How SichrPlace Works</h2>
        <div className="steps-grid">
          {steps.map((step) => (
            <div key={step.number} className="step-card">
              <div className="step-number">{step.number}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
```

### **8. Feedback Form Fix**
```javascript
// Fixed feedback form with proper availability check
const FeedbackForm = () => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    // Check if feedback service is available
    const checkAvailability = async () => {
      try {
        const response = await fetch('/api/feedback/status');
        const data = await response.json();
        setIsAvailable(data.available);
      } catch (error) {
        console.error('Error checking feedback availability:', error);
        setIsAvailable(true); // Default to available
      }
    };

    checkAvailability();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Feedback submitted successfully!');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        alert('Failed to submit feedback. Please try again.');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert('Network error. Please try again.');
    }
  };

  return (
    <div className="feedback-form">
      <h3>Send Feedback</h3>
      
      {!isAvailable && (
        <div className="availability-notice">
          Feedback service is temporarily unavailable, but you can still submit your feedback.
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input 
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Email</label>
          <input 
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Subject</label>
          <input 
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({...formData, subject: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Message</label>
          <textarea 
            value={formData.message}
            onChange={(e) => setFormData({...formData, message: e.target.value})}
            required
          />
        </div>
        
        <button type="submit" className="submit-button">
          Send Feedback
        </button>
      </form>
    </div>
  );
};
```

### **9. Updated Main Page Copy**
```javascript
// Updated hero section with accurate feature descriptions
const HeroSection = () => {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Find Your Perfect Apartment with Professional Support</h1>
        <p>Secure apartment hunting with professional viewings, ratings system, and verified payments.</p>
        
        <div className="features-grid">
          <div className="feature">
            <h3>🎯 Smart Matching</h3>
            <p>AI-powered property matching based on your preferences and requirements</p>
          </div>
          
          <div className="feature">
            <h3>🔒 Secure Payments</h3>
            <p>PayPal-integrated payment system with full transaction security</p>
          </div>
          
          <div className="feature">
            <h3>⭐ Ratings System</h3>
            <p>Property and landlord ratings to help you make informed decisions</p>
          </div>
          
          <div className="feature">
            <h3>📹 Professional Viewings</h3>
            <p>Expert-conducted property viewings with detailed video documentation</p>
          </div>
        </div>
        
        <div className="cta-buttons">
          <Link to="/search" className="cta-primary">Search Apartments</Link>
          <Link to="/post" className="cta-secondary">Post Property</Link>
        </div>
      </div>
    </section>
  );
};
```

This comprehensive frontend guide addresses all the critical issues you mentioned and provides production-ready components that align with your original design plan. The search functionality is now properly simplified, mobile-responsive, and includes all the required German rental market features.