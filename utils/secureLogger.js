/**
 * Secure Logging System for SichrPlace
 * Prevents information disclosure and implements enterprise security logging
 */

import crypto from 'crypto';

export class SecureLogger {
  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? 'ERROR' : 'DEBUG';
    this.sensitivePatterns = [
      /password/gi,
      /token/gi,
      /secret/gi,
      /key/gi,
      /auth/gi,
      /bearer/gi,
      /api[_-]?key/gi,
      /client[_-]?secret/gi,
      /access[_-]?token/gi,
      /refresh[_-]?token/gi,
      /reset[_-]?token/gi,
      /email/gi,
      /user[_-]?id/gi,
      /credit[_-]?card/gi,
      /ssn/gi,
      /social[_-]?security/gi,
      /schufa/gi,
      /salary/gi,
      /income/gi,
      /bank/gi,
      /iban/gi,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN patterns
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi // UUIDs
    ];
  }

  /**
   * Sanitizes sensitive data from log messages
   */
  sanitizeLogData(data) {
    if (typeof data === 'string') {
      let sanitized = data;
      this.sensitivePatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
      return sanitized;
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized = JSON.parse(JSON.stringify(data));
      this.sanitizeObjectRecursive(sanitized);
      return sanitized;
    }

    return data;
  }

  /**
   * Recursively sanitizes object properties
   */
  sanitizeObjectRecursive(obj) {
    if (typeof obj !== 'object' || obj === null) return;

    Object.keys(obj).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains sensitive information
      if (this.isSensitiveKey(lowerKey)) {
        obj[key] = '[REDACTED]';
        return;
      }

      // Recursively sanitize nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObjectRecursive(obj[key]);
      } else if (typeof obj[key] === 'string') {
        obj[key] = this.sanitizeLogData(obj[key]);
      }
    });
  }

  /**
   * Checks if a key name indicates sensitive data
   */
  isSensitiveKey(key) {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth', 'bearer',
      'apikey', 'api_key', 'clientsecret', 'client_secret',
      'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
      'resettoken', 'reset_token', 'email', 'userid', 'user_id',
      'creditcard', 'credit_card', 'ssn', 'socialsecurity', 'social_security',
      'schufa', 'salary', 'income', 'bank', 'iban', 'routing',
      'account', 'pin', 'cvv', 'cvc', 'security_code'
    ];
    
    return sensitiveKeys.some(sensitiveKey => key.includes(sensitiveKey));
  }

  /**
   * Generates a secure correlation ID for request tracking
   */
  generateCorrelationId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Creates a secure log entry with metadata
   */
  createLogEntry(level, message, data = {}, correlationId = null) {
    const timestamp = new Date().toISOString();
    const sanitizedData = this.sanitizeLogData(data);
    const sanitizedMessage = this.sanitizeLogData(message);
    
    return {
      timestamp,
      level,
      message: sanitizedMessage,
      data: sanitizedData,
      correlationId: correlationId || this.generateCorrelationId(),
      environment: process.env.NODE_ENV || 'development',
      function: this.getFunctionName(),
      sanitized: true
    };
  }

  /**
   * Gets the calling function name for better debugging
   */
  getFunctionName() {
    try {
      const stack = new Error().stack;
      const callerLine = stack.split('\n')[4]; // Adjust index as needed
      const match = callerLine.match(/at (\w+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Production-safe error logging
   */
  error(message, data = {}, correlationId = null) {
    const logEntry = this.createLogEntry('ERROR', message, data, correlationId);
    
    if (process.env.NODE_ENV === 'production') {
      // In production, only log essential error information
      console.error(JSON.stringify({
        timestamp: logEntry.timestamp,
        level: logEntry.level,
        message: logEntry.message,
        correlationId: logEntry.correlationId,
        function: logEntry.function
      }));
    } else {
      console.error(JSON.stringify(logEntry, null, 2));
    }
    
    return logEntry.correlationId;
  }

  /**
   * Production-safe warning logging
   */
  warn(message, data = {}, correlationId = null) {
    const logEntry = this.createLogEntry('WARN', message, data, correlationId);
    
    if (this.shouldLog('WARN')) {
      console.warn(JSON.stringify(logEntry));
    }
    
    return logEntry.correlationId;
  }

  /**
   * Production-safe info logging
   */
  info(message, data = {}, correlationId = null) {
    const logEntry = this.createLogEntry('INFO', message, data, correlationId);
    
    if (this.shouldLog('INFO')) {
      console.log(JSON.stringify(logEntry));
    }
    
    return logEntry.correlationId;
  }

  /**
   * Debug logging (development only)
   */
  debug(message, data = {}, correlationId = null) {
    if (process.env.NODE_ENV !== 'production') {
      const logEntry = this.createLogEntry('DEBUG', message, data, correlationId);
      console.log(JSON.stringify(logEntry, null, 2));
      return logEntry.correlationId;
    }
    return null;
  }

  /**
   * Security event logging with enhanced tracking
   */
  security(event, details = {}, correlationId = null) {
    const securityEntry = this.createLogEntry('SECURITY', `Security Event: ${event}`, {
      event,
      details: this.sanitizeLogData(details),
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    }, correlationId);
    
    // Always log security events, even in production
    console.error(JSON.stringify(securityEntry));
    
    // In production, also send to security monitoring system
    if (process.env.NODE_ENV === 'production') {
      this.sendToSecurityMonitoring(securityEntry);
    }
    
    return securityEntry.correlationId;
  }

  /**
   * Determines if a log level should be output
   */
  shouldLog(level) {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SECURITY: 4 };
    const currentLevel = levels[this.logLevel] || levels['ERROR'];
    const messageLevel = levels[level] || levels['ERROR'];
    
    return messageLevel >= currentLevel;
  }

  /**
   * Sends critical security events to monitoring system
   */
  sendToSecurityMonitoring(logEntry) {
    // In a real implementation, this would send to your security monitoring system
    // For now, we'll just ensure it's properly formatted for external systems
    try {
      // Example: Send to external SIEM/monitoring system
      const securityAlert = {
        source: 'sichrplace-api',
        severity: 'HIGH',
        event: logEntry.data.event,
        timestamp: logEntry.timestamp,
        correlationId: logEntry.correlationId,
        environment: logEntry.environment
      };
      
      // This would be your actual monitoring endpoint
      // await fetch('https://your-security-monitoring.com/api/alerts', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(securityAlert)
      // });
      
    } catch (error) {
      // Fallback: ensure security events are still logged locally
      console.error('Failed to send security alert to monitoring system:', error.message);
    }
  }

  /**
   * Audit logging for compliance and tracking
   */
  audit(action, user, resource, details = {}, correlationId = null) {
    const auditEntry = this.createLogEntry('AUDIT', `Audit: ${action}`, {
      action,
      user: this.sanitizeLogData(user),
      resource,
      details: this.sanitizeLogData(details),
      timestamp: new Date().toISOString()
    }, correlationId);
    
    // Always log audit events for compliance
    console.log(JSON.stringify(auditEntry));
    
    return auditEntry.correlationId;
  }
}

// Export singleton instance
export const logger = new SecureLogger();

// Export convenience methods for backward compatibility
export const secureLog = {
  error: (message, data, correlationId) => logger.error(message, data, correlationId),
  warn: (message, data, correlationId) => logger.warn(message, data, correlationId),
  info: (message, data, correlationId) => logger.info(message, data, correlationId),
  debug: (message, data, correlationId) => logger.debug(message, data, correlationId),
  security: (event, details, correlationId) => logger.security(event, details, correlationId),
  audit: (action, user, resource, details, correlationId) => logger.audit(action, user, resource, details, correlationId)
};

export default logger;