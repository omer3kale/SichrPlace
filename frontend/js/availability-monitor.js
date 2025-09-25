// 🔄 CONTINUOUS FUNCTION AVAILABILITY MONITOR
// Prevents network unavailability through real-time monitoring
// Auto-alerts when any function becomes unreachable

class ContinuousAvailabilityMonitor {
  constructor() {
    this.monitoringInterval = 5 * 60 * 1000; // 5 minutes
    this.criticalFunctions = [
      'health', 'auth-register', 'auth-login', 'apartments', 'search',
      'messages', 'paypal-payments', 'file-upload', 'notifications'
    ];
    this.failureThreshold = 3; // Alert after 3 consecutive failures
    this.failures = new Map();
    this.isMonitoring = false;
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    console.log('🔄 Starting continuous availability monitoring...');
    console.log(`📊 Monitoring ${this.criticalFunctions.length} critical functions every ${this.monitoringInterval / 1000 / 60} minutes`);
    
    this.isMonitoring = true;
    this.monitorLoop();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('⏹️ Availability monitoring stopped');
  }

  async monitorLoop() {
    while (this.isMonitoring) {
      await this.checkAllFunctions();
      await this.sleep(this.monitoringInterval);
    }
  }

  async checkAllFunctions() {
    console.log(`🔍 [${new Date().toISOString()}] Checking function availability...`);
    
    const results = {
      available: 0,
      unavailable: 0,
      total: this.criticalFunctions.length
    };

    for (const func of this.criticalFunctions) {
      const isAvailable = await this.checkFunction(func);
      
      if (isAvailable) {
        results.available++;
        this.clearFailureCount(func);
      } else {
        results.unavailable++;
        this.recordFailure(func);
      }
    }

    const availability = (results.available / results.total) * 100;
    
    if (availability === 100) {
      console.log('✅ All functions available - No network unavailability risk');
    } else {
      console.warn(`⚠️ ${results.unavailable}/${results.total} functions unavailable (${availability.toFixed(1)}% availability)`);
      this.sendAlert(results);
    }

    return results;
  }

  async checkFunction(functionName) {
    try {
      const response = await fetch(`/api/${functionName}`, {
        method: 'HEAD', // Lightweight check
        timeout: 5000
      });
      
      return response.status !== 404;
      
    } catch (error) {
      console.error(`❌ ${functionName}: ${error.message}`);
      return false;
    }
  }

  recordFailure(functionName) {
    const currentCount = this.failures.get(functionName) || 0;
    const newCount = currentCount + 1;
    this.failures.set(functionName, newCount);
    
    if (newCount >= this.failureThreshold) {
      this.sendCriticalAlert(functionName, newCount);
    }
  }

  clearFailureCount(functionName) {
    if (this.failures.has(functionName)) {
      this.failures.delete(functionName);
    }
  }

  sendAlert(results) {
    const alert = {
      timestamp: new Date().toISOString(),
      severity: 'WARNING',
      message: `Function availability degraded: ${results.available}/${results.total} available`,
      details: results,
      action: 'Check netlify.toml API routes and function deployments'
    };

    console.warn('🚨 AVAILABILITY ALERT:', alert);
    
    // Store alert for dashboard
    this.storeAlert(alert);
  }

  sendCriticalAlert(functionName, failureCount) {
    const alert = {
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      message: `Function ${functionName} unavailable for ${failureCount} consecutive checks`,
      function: functionName,
      failureCount,
      action: 'Immediate intervention required - Network unavailability risk!'
    };

    console.error('🚨 CRITICAL AVAILABILITY ALERT:', alert);
    
    // Store critical alert
    this.storeAlert(alert);
    
    // Browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('SichrPlace Critical Alert', {
        body: `Function ${functionName} unavailable - Network risk!`,
        icon: '/img/logo-shield.svg',
        tag: 'critical-availability'
      });
    }
  }

  storeAlert(alert) {
    const alerts = JSON.parse(localStorage.getItem('availabilityAlerts') || '[]');
    alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (alerts.length > 50) {
      alerts.splice(50);
    }
    
    localStorage.setItem('availabilityAlerts', JSON.stringify(alerts));
  }

  getAlerts() {
    return JSON.parse(localStorage.getItem('availabilityAlerts') || '[]');
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      criticalFunctions: this.criticalFunctions.length,
      currentFailures: Array.from(this.failures.entries()),
      lastCheck: localStorage.getItem('lastAvailabilityCheck'),
      totalAlerts: this.getAlerts().length
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize monitoring
if (typeof window !== 'undefined') {
  window.availabilityMonitor = new ContinuousAvailabilityMonitor();
  
  // Auto-start monitoring when page loads
  document.addEventListener('DOMContentLoaded', () => {
    // Start monitoring only in production
    if (window.location.hostname === 'www.sichrplace.com' || window.location.hostname === 'sichrplace.com') {
      window.availabilityMonitor.startMonitoring();
    }
  });
  
  // Stop monitoring when page unloads
  window.addEventListener('beforeunload', () => {
    if (window.availabilityMonitor) {
      window.availabilityMonitor.stopMonitoring();
    }
  });
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContinuousAvailabilityMonitor;
}

console.log('🔄 Continuous Availability Monitor loaded - Network unavailability prevention active!');