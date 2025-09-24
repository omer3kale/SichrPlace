// Comprehensive Analytics and Error Tracking Manager
import GoogleAnalytics from './googleAnalytics.js';

class AnalyticsManager {
  constructor(config = {}) {
    this.config = {
      googleAnalyticsId: config.googleAnalyticsId || 'G-XXXXXXXXXX', // Will be replaced with actual ID
      enableErrorTracking: config.enableErrorTracking !== false,
      enablePerformanceTracking: config.enablePerformanceTracking !== false,
      enableNetlifyAnalytics: config.enableNetlifyAnalytics !== false,
      debug: config.debug || false
    };

    // Initialize Google Analytics
    this.ga = new GoogleAnalytics(this.config.googleAnalyticsId);
    
    // Error tracking storage
    this.errorQueue = [];
    this.performanceMetrics = {};

    this.init();
  }

  init() {
    // Initialize Google Analytics
    this.ga.init();

    // Set up error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }

    // Set up performance tracking
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking();
    }

    // Set up Netlify Analytics integration
    if (this.config.enableNetlifyAnalytics) {
      this.setupNetlifyAnalytics();
    }

    this.log('Analytics Manager initialized');
  }

  // Error Tracking Setup
  setupErrorTracking() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
        type: 'javascript_error'
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: event.reason?.message || 'Unhandled Promise Rejection',
        error: event.reason?.stack || event.reason,
        type: 'promise_rejection'
      });
    });

    // Network errors
    this.setupNetworkErrorTracking();
  }

  // Network Error Tracking
  setupNetworkErrorTracking() {
    // Override fetch to track API errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch.apply(this, args);
        const endTime = performance.now();
        
        // Track API performance
        const url = args[0];
        this.trackAPICall(url, response.status, endTime - startTime);

        // Track API errors
        if (!response.ok) {
          this.trackError({
            message: `API Error: ${response.status} ${response.statusText}`,
            url: url,
            status: response.status,
            type: 'api_error'
          });
        }

        return response;
      } catch (error) {
        const endTime = performance.now();
        this.trackError({
          message: `Network Error: ${error.message}`,
          url: args[0],
          error: error.stack,
          type: 'network_error'
        });
        throw error;
      }
    };
  }

  // Performance Tracking Setup
  setupPerformanceTracking() {
    // Page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          this.trackPerformance('page_load_time', navigation.loadEventEnd - navigation.fetchStart);
          this.trackPerformance('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
          this.trackPerformance('first_byte_time', navigation.responseStart - navigation.fetchStart);
        }

        // Core Web Vitals
        this.trackCoreWebVitals();
      }, 100);
    });
  }

  // Core Web Vitals Tracking
  trackCoreWebVitals() {
    // Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.trackPerformance('largest_contentful_paint', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        this.trackPerformance('first_input_delay', entry.processingStart - entry.startTime);
      }
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.trackPerformance('cumulative_layout_shift', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });
  }

  // Netlify Analytics Integration
  setupNetlifyAnalytics() {
    // Add Netlify Analytics script if not already present
    if (!document.querySelector('script[data-netlify-analytics]')) {
      const script = document.createElement('script');
      script.defer = true;
      script.setAttribute('data-netlify-analytics', '');
      script.src = 'https://analytics.netlify.com/index.js';
      document.head.appendChild(script);
      this.log('Netlify Analytics initialized');
    }
  }

  // Track custom events
  trackEvent(eventName, parameters = {}) {
    this.ga.trackEvent(eventName, parameters);
    this.log('Event tracked:', eventName, parameters);
  }

  // Track page views
  trackPageView(pagePath, pageTitle) {
    this.ga.trackPageView(pagePath, pageTitle);
    this.log('Page view tracked:', pagePath, pageTitle);
  }

  // Track errors with enhanced details
  trackError(errorData) {
    const errorInfo = {
      ...errorData,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getCurrentUserId()
    };

    // Store locally for potential retry
    this.errorQueue.push(errorInfo);

    // Send to Google Analytics
    this.ga.trackError(errorInfo.message, errorInfo.type);

    // Send to custom error endpoint
    this.sendErrorToBackend(errorInfo);

    this.log('Error tracked:', errorInfo);
  }

  // Track API calls for monitoring
  trackAPICall(url, status, duration) {
    this.trackEvent('api_call', {
      category: 'api_performance',
      label: url,
      value: Math.round(duration),
      status_code: status,
      custom_parameter_1: url
    });
  }

  // Track performance metrics
  trackPerformance(metric, value) {
    this.performanceMetrics[metric] = value;
    this.ga.trackPerformance(metric, Math.round(value));
    this.log('Performance tracked:', metric, Math.round(value));
  }

  // SichrPlace-specific tracking methods
  trackApartmentSearch(searchParams) {
    this.ga.trackApartmentSearch(searchParams);
    this.trackEvent('apartment_search_enhanced', {
      ...searchParams,
      search_timestamp: new Date().toISOString()
    });
  }

  trackApartmentView(apartmentId, apartmentData = {}) {
    this.ga.trackApartmentView(apartmentId, apartmentData.title);
    this.trackEvent('apartment_view_enhanced', {
      apartment_id: apartmentId,
      price: apartmentData.price,
      city: apartmentData.city,
      rooms: apartmentData.rooms,
      view_timestamp: new Date().toISOString()
    });
  }

  trackUserRegistration(userData = {}) {
    this.ga.trackUserRegistration(userData.method);
    this.trackEvent('user_registration_enhanced', {
      method: userData.method || 'email',
      registration_timestamp: new Date().toISOString()
    });
  }

  trackUserLogin(userData = {}) {
    this.ga.trackUserLogin(userData.method);
    this.trackEvent('user_login_enhanced', {
      method: userData.method || 'email',
      login_timestamp: new Date().toISOString()
    });
  }

  // Send errors to backend for server-side tracking
  async sendErrorToBackend(errorData) {
    try {
      await fetch('/.netlify/functions/error-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorData)
      });
    } catch (error) {
      this.log('Failed to send error to backend:', error);
    }
  }

  // Get current user ID for error tracking
  getCurrentUserId() {
    // Try to get user ID from localStorage or session
    return localStorage.getItem('userId') || 
           sessionStorage.getItem('userId') || 
           'anonymous';
  }

  // Debug logging
  log(...args) {
    if (this.config.debug) {
      console.log('[Analytics]', ...args);
    }
  }

  // Get analytics summary
  getAnalyticsSummary() {
    return {
      googleAnalyticsId: this.config.googleAnalyticsId,
      isInitialized: this.ga.isInitialized,
      errorCount: this.errorQueue.length,
      performanceMetrics: this.performanceMetrics,
      config: this.config
    };
  }
}

// Create global analytics instance
window.AnalyticsManager = AnalyticsManager;

export default AnalyticsManager;