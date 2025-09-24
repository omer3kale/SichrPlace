// 🔥 BULLETPROOF FRONTEND PAYPAL INTEGRATION
// 100% Enterprise-Grade PayPal Client with Advanced Security

class BulletproofPayPalIntegration {
  constructor() {
    this.config = null;
    this.isSDKLoaded = false;
    this.authToken = localStorage.getItem('authToken');
    this.baseURL = window.location.origin;
    this.correlationId = this.generateCorrelationId();
    
    // Enterprise error tracking
    this.errorTracker = {
      errors: [],
      maxErrors: 50,
      sessionId: this.generateSessionId()
    };
    
    // Performance monitoring
    this.performanceTracker = {
      payments: [],
      startTime: Date.now()
    };
    
    console.log('🚀 Bulletproof PayPal Integration initialized', {
      correlationId: this.correlationId,
      sessionId: this.errorTracker.sessionId
    });
  }

  generateCorrelationId() {
    return 'pp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 🛡️ SECURE ERROR HANDLING
  logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message || error,
      stack: error.stack,
      context: this.sanitizeContext(context),
      correlationId: this.correlationId,
      sessionId: this.errorTracker.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errorTracker.errors.push(errorLog);
    
    // Keep only last 50 errors
    if (this.errorTracker.errors.length > this.errorTracker.maxErrors) {
      this.errorTracker.errors.shift();
    }

    console.error('❌ PayPal Integration Error:', errorLog);
    
    // Send to monitoring service
    this.sendErrorToMonitoring(errorLog);
  }

  sanitizeContext(context) {
    // Remove sensitive data from context
    const sanitized = { ...context };
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'authorization'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  sendErrorToMonitoring(errorLog) {
    // This would integrate with your monitoring service
    try {
      fetch('/api/monitoring/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorLog)
      }).catch(() => {}); // Silent fail for monitoring
    } catch (e) {
      // Silent fail
    }
  }

  // 📊 PERFORMANCE TRACKING
  trackPaymentPerformance(action, duration, metadata = {}) {
    const performanceData = {
      action,
      duration,
      timestamp: new Date().toISOString(),
      metadata: this.sanitizeContext(metadata),
      correlationId: this.correlationId
    };

    this.performanceTracker.payments.push(performanceData);
    
    console.log('📊 PayPal Performance:', performanceData);
  }

  // 🔐 SECURE API CALLS
  async secureApiCall(endpoint, options = {}) {
    const startTime = Date.now();
    
    try {
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'X-Correlation-ID': this.correlationId,
        'X-Session-ID': this.errorTracker.sessionId
      };

      if (this.authToken) {
        defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(endpoint, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      const duration = Date.now() - startTime;
      this.trackPaymentPerformance('api_call', duration, { endpoint, status: response.status });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`API Error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logError(error, { endpoint, duration });
      throw error;
    }
  }

  // 🚀 INITIALIZE PAYPAL SDK
  async initialize() {
    try {
      console.log('🔄 Initializing PayPal SDK...');
      
      // Fetch configuration from bulletproof backend
      this.config = await this.secureApiCall('/.netlify/functions/paypal-enterprise?action=config');
      
      if (!this.config.success) {
        throw new Error('Failed to fetch PayPal configuration');
      }

      console.log('✅ PayPal configuration loaded:', {
        environment: this.config.config.environment,
        currency: this.config.config.currency,
        locale: this.config.config.locale
      });

      // Load PayPal SDK with enterprise configuration
      await this.loadPayPalSDK();
      
      console.log('🎉 PayPal SDK ready for payments!');
      
    } catch (error) {
      this.logError(error, { action: 'initialize' });
      throw error;
    }
  }

  async loadPayPalSDK() {
    if (this.isSDKLoaded) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const config = this.config.config;
      
      script.src = `https://www.paypal.com/sdk/js?` +
        `client-id=${config.clientId}&` +
        `currency=${config.currency}&` +
        `locale=${config.locale}&` +
        `components=buttons&` +
        `enable-funding=venmo,paylater&` +
        `intent=capture&` +
        `vault=false&` +
        `commit=true`;

      script.onload = () => {
        this.isSDKLoaded = true;
        console.log('✅ PayPal SDK loaded successfully');
        resolve();
      };

      script.onerror = () => {
        const error = new Error('Failed to load PayPal SDK');
        this.logError(error, { action: 'load_sdk' });
        reject(error);
      };

      document.head.appendChild(script);
    });
  }

