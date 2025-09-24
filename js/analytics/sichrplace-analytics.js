// SichrPlace Analytics Initialization
// This script initializes Google Analytics 4 and Netlify Analytics

(function() {
  'use strict';

  // Configuration
  const ANALYTICS_CONFIG = {
    googleAnalyticsId: 'G-XXXXXXXXXX', // Replace with actual GA4 ID
    enableErrorTracking: true,
    enablePerformanceTracking: true,
    debug: window.location.hostname === 'localhost'
  };

  // Initialize Google Analytics 4
  function initGoogleAnalytics() {
    if (ANALYTICS_CONFIG.googleAnalyticsId === 'G-XXXXXXXXXX') {
      console.warn('Google Analytics ID not configured - skipping GA4 initialization');
      return;
    }

    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_CONFIG.googleAnalyticsId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    
    gtag('js', new Date());
    gtag('config', ANALYTICS_CONFIG.googleAnalyticsId, {
      page_title: document.title,
      page_location: window.location.href,
      custom_map: {
        apartment_id: 'custom_parameter_1',
        search_query: 'custom_parameter_2'
      }
    });

    // Store gtag globally for easy access
    window.trackEvent = function(eventName, parameters = {}) {
      gtag('event', eventName, parameters);
      if (ANALYTICS_CONFIG.debug) {
        console.log('[Analytics] Event tracked:', eventName, parameters);
      }
    };

    console.log('Google Analytics 4 initialized');
  }

  // Initialize Netlify Analytics
  function initNetlifyAnalytics() {
    if (!document.querySelector('script[src*="netlify.com/v1/analytics.js"]')) {
      const script = document.createElement('script');
      script.defer = true;
      script.src = 'https://analytics.netlify.com/index.js';
      document.head.appendChild(script);
      console.log('Netlify Analytics initialized');
    }
  }

  // Error Tracking
  function initErrorTracking() {
    if (!ANALYTICS_CONFIG.enableErrorTracking) return;

    window.addEventListener('error', function(event) {
      const errorData = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? event.error.stack : null,
        type: 'javascript_error',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      // Send to custom error tracking
      fetch('/.netlify/functions/simple-error-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(console.error);

      // Track in Google Analytics if available
      if (window.trackEvent) {
        window.trackEvent('exception', {
          description: event.message,
          fatal: false
        });
      }
    });

    window.addEventListener('unhandledrejection', function(event) {
      const errorData = {
        message: event.reason ? event.reason.message : 'Unhandled Promise Rejection',
        error: event.reason ? event.reason.stack : null,
        type: 'promise_rejection',
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      fetch('/.netlify/functions/simple-error-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(console.error);
    });

    console.log('Error tracking initialized');
  }

  // Performance Tracking
  function initPerformanceTracking() {
    if (!ANALYTICS_CONFIG.enablePerformanceTracking) return;

    window.addEventListener('load', function() {
      setTimeout(function() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation && window.trackEvent) {
          window.trackEvent('timing_complete', {
            name: 'page_load_time',
            value: Math.round(navigation.loadEventEnd - navigation.fetchStart)
          });

          window.trackEvent('timing_complete', {
            name: 'dom_content_loaded',
            value: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart)
          });
        }
      }, 100);
    });

    console.log('Performance tracking initialized');
  }

  // SichrPlace-specific tracking functions
  window.SichrPlaceAnalytics = {
    trackApartmentSearch: function(searchParams) {
      if (window.trackEvent) {
        window.trackEvent('apartment_search', {
          search_term: searchParams.city || '',
          price_min: searchParams.minPrice || '',
          price_max: searchParams.maxPrice || '',
          bedrooms: searchParams.bedrooms || '',
          event_category: 'engagement'
        });
      }
    },

    trackApartmentView: function(apartmentId, apartmentTitle) {
      if (window.trackEvent) {
        window.trackEvent('apartment_view', {
          apartment_id: apartmentId,
          apartment_title: apartmentTitle || '',
          event_category: 'engagement'
        });
      }
    },

    trackUserRegistration: function() {
      if (window.trackEvent) {
        window.trackEvent('sign_up', {
          method: 'email',
          event_category: 'user_account'
        });
      }
    },

    trackUserLogin: function() {
      if (window.trackEvent) {
        window.trackEvent('login', {
          method: 'email',
          event_category: 'user_account'
        });
      }
    },

    trackInquiry: function(apartmentId) {
      if (window.trackEvent) {
        window.trackEvent('contact_inquiry', {
          apartment_id: apartmentId,
          event_category: 'lead_generation'
        });
      }
    }
  };

  // Initialize everything when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initGoogleAnalytics();
      initNetlifyAnalytics();
      initErrorTracking();
      initPerformanceTracking();
    });
  } else {
    initGoogleAnalytics();
    initNetlifyAnalytics();
    initErrorTracking();
    initPerformanceTracking();
  }

})();