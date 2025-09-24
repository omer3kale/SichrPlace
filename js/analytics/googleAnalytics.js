// Google Analytics 4 Configuration and Setup
class GoogleAnalytics {
  constructor(measurementId) {
    this.measurementId = measurementId;
    this.isInitialized = false;
  }

  // Initialize Google Analytics 4
  init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    // Load gtag script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    
    gtag('js', new Date());
    gtag('config', this.measurementId, {
      page_title: document.title,
      page_location: window.location.href,
      custom_map: {
        custom_parameter_1: 'apartment_search',
        custom_parameter_2: 'user_engagement'
      }
    });

    this.isInitialized = true;
    console.log('Google Analytics 4 initialized with ID:', this.measurementId);
  }

  // Track page views
  trackPageView(pagePath, pageTitle) {
    if (!this.isInitialized) return;
    
    window.gtag('config', this.measurementId, {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }

  // Track custom events
  trackEvent(eventName, parameters = {}) {
    if (!this.isInitialized) return;
    
    window.gtag('event', eventName, {
      event_category: parameters.category || 'engagement',
      event_label: parameters.label,
      value: parameters.value,
      custom_parameter_1: parameters.apartment_id,
      custom_parameter_2: parameters.search_query,
      ...parameters
    });
  }

  // Track apartment searches
  trackApartmentSearch(searchParams) {
    this.trackEvent('apartment_search', {
      category: 'search',
      label: 'apartment_listing_search',
      search_term: searchParams.city || '',
      price_range: `${searchParams.minPrice || 0}-${searchParams.maxPrice || 'unlimited'}`,
      bedrooms: searchParams.bedrooms || 'any',
      custom_parameter_1: JSON.stringify(searchParams)
    });
  }

  // Track apartment views
  trackApartmentView(apartmentId, apartmentTitle) {
    this.trackEvent('apartment_view', {
      category: 'engagement',
      label: 'apartment_detail_view',
      apartment_id: apartmentId,
      apartment_title: apartmentTitle,
      custom_parameter_1: apartmentId
    });
  }

  // Track user registration
  trackUserRegistration(method = 'email') {
    this.trackEvent('sign_up', {
      method: method,
      category: 'user_account',
      label: 'user_registration'
    });
  }

  // Track user login
  trackUserLogin(method = 'email') {
    this.trackEvent('login', {
      method: method,
      category: 'user_account',
      label: 'user_login'
    });
  }

  // Track apartment inquiries
  trackApartmentInquiry(apartmentId, inquiryType = 'contact') {
    this.trackEvent('apartment_inquiry', {
      category: 'lead_generation',
      label: inquiryType,
      apartment_id: apartmentId,
      custom_parameter_1: apartmentId
    });
  }

  // Track errors
  trackError(errorMessage, errorLocation) {
    this.trackEvent('exception', {
      description: errorMessage,
      fatal: false,
      category: 'error_tracking',
      label: errorLocation,
      custom_parameter_2: errorLocation
    });
  }

  // Track performance metrics
  trackPerformance(metric, value, category = 'performance') {
    this.trackEvent('timing_complete', {
      name: metric,
      value: value,
      category: category,
      label: metric
    });
  }

  // Enhanced ecommerce tracking for premium features
  trackPurchase(transactionId, value, items = []) {
    this.trackEvent('purchase', {
      transaction_id: transactionId,
      value: value,
      currency: 'EUR',
      items: items,
      category: 'ecommerce'
    });
  }
}

// Export for use in other modules
export default GoogleAnalytics;