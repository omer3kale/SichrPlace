/**
 * Enterprise Rate Limiting System for SichrPlace
 * Implements multiple rate limiting strategies for bulletproof protection
 */

export class RateLimiter {
  constructor() {
    // In-memory storage for rate limiting (in production, use Redis)
    this.requests = new Map();
    this.blockedIPs = new Map();
    this.bruteForceAttempts = new Map();
    
    // Rate limiting configurations
    this.configs = {
      // General API rate limiting
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        blockDuration: 15 * 60 * 1000 // 15 minutes
      },
      
      // Authentication endpoints (stricter)
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // Only 5 login attempts per 15 minutes
        blockDuration: 30 * 60 * 1000, // 30 minutes block
        maxConsecutiveFailures: 3 // Block after 3 consecutive failures
      },
      
      // Password reset (very strict)
      passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3, // Only 3 password resets per hour
        blockDuration: 60 * 60 * 1000 // 1 hour block
      },
      
      // File uploads
      upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 20, // 20 uploads per hour
        blockDuration: 30 * 60 * 1000 // 30 minutes block
      },
      
      // Search API
      search: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30, // 30 searches per minute
        blockDuration: 5 * 60 * 1000 // 5 minutes block
      },
      
      // Contact/messaging
      messaging: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 50, // 50 messages per hour
        blockDuration: 60 * 60 * 1000 // 1 hour block
      }
    };
  }

  /**
   * Gets client identifier (IP + User-Agent fingerprint)
   */
  getClientId(event) {
    const ip = this.getClientIP(event);
    const userAgent = event.headers['user-agent'] || 'unknown';
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    // Create a more unique identifier
    const baseId = `${ip}:${userAgent.substring(0, 50)}`;
    
    // If authenticated, include user context
    if (authHeader) {
      try {
        // Extract user ID from token without full verification (for rate limiting only)
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload.userId) {
          return `user:${payload.userId}:${ip}`;
        }
      } catch (error) {
        // If token parsing fails, use IP-based limiting
      }
    }
    
    return baseId;
  }

  /**
   * Extracts client IP from various headers
   */
  getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           event.headers['x-real-ip'] ||
           event.headers['cf-connecting-ip'] ||
           event.headers['x-client-ip'] ||
           'unknown';
  }

  /**
   * Checks if a request should be rate limited
   */
  shouldLimit(clientId, endpoint) {
    const now = Date.now();
    const config = this.getConfigForEndpoint(endpoint);
    
    // Check if IP is currently blocked
    if (this.isBlocked(clientId, now)) {
      return {
        limited: true,
        reason: 'IP_BLOCKED',
        retryAfter: this.getBlockTimeRemaining(clientId, now),
        remainingAttempts: 0
      };
    }

    // Get or create request tracking for this client
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, new Map());
    }
    
    const clientRequests = this.requests.get(clientId);
    
    // Clean old requests outside the window
    this.cleanOldRequests(clientRequests, now, config.windowMs);
    
    // Get requests for this endpoint
    const endpointKey = `${endpoint}:${Math.floor(now / config.windowMs)}`;
    const requestCount = clientRequests.get(endpointKey) || 0;
    
    // Check if limit exceeded
    if (requestCount >= config.maxRequests) {
      // Add to blocked IPs if this is an auth endpoint
      if (endpoint === 'auth' || endpoint === 'passwordReset') {
        this.blockClient(clientId, now, config.blockDuration);
      }
      
      return {
        limited: true,
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter: config.windowMs - (now % config.windowMs),
        remainingAttempts: 0
      };
    }

    // Update request count
    clientRequests.set(endpointKey, requestCount + 1);
    
    return {
      limited: false,
      remainingAttempts: config.maxRequests - requestCount - 1,
      windowMs: config.windowMs
    };
  }

  /**
   * Records a failed authentication attempt for brute force protection
   */
  recordFailedAuth(clientId, email = null) {
    const now = Date.now();
    const key = email ? `email:${email}` : clientId;
    
    if (!this.bruteForceAttempts.has(key)) {
      this.bruteForceAttempts.set(key, []);
    }
    
    const attempts = this.bruteForceAttempts.get(key);
    attempts.push(now);
    
    // Keep only recent attempts (last hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentAttempts = attempts.filter(time => time > oneHourAgo);
    this.bruteForceAttempts.set(key, recentAttempts);
    
    // Check if we should block this client/email
    const config = this.configs.auth;
    if (recentAttempts.length >= config.maxConsecutiveFailures) {
      this.blockClient(clientId, now, config.blockDuration);
      
      // Also block by email if provided
      if (email) {
        this.blockClient(`email:${email}`, now, config.blockDuration);
      }
      
      return true; // Blocked
    }
    
    return false; // Not blocked yet
  }

  /**
   * Clears failed auth attempts on successful login
   */
  clearFailedAuth(clientId, email = null) {
    this.bruteForceAttempts.delete(clientId);
    if (email) {
      this.bruteForceAttempts.delete(`email:${email}`);
    }
  }

  /**
   * Blocks a client for a specified duration
   */
  blockClient(clientId, now, duration) {
    this.blockedIPs.set(clientId, now + duration);
  }

  /**
   * Checks if a client is currently blocked
   */
  isBlocked(clientId, now) {
    const blockUntil = this.blockedIPs.get(clientId);
    if (!blockUntil) return false;
    
    if (now >= blockUntil) {
      this.blockedIPs.delete(clientId);
      return false;
    }
    
    return true;
  }

  /**
   * Gets remaining block time in milliseconds
   */
  getBlockTimeRemaining(clientId, now) {
    const blockUntil = this.blockedIPs.get(clientId);
    return blockUntil ? Math.max(0, blockUntil - now) : 0;
  }

  /**
   * Gets rate limit configuration for an endpoint
   */
  getConfigForEndpoint(endpoint) {
    return this.configs[endpoint] || this.configs.api;
  }

  /**
   * Cleans old request records to prevent memory leaks
   */
  cleanOldRequests(clientRequests, now, windowMs) {
    const cutoff = now - windowMs;
    const currentWindow = Math.floor(now / windowMs);
    
    for (const [key, value] of clientRequests.entries()) {
      const [endpoint, window] = key.split(':');
      const windowTime = parseInt(window);
      
      if (windowTime < currentWindow - 1) {
        clientRequests.delete(key);
      }
    }
  }

  /**
   * Middleware function for Netlify functions
   */
  middleware(endpoint = 'api') {
    return (event) => {
      const clientId = this.getClientId(event);
      const result = this.shouldLimit(clientId, endpoint);
      
      if (result.limited) {
        const retryAfterSeconds = Math.ceil(result.retryAfter / 1000);
        
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfterSeconds.toString(),
            'X-RateLimit-Limit': this.getConfigForEndpoint(endpoint).maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + result.retryAfter).toString(),
            'X-RateLimit-Reason': result.reason
          },
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
            retryAfter: retryAfterSeconds,
            reason: result.reason
          })
        };
      }

      // Add rate limit headers to successful responses
      return {
        headers: {
          'X-RateLimit-Limit': this.getConfigForEndpoint(endpoint).maxRequests.toString(),
          'X-RateLimit-Remaining': result.remainingAttempts.toString(),
          'X-RateLimit-Reset': (Date.now() + result.windowMs).toString()
        }
      };
    };
  }

  /**
   * Suspicious activity detection
   */
  detectSuspiciousActivity(clientId, endpoint) {
    const now = Date.now();
    const clientRequests = this.requests.get(clientId);
    
    if (!clientRequests) return false;
    
    // Check for rapid fire requests (more than 10 per second)
    const lastSecond = now - 1000;
    let recentRequests = 0;
    
    for (const [key, count] of clientRequests.entries()) {
      const [, window] = key.split(':');
      const windowStart = parseInt(window) * this.configs.api.windowMs;
      
      if (windowStart > lastSecond) {
        recentRequests += count;
      }
    }
    
    return recentRequests > 10;
  }

  /**
   * Get comprehensive rate limiting status
   */
  getStatus() {
    const now = Date.now();
    
    return {
      activeClients: this.requests.size,
      blockedClients: Array.from(this.blockedIPs.entries())
        .filter(([, blockUntil]) => blockUntil > now)
        .length,
      totalBlocked: this.blockedIPs.size,
      bruteForceTracking: this.bruteForceAttempts.size,
      configs: this.configs
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Helper functions for easy integration
export const checkRateLimit = (event, endpoint = 'api') => {
  return rateLimiter.middleware(endpoint)(event);
};

export const recordAuthFailure = (event, email = null) => {
  const clientId = rateLimiter.getClientId(event);
  return rateLimiter.recordFailedAuth(clientId, email);
};

export const clearAuthFailures = (event, email = null) => {
  const clientId = rateLimiter.getClientId(event);
  rateLimiter.clearFailedAuth(clientId, email);
};

export default rateLimiter;