/**
 * Security Middleware for SichrPlace Netlify Functions
 * Applies comprehensive security controls to all API endpoints
 */

import { logger } from './secureLogger.js';
import { checkRateLimit } from './rateLimiter.js';
import { validator } from './inputValidator.js';
import { SecretManager } from './secretManager.js';

export class SecurityMiddleware {
  constructor(options = {}) {
    this.options = {
      enableRateLimit: true,
      enableInputValidation: true,
      enableSecurityHeaders: true,
      enableSecurityLogging: true,
      enableCSRFProtection: false,
      rateLimitEndpoint: 'api',
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      requireAuth: false,
      ...options
    };
  }

  /**
   * Main middleware function
   */
  apply() {
    return async (event, context, handler) => {
      const correlationId = logger.generateCorrelationId();
      const startTime = Date.now();
      
      try {
        // 1. Security Headers Setup
        const securityHeaders = this.options.enableSecurityHeaders 
          ? SecretManager.createSecurityHeaders() 
          : {};

        // 2. CORS Preflight handling
        if (event.httpMethod === 'OPTIONS') {
          return {
            statusCode: 200,
            headers: {
              ...securityHeaders,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': this.options.allowedMethods.join(', '),
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
              'Access-Control-Max-Age': '86400'
            },
            body: ''
          };
        }

        // 3. Method validation
        if (!this.options.allowedMethods.includes(event.httpMethod)) {
          logger.security('Disallowed HTTP method', {
            method: event.httpMethod,
            path: event.path,
            ip: this.getClientIP(event)
          }, correlationId);

          return this.createErrorResponse(405, 'Method not allowed', securityHeaders);
        }

        // 4. Rate limiting
        let rateLimitHeaders = {};
        if (this.options.enableRateLimit) {
          const rateLimitResult = checkRateLimit(event, this.options.rateLimitEndpoint);
          if (rateLimitResult.statusCode === 429) {
            logger.security('Rate limit exceeded', {
              endpoint: this.options.rateLimitEndpoint,
              ip: this.getClientIP(event),
              userAgent: event.headers['user-agent']
            }, correlationId);
            
            return {
              ...rateLimitResult,
              headers: { ...securityHeaders, ...rateLimitResult.headers }
            };
          }
          rateLimitHeaders = rateLimitResult.headers || {};
        }

        // 5. Input validation and sanitization
        if (this.options.enableInputValidation && event.body) {
          const validationResult = this.validateRequestBody(event.body);
          if (!validationResult.valid) {
            logger.security('Invalid input detected', {
              errors: validationResult.errors,
              ip: this.getClientIP(event),
              path: event.path
            }, correlationId);

            return this.createErrorResponse(400, 'Invalid input', securityHeaders, {
              errors: validationResult.errors
            });
          }
          
          // Replace event.body with sanitized version
          event.body = JSON.stringify(validationResult.sanitized);
        }

        // 6. Authentication check
        if (this.options.requireAuth) {
          const authResult = this.validateAuthentication(event);
          if (!authResult.valid) {
            logger.security('Authentication failed', {
              reason: authResult.reason,
              ip: this.getClientIP(event),
              path: event.path
            }, correlationId);

            return this.createErrorResponse(401, 'Authentication required', securityHeaders);
          }
          
          // Add user context to event
          event.user = authResult.user;
        }

        // 7. CSRF Protection
        if (this.options.enableCSRFProtection && ['POST', 'PUT', 'DELETE'].includes(event.httpMethod)) {
          if (!this.validateCSRFToken(event)) {
            logger.security('CSRF token validation failed', {
              ip: this.getClientIP(event),
              path: event.path
            }, correlationId);

            return this.createErrorResponse(403, 'CSRF token validation failed', securityHeaders);
          }
        }

        // 8. Security logging
        if (this.options.enableSecurityLogging) {
          logger.info('API request processed', {
            method: event.httpMethod,
            path: event.path,
            ip: this.getClientIP(event),
            userAgent: event.headers['user-agent'],
            authenticated: !!event.user
          }, correlationId);
        }

        // 9. Execute the original handler
        const result = await handler(event, context);

        // 10. Add security headers to response
        if (result && result.headers) {
          result.headers = {
            ...securityHeaders,
            ...rateLimitHeaders,
            ...result.headers
          };
        } else if (result) {
          result.headers = {
            ...securityHeaders,
            ...rateLimitHeaders,
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          };
        }

        // 11. Response time logging
        const processingTime = Date.now() - startTime;
        if (processingTime > 5000) { // Log slow requests
          logger.warn('Slow API response', {
            path: event.path,
            processingTime,
            method: event.httpMethod
          }, correlationId);
        }

        return result;

      } catch (error) {
        // 12. Error handling with secure logging
        const errorId = logger.error('Security middleware error', {
          error: error.message,
          stack: error.stack,
          path: event.path,
          method: event.httpMethod,
          ip: this.getClientIP(event)
        }, correlationId);

        return this.createErrorResponse(500, 'Internal server error', {}, {
          errorId,
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    };
  }

  /**
   * Validates request body for common security issues
   */
  validateRequestBody(body) {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      
      // Basic validation - check for dangerous patterns
      const stringified = JSON.stringify(data);
      
      if (validator.containsXSS(stringified)) {
        return { valid: false, errors: ['Request contains potentially malicious content'] };
      }
      
      if (validator.containsSQLInjection(stringified)) {
        return { valid: false, errors: ['Request contains potentially malicious SQL content'] };
      }
      
      if (validator.containsCommandInjection(stringified)) {
        return { valid: false, errors: ['Request contains potentially malicious commands'] };
      }

      // Sanitize the data
      const sanitized = this.sanitizeObject(data);
      
      return { valid: true, sanitized };
      
    } catch (error) {
      return { valid: false, errors: ['Invalid JSON format'] };
    }
  }

  /**
   * Recursively sanitizes object data
   */
  sanitizeObject(obj) {
    if (typeof obj === 'string') {
      return validator.htmlEncode(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Validates authentication token
   */
  validateAuthentication(event) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, reason: 'Missing or invalid authorization header' };
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      // This would use your JWT verification logic
      // For now, just basic validation
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      if (!payload.userId || !payload.email) {
        return { valid: false, reason: 'Invalid token payload' };
      }
      
      // Check token expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return { valid: false, reason: 'Token expired' };
      }
      
      return { valid: true, user: payload };
      
    } catch (error) {
      return { valid: false, reason: 'Token validation failed' };
    }
  }

  /**
   * Validates CSRF token
   */
  validateCSRFToken(event) {
    const csrfToken = event.headers['x-csrf-token'] || 
                     (event.body && JSON.parse(event.body).csrfToken);
    
    if (!csrfToken) {
      return false;
    }
    
    // This would validate against a stored CSRF token
    // For now, just check it exists and has proper format
    return /^[a-f0-9]{64}$/.test(csrfToken);
  }

  /**
   * Gets client IP address
   */
  getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           event.headers['x-real-ip'] ||
           event.headers['cf-connecting-ip'] ||
           'unknown';
  }

