// 🛡️ SichrPlace Bulletproof Registration System
// Eliminates network errors through comprehensive retry and fallback mechanisms

class BulletproofRegistration {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.endpoints = [
      '/.netlify/functions/auth-register',
      '/api/auth-register',
      '/api/register',
      '/api/signup'
    ];
    this.isOnline = navigator.onLine;
    this.setupNetworkMonitoring();
  }

  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🟢 Network connection restored');
      this.showNetworkStatus('Back online! You can now create your account.', 'success');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔴 Network connection lost');
      this.showNetworkStatus('You appear to be offline. Please check your connection.', 'warning');
    });
  }

  async register(userData) {
    console.log('🚀 Starting bulletproof registration process...');
    
    // Pre-flight checks
    if (!this.isOnline) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    // Connection health check
    await this.performHealthCheck();

    // Attempt registration with retry mechanism
    return await this.attemptRegistrationWithRetry(userData);
  }

  async performHealthCheck() {
    console.log('🔍 Performing connection health check...');
    
    const healthEndpoints = [
      '/.netlify/functions/health',
      '/api/health',
      '/api/simple-health'
    ];

    for (const endpoint of healthEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          timeout: 5000
        });

        if (response.ok) {
          console.log(`✅ Health check passed: ${endpoint}`);
          return true;
        }
      } catch (error) {
        console.warn(`⚠️ Health check failed: ${endpoint} - ${error.message}`);
        continue;
      }
    }

    // If all health checks fail, still allow registration attempt
    console.warn('⚠️ Health checks failed, proceeding with registration attempt...');
    return false;
  }

  async attemptRegistrationWithRetry(userData) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`🎯 Registration attempt ${attempt}/${this.maxRetries}`);
      
      for (const endpoint of this.endpoints) {
        try {
          console.log(`📡 Trying endpoint: ${endpoint}`);
          
          const result = await this.makeRegistrationRequest(endpoint, userData);
          
          if (result.success) {
            console.log('🎉 Registration successful!');
            return result;
          }
          
          // If endpoint returns an error but connection worked
          if (result.error) {
            throw new Error(result.error);
          }

        } catch (error) {
          console.warn(`❌ Endpoint ${endpoint} failed:`, error.message);
          lastError = error;
          
          // If it's a user error (not network), don't retry other endpoints
          if (this.isUserError(error)) {
            throw error;
          }
          
          continue; // Try next endpoint
        }
      }

      // If all endpoints failed, wait before retrying
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw new Error(
      lastError?.message || 
      'Registration failed after multiple attempts. Please try again later or contact support.'
    );
  }

  async makeRegistrationRequest(endpoint, userData) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle different response types
      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { error: `Invalid response format: ${text}` };
      }

      if (response.ok) {
        return { success: true, data: result };
      } else {
        return { success: false, error: result.error || result.message || 'Registration failed' };
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection and try again.');
      }
      
      throw error;
    }
  }

  isUserError(error) {
    const userErrorMessages = [
      'email already exists',
      'username already taken',
      'invalid email',
      'password too weak',
      'missing required fields',
      'passwords do not match'
    ];

    const message = error.message.toLowerCase();
    return userErrorMessages.some(errorMsg => message.includes(errorMsg));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  showNetworkStatus(message, type) {
    // Create or update network status indicator
    let indicator = document.getElementById('network-status');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'network-status';
      indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 12px;
        text-align: center;
        font-weight: 500;
        z-index: 9999;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(indicator);
    }

    // Style based on type
    const styles = {
      success: { background: '#10B981', color: 'white' },
      warning: { background: '#F59E0B', color: 'white' },
      error: { background: '#EF4444', color: 'white' }
    };

    const style = styles[type] || styles.error;
    indicator.style.backgroundColor = style.background;
    indicator.style.color = style.color;
    indicator.textContent = message;
    indicator.style.transform = 'translateY(0)';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      indicator.style.transform = 'translateY(-100%)';
    }, 5000);
  }

  getConnectionQuality() {
    // Check connection quality if available
    if ('connection' in navigator) {
      const connection = navigator.connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt
      };
    }
    return null;
  }

  logRegistrationAttempt(userData, attempt, endpoint, error = null) {
    const logData = {
      timestamp: new Date().toISOString(),
      attempt,
      endpoint,
      userType: userData.userType,
      connection: this.getConnectionQuality(),
      online: this.isOnline,
      error: error?.message
    };

    console.log('📊 Registration attempt logged:', logData);
    
    // Store in localStorage for debugging
    const logs = JSON.parse(localStorage.getItem('registrationLogs') || '[]');
    logs.push(logData);
    
    // Keep only last 10 logs
    if (logs.length > 10) {
      logs.shift();
    }
    
    localStorage.setItem('registrationLogs', JSON.stringify(logs));
  }
}

// Enhanced SignupManager with bulletproof registration
class EnhancedSignupManager {
  constructor() {
    this.bulletproofRegistration = new BulletproofRegistration();
    this.form = document.getElementById('signupForm');
    this.errorMessage = document.getElementById('error-message');
    this.successMessage = document.getElementById('success-message');
    this.btnText = document.getElementById('btn-text');
    this.spinner = document.getElementById('spinner');
    this.accountTypes = document.querySelectorAll('.account-type');
    this.selectedAccountType = null;
    
    this.init();
  }