  // 🏠 APARTMENT VIEWING PAYMENT
  async createViewingPaymentButton(containerId, options = {}) {
    try {
      if (!this.isSDKLoaded) {
        await this.initialize();
      }

      const {
        apartmentId,
        viewingRequestId,
        apartmentTitle = 'Apartment Viewing',
        onSuccess = () => {},
        onError = () => {},
        onCancel = () => {}
      } = options;

      if (!apartmentId || !viewingRequestId) {
        throw new Error('apartmentId and viewingRequestId are required for viewing payments');
      }

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      container.innerHTML = `
        <div class="paypal-container">
          <div class="payment-info">
            <h4>🏠 Apartment Viewing Payment</h4>
            <p><strong>${apartmentTitle}</strong></p>
            <p>Viewing Fee: <strong>€${this.config.config.businessRules.viewingFee}</strong></p>
            <p class="security-note">🔒 Secure payment powered by PayPal</p>
          </div>
          <div id="${containerId}-buttons"></div>
          <div id="${containerId}-status" class="payment-status"></div>
        </div>
      `;

      await this.renderPayPalButtons(`${containerId}-buttons`, {
        paymentType: 'viewing',
        createPaymentData: { apartmentId, viewingRequestId },
        onSuccess,
        onError,
        onCancel,
        statusContainer: `${containerId}-status`
      });

    } catch (error) {
      this.logError(error, { action: 'create_viewing_payment', apartmentId: options.apartmentId });
      throw error;
    }
  }

  // 🏢 APARTMENT BOOKING PAYMENT
  async createBookingPaymentButton(containerId, options = {}) {
    try {
      if (!this.isSDKLoaded) {
        await this.initialize();
      }

      const {
        apartmentId,
        monthlyRent,
        apartmentTitle = 'Apartment Booking',
        bookingData = {},
        onSuccess = () => {},
        onError = () => {},
        onCancel = () => {}
      } = options;

      if (!apartmentId || !monthlyRent) {
        throw new Error('apartmentId and monthlyRent are required for booking payments');
      }

      // Calculate booking fee
      const bookingFee = Math.max(
        this.config.config.businessRules.minBookingFee || 50,
        Math.min(
          monthlyRent * (this.config.config.businessRules.bookingFeePercentage || 0.05),
          this.config.config.businessRules.maxBookingFee || 500
        )
      );

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      container.innerHTML = `
        <div class="paypal-container">
          <div class="payment-info">
            <h4>🏢 Apartment Booking Payment</h4>
            <p><strong>${apartmentTitle}</strong></p>
            <p>Monthly Rent: <strong>€${monthlyRent}</strong></p>
            <p>Booking Fee (${(this.config.config.businessRules.bookingFeePercentage * 100).toFixed(1)}%): <strong>€${bookingFee.toFixed(2)}</strong></p>
            <p class="security-note">🔒 Secure payment powered by PayPal</p>
          </div>
          <div id="${containerId}-buttons"></div>
          <div id="${containerId}-status" class="payment-status"></div>
        </div>
      `;

      await this.renderPayPalButtons(`${containerId}-buttons`, {
        paymentType: 'booking',
        createPaymentData: { apartmentId, bookingData },
        expectedAmount: bookingFee,
        onSuccess,
        onError,
        onCancel,
        statusContainer: `${containerId}-status`
      });

    } catch (error) {
      this.logError(error, { action: 'create_booking_payment', apartmentId: options.apartmentId });
      throw error;
    }
  }

  // 🛒 MARKETPLACE PAYMENT
  async createMarketplacePaymentButton(containerId, options = {}) {
    try {
      if (!this.isSDKLoaded) {
        await this.initialize();
      }

      const {
        itemId,
        itemData = {},
        onSuccess = () => {},
        onError = () => {},
        onCancel = () => {}
      } = options;

      if (!itemId || !itemData.price || !itemData.title) {
        throw new Error('itemId, itemData.price, and itemData.title are required for marketplace payments');
      }

      const itemPrice = parseFloat(itemData.price);
      const commission = Math.max(
        this.config.config.businessRules.minMarketplaceFee || 2,
        itemPrice * (this.config.config.businessRules.marketplaceCommission || 0.08)
      );
      const sellerAmount = itemPrice - commission;

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      container.innerHTML = `
        <div class="paypal-container">
          <div class="payment-info">
            <h4>🛒 Marketplace Payment</h4>
            <p><strong>${itemData.title}</strong></p>
            <p>Item Price: <strong>€${itemPrice.toFixed(2)}</strong></p>
            <p>Platform Fee: <strong>€${commission.toFixed(2)}</strong></p>
            <p>Seller Receives: <strong>€${sellerAmount.toFixed(2)}</strong></p>
            <p class="security-note">🔒 Secure payment powered by PayPal</p>
          </div>
          <div id="${containerId}-buttons"></div>
          <div id="${containerId}-status" class="payment-status"></div>
        </div>
      `;

      await this.renderPayPalButtons(`${containerId}-buttons`, {
        paymentType: 'marketplace',
        createPaymentData: { itemId, itemData },
        expectedAmount: itemPrice,
        onSuccess,
        onError,
        onCancel,
        statusContainer: `${containerId}-status`
      });

    } catch (error) {
      this.logError(error, { action: 'create_marketplace_payment', itemId: options.itemId });
      throw error;
    }
  }

  // 🎨 RENDER PAYPAL BUTTONS
  async renderPayPalButtons(containerId, options) {
    const {
      paymentType,
      createPaymentData,
      expectedAmount,
      onSuccess,
      onError,
      onCancel,
      statusContainer
    } = options;

    const statusElement = document.getElementById(statusContainer);
    
    const updateStatus = (message, type = 'info') => {
      if (statusElement) {
        statusElement.innerHTML = `<div class="status-${type}">${message}</div>`;
      }
    };

    return window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal',
        height: 45,
        tagline: false
      },

      createOrder: async () => {
        const startTime = Date.now();
        
        try {
          updateStatus('🔄 Creating secure payment...', 'info');
          
          let endpoint;
          switch (paymentType) {
            case 'viewing':
              endpoint = `/.netlify/functions/paypal-enterprise?action=create_viewing_payment`;
              break;
            case 'booking':
              endpoint = `/.netlify/functions/paypal-enterprise?action=create_booking_payment`;
              break;
            case 'marketplace':
              endpoint = `/.netlify/functions/paypal-enterprise?action=create_marketplace_payment`;
              break;
            default:
              throw new Error(`Unknown payment type: ${paymentType}`);
          }

          const result = await this.secureApiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(createPaymentData)
          });

          if (!result.success) {
            throw new Error(result.error || 'Failed to create payment');
          }

          const duration = Date.now() - startTime;
          this.trackPaymentPerformance('create_order', duration, { paymentType, amount: result.amount });

          updateStatus('✅ Payment created successfully', 'success');
          
          console.log('💰 Payment created:', {
            paymentId: result.paymentId,
            paypalOrderId: result.paypalOrderId,
            amount: result.amount,
            currency: result.currency
          });

          return result.paypalOrderId;

        } catch (error) {
          const duration = Date.now() - startTime;
          this.logError(error, { action: 'create_order', paymentType, duration });
          updateStatus(`❌ Payment creation failed: ${error.message}`, 'error');
          onError(error);
          throw error;
        }
      },

      onApprove: async (data) => {
        const startTime = Date.now();
        
        try {
          updateStatus('🔄 Processing your payment...', 'info');
          
          const result = await this.secureApiCall('/.netlify/functions/paypal-enterprise?action=capture_payment', {
            method: 'POST',
            body: JSON.stringify({
              paypalOrderId: data.orderID
            })
          });

          if (!result.success) {
            throw new Error(result.error || 'Payment capture failed');
          }

          const duration = Date.now() - startTime;
          this.trackPaymentPerformance('capture_payment', duration, { 
            paymentType, 
            paymentId: result.paymentId,
            amount: result.amount 
          });

          updateStatus('🎉 Payment completed successfully!', 'success');
          
          console.log('🎉 Payment completed:', {
            paymentId: result.paymentId,
            captureId: result.captureId,
            amount: result.amount,
            status: result.status
          });

          // Show success message
          this.showSuccessMessage(paymentType, result);
          
          // Call success callback
          onSuccess(result);

        } catch (error) {
          const duration = Date.now() - startTime;
          this.logError(error, { action: 'capture_payment', paymentType, orderID: data.orderID, duration });
          updateStatus(`❌ Payment processing failed: ${error.message}`, 'error');
          onError(error);
        }
      },

      onCancel: (data) => {
        console.log('💔 Payment cancelled by user:', data);
        updateStatus('💔 Payment cancelled', 'warning');
        onCancel(data);
      },

      onError: (error) => {
        this.logError(error, { action: 'paypal_button_error', paymentType });
        updateStatus(`❌ PayPal error: ${error.message || 'Unknown error'}`, 'error');
        onError(error);
      }

    }).render(`#${containerId}`);
  }

  // 🎉 SUCCESS MESSAGE DISPLAY
  showSuccessMessage(paymentType, result) {
    const messages = {
      viewing: `🏠 Viewing access granted! You can now schedule your apartment viewing.`,
      booking: `🏢 Booking confirmed! Your apartment has been reserved and you'll receive confirmation details shortly.`,
      marketplace: `🛒 Purchase complete! You've successfully bought this item from the marketplace.`
    };

    const message = messages[paymentType] || 'Payment completed successfully!';
    
    // Create success modal
    const modal = document.createElement('div');
    modal.className = 'payment-success-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="success-icon">✅</div>
        <h2>Payment Successful!</h2>
        <p>${message}</p>
        <div class="payment-details">
          <p><strong>Payment ID:</strong> ${result.paymentId}</p>
          <p><strong>Amount:</strong> €${result.amount} ${result.currency}</p>
          <p><strong>Status:</strong> ${result.status}</p>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" class="close-button">
          Continue
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (modal.parentElement) {
        modal.remove();
      }
    }, 10000);
  }

  // 📊 GET PAYMENT STATUS
  async getPaymentStatus(paymentId) {
    try {
      const result = await this.secureApiCall(`/.netlify/functions/paypal-enterprise?action=payment_status&paymentId=${paymentId}`);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch payment status');
      }

      return result.payment;

    } catch (error) {
      this.logError(error, { action: 'get_payment_status', paymentId });
      throw error;
    }
  }

  // 📈 GET PERFORMANCE METRICS
  getPerformanceMetrics() {
    const totalPayments = this.performanceTracker.payments.length;
    const avgDuration = totalPayments > 0 
      ? this.performanceTracker.payments.reduce((sum, p) => sum + p.duration, 0) / totalPayments 
      : 0;

    return {
      sessionId: this.errorTracker.sessionId,
      correlationId: this.correlationId,
      totalPayments,
      averagePaymentTime: Math.round(avgDuration),
      errorCount: this.errorTracker.errors.length,
      sessionDuration: Date.now() - this.performanceTracker.startTime,
      payments: this.performanceTracker.payments,
      errors: this.errorTracker.errors
    };
  }

  // 🔍 HEALTH CHECK
  async healthCheck() {
    try {
      const startTime = Date.now();
      
      if (!this.config) {
        await this.initialize();
      }

      const duration = Date.now() - startTime;
      
      return {
        healthy: true,
        sdkLoaded: this.isSDKLoaded,
        configLoaded: !!this.config,
        authToken: !!this.authToken,
        initializationTime: duration,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logError(error, { action: 'health_check' });
      
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 🌐 GLOBAL INTEGRATION
window.bulletproofPayPal = new BulletproofPayPalIntegration();

// 🎨 CSS STYLES FOR PAYPAL INTEGRATION
const style = document.createElement('style');
style.textContent = `
  .paypal-container {
    border: 2px solid #e0e6ed;
    border-radius: 8px;
    padding: 20px;
    margin: 16px 0;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .payment-info {
    margin-bottom: 20px;
  }

  .payment-info h4 {
    margin: 0 0 12px 0;
    color: #2c3e50;
    font-size: 18px;
  }

  .payment-info p {
    margin: 4px 0;
    color: #34495e;
  }

  .security-note {
    font-size: 12px;
    color: #27ae60;
    font-weight: 500;
    margin-top: 12px !important;
  }

  .payment-status {
    margin-top: 16px;
    padding: 8px;
    border-radius: 4px;
  }

  .status-info {
    background-color: #e3f2fd;
    color: #1976d2;
    border: 1px solid #bbdefb;
  }

  .status-success {
    background-color: #e8f5e8;
    color: #2e7d32;
    border: 1px solid #a5d6a7;
  }

  .status-error {
    background-color: #ffebee;
    color: #c62828;
    border: 1px solid #ffcdd2;
  }

  .status-warning {
    background-color: #fff3e0;
    color: #ef6c00;
    border: 1px solid #ffcc02;
  }

  .payment-success-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  }

  .modal-content {
    background: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }

  .success-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .payment-details {
    background: #f8f9fa;
    padding: 16px;
    border-radius: 8px;
    margin: 16px 0;
    text-align: left;
  }

  .payment-details p {
    margin: 4px 0;
    font-family: monospace;
    font-size: 14px;
  }

  .close-button {
    background: #007cba;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    margin-top: 16px;
  }

  .close-button:hover {
    background: #005a8a;
  }
`;

document.head.appendChild(style);

console.log('🔥 Bulletproof PayPal Integration loaded successfully!');
console.log('📖 Usage Examples:');
console.log('  // Viewing Payment:');
console.log('  window.bulletproofPayPal.createViewingPaymentButton("payment-container", {');
console.log('    apartmentId: "123",');
console.log('    viewingRequestId: "vr_456",');
console.log('    apartmentTitle: "Beautiful 2BR Apartment"');
console.log('  });');
console.log('');
console.log('  // Booking Payment:');
console.log('  window.bulletproofPayPal.createBookingPaymentButton("booking-container", {');
console.log('    apartmentId: "123",');
console.log('    monthlyRent: 1200,');
console.log('    apartmentTitle: "Luxury Downtown Loft"');
console.log('  });');
console.log('');
console.log('  // Marketplace Payment:');
console.log('  window.bulletproofPayPal.createMarketplacePaymentButton("marketplace-container", {');
console.log('    itemId: "item_789",');
console.log('    itemData: { title: "Moving Service", price: 150 }');
console.log('  });');