  /**
   * Creates standardized error response
   */
  createErrorResponse(statusCode, message, headers = {}, additionalData = {}) {
    return {
      statusCode,
      headers: {
        ...headers,
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        message,
        timestamp: new Date().toISOString(),
        ...additionalData
      })
    };
  }
}

// Pre-configured middleware instances
export const basicSecurity = new SecurityMiddleware({
  enableRateLimit: true,
  enableInputValidation: true,
  enableSecurityHeaders: true,
  enableSecurityLogging: true
}).apply();

export const authSecurity = new SecurityMiddleware({
  enableRateLimit: true,
  enableInputValidation: true,
  enableSecurityHeaders: true,
  enableSecurityLogging: true,
  rateLimitEndpoint: 'auth',
  allowedMethods: ['POST', 'OPTIONS']
}).apply();

export const apiSecurity = new SecurityMiddleware({
  enableRateLimit: true,
  enableInputValidation: true,
  enableSecurityHeaders: true,
  enableSecurityLogging: true,
  requireAuth: true,
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}).apply();

export const uploadSecurity = new SecurityMiddleware({
  enableRateLimit: true,
  enableInputValidation: false, // Files handled differently
  enableSecurityHeaders: true,
  enableSecurityLogging: true,
  rateLimitEndpoint: 'upload',
  requireAuth: true,
  allowedMethods: ['POST', 'OPTIONS']
}).apply();

export default SecurityMiddleware;