  init() {
    // Account type selection
    this.accountTypes.forEach(type => {
      type.addEventListener('click', (e) => {
        const accountType = e.currentTarget.dataset.type;
        this.selectAccountType(accountType, e.currentTarget);
      });
    });

    // Form submission
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Real-time validation
    this.setupRealTimeValidation();
    
    console.log('✅ Enhanced Signup Manager initialized');
  }

  setupRealTimeValidation() {
    const fields = ['fullName', 'email', 'password', 'confirmPassword'];
    
    fields.forEach(fieldName => {
      const field = document.getElementById(fieldName);
      if (field) {
        field.addEventListener('blur', () => this.validateField(fieldName, field.value));
        field.addEventListener('input', () => this.clearFieldError(fieldName));
      }
    });
  }

  validateField(fieldName, value) {
    let error = null;

    switch (fieldName) {
      case 'fullName':
        if (!value.trim()) error = 'Full name is required';
        else if (value.length < 2) error = 'Full name must be at least 2 characters';
        break;
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value) error = 'Email is required';
        else if (!emailRegex.test(value)) error = 'Please enter a valid email address';
        break;
      
      case 'password':
        if (!value) error = 'Password is required';
        else if (value.length < 6) error = 'Password must be at least 6 characters';
        else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          error = 'Password should contain uppercase, lowercase and number';
        }
        break;
      
      case 'confirmPassword':
        const password = document.getElementById('password').value;
        if (!value) error = 'Please confirm your password';
        else if (value !== password) error = 'Passwords do not match';
        break;
    }

    this.showFieldError(fieldName, error);
    return !error;
  }

  showFieldError(fieldName, error) {
    const field = document.getElementById(fieldName);
    let errorElement = document.getElementById(`${fieldName}-error`);
    
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = `${fieldName}-error`;
      errorElement.style.cssText = 'color: #EF4444; font-size: 12px; margin-top: 4px;';
      field.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = error || '';
    field.style.borderColor = error ? '#EF4444' : '';
  }

  clearFieldError(fieldName) {
    const errorElement = document.getElementById(`${fieldName}-error`);
    const field = document.getElementById(fieldName);
    
    if (errorElement) {
      errorElement.textContent = '';
    }
    field.style.borderColor = '';
  }

  selectAccountType(accountType, typeElement) {
    if (this.selectedAccountType === accountType) {
      this.deselectAccountType();
      return;
    }

    this.accountTypes.forEach(t => t.classList.remove('selected'));
    typeElement.classList.add('selected');
    this.selectedAccountType = accountType;
    this.hideMessages();
  }

  deselectAccountType() {
    this.accountTypes.forEach(t => t.classList.remove('selected'));
    this.selectedAccountType = null;
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    if (!this.selectedAccountType) {
      this.showError('Please select an account type');
      return;
    }

    // Validate all fields
    const fields = ['fullName', 'email', 'password', 'confirmPassword'];
    let isValid = true;
    
    fields.forEach(fieldName => {
      const field = document.getElementById(fieldName);
      if (!this.validateField(fieldName, field.value)) {
        isValid = false;
      }
    });

    if (!isValid) {
      this.showError('Please fix the errors above');
      return;
    }

    const userData = {
      username: document.getElementById('email').value,
      fullName: document.getElementById('fullName').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      confirmPassword: document.getElementById('confirmPassword').value,
      userType: this.selectedAccountType === 'tenant' ? 'applicant' : this.selectedAccountType
    };

    if (userData.password !== userData.confirmPassword) {
      this.showError('Passwords do not match');
      return;
    }

    this.setLoading(true);
    this.hideMessages();

    try {
      console.log('🚀 Starting bulletproof registration...');
      const result = await this.bulletproofRegistration.register(userData);
      
      this.showSuccess('Account created successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = result.data?.redirectUrl || 'login.html';
      }, 2000);
      
    } catch (error) {
      console.error('💥 Registration failed:', error);
      this.handleRegistrationError(error);
    } finally {
      this.setLoading(false);
    }
  }

  handleRegistrationError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('email already exists') || message.includes('username already')) {
      this.showError('An account with this email already exists. Try logging in instead.');
    } else if (message.includes('password')) {
      this.showError('Password requirements not met. Please choose a stronger password.');
    } else if (message.includes('offline') || message.includes('network')) {
      this.showError('Connection issue detected. Please check your internet and try again.');
    } else if (message.includes('timeout')) {
      this.showError('Request timed out. Please try again with a stable connection.');
    } else {
      this.showError('Registration failed. Please try again or contact support if the problem persists.');
    }
  }

  setLoading(loading) {
    if (loading) {
      this.btnText.style.display = 'none';
      this.spinner.style.display = 'block';
    } else {
      this.btnText.style.display = 'block';
      this.spinner.style.display = 'none';
    }
    this.form.querySelector('.btn').disabled = loading;
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
    this.successMessage.style.display = 'none';
    
    // Scroll to error message
    this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showSuccess(message) {
    this.successMessage.textContent = message;
    this.successMessage.style.display = 'block';
    this.errorMessage.style.display = 'none';
  }

  hideMessages() {
    this.errorMessage.style.display = 'none';
    this.successMessage.style.display = 'none';
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Replace the old SignupManager with enhanced version
  window.signupManager = new EnhancedSignupManager();
  console.log('🛡️ Bulletproof registration system activated!');
});

// Export for debugging
window.BulletproofRegistration = BulletproofRegistration;