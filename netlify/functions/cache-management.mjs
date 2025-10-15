const cacheStorage = new Map(); // In-memory cache for demonstration
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  flushes: 0
};

export const handler = async (event, _context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { action, key, value, ttl = 3600, pattern } = event.httpMethod === 'GET' ? 
      (event.queryStringParameters || {}) : 
      JSON.parse(event.body || '{}');

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: ['get', 'set', 'delete', 'flush', 'stats', 'health', 'list_keys']
        })
      };
    }

    switch (action) {
      case 'get':
        return await getCacheValue(key, headers);
      
      case 'set':
        return await setCacheValue(key, value, ttl, headers);
      
      case 'delete':
        return await deleteCacheValue(key, headers);
      
      case 'flush':
        return await flushCache(pattern, headers);
      
      case 'stats':
        return await getCacheStats(headers);
      
      case 'health':
        return await getCacheHealth(headers);
      
      case 'list_keys':
        return await listCacheKeys(pattern, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified',
            available_actions: ['get', 'set', 'delete', 'flush', 'stats', 'health', 'list_keys']
          })
        };
    }

  } catch (error) {
    console.error('Cache management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Cache management operation failed',
        error: error.message
      })
    };
  }
};

// Get cache value
async function getCacheValue(key, headers) {
  if (!key) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Key parameter is required for get operation'
      })
    };
  }

  try {
    const cacheEntry = cacheStorage.get(key);
    
    if (!cacheEntry) {
      cacheStats.misses++;
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cache key not found',
          key: key,
          hit: false
        })
      };
    }

    // Check if entry has expired
    if (cacheEntry.expires && Date.now() > cacheEntry.expires) {
      cacheStorage.delete(key);
      cacheStats.misses++;
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Cache key expired',
          key: key,
          hit: false,
          expired: true
        })
      };
    }

    cacheStats.hits++;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          key: key,
          value: cacheEntry.value,
          hit: true,
          created_at: cacheEntry.created_at,
          expires_at: cacheEntry.expires ? new Date(cacheEntry.expires).toISOString() : null,
          ttl_remaining: cacheEntry.expires ? Math.max(0, Math.floor((cacheEntry.expires - Date.now()) / 1000)) : null
        }
      })
    };

  } catch (error) {
    cacheStats.misses++;
    throw error;
  }
}

// Set cache value
async function setCacheValue(key, value, ttl, headers) {
  if (!key || value === undefined) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Key and value parameters are required for set operation'
      })
    };
  }

  try {
    const now = Date.now();
    const expires = ttl > 0 ? now + (ttl * 1000) : null;

    const cacheEntry = {
      value: value,
      created_at: new Date(now).toISOString(),
      expires: expires,
      access_count: 0,
      size_bytes: calculateSize(value)
    };

    cacheStorage.set(key, cacheEntry);
    cacheStats.sets++;

    // Cleanup expired entries periodically
    if (Math.random() < 0.1) { // 10% chance
      await cleanupExpiredEntries();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Cache value set successfully',
        data: {
          key: key,
          ttl: ttl,
          expires_at: expires ? new Date(expires).toISOString() : null,
          size_bytes: cacheEntry.size_bytes
        }
      })
    };

  } catch (error) {
    console.error('Set cache value error:', error);
    throw error;
  }
}

// Delete cache value
async function deleteCacheValue(key, headers) {
  if (!key) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Key parameter is required for delete operation'
      })
    };
  }

  try {
    const existed = cacheStorage.has(key);
    cacheStorage.delete(key);
    cacheStats.deletes++;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: existed ? 'Cache key deleted successfully' : 'Cache key did not exist',
        data: {
          key: key,
          existed: existed
        }
      })
    };

  } catch (error) {
    console.error('Delete cache value error:', error);
    throw error;
  }
}

// Flush cache
async function flushCache(pattern, headers) {
  try {
    let deletedCount = 0;
    
    if (pattern) {
      // Delete keys matching pattern
      const regex = new RegExp(pattern);
      const keysToDelete = [];
      
      for (const key of cacheStorage.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        cacheStorage.delete(key);
        deletedCount++;
      });
    } else {
      // Delete all keys
      deletedCount = cacheStorage.size;
      cacheStorage.clear();
    }

    cacheStats.flushes++;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: pattern ? `Flushed cache keys matching pattern: ${pattern}` : 'Flushed entire cache',
        data: {
          deleted_count: deletedCount,
          pattern: pattern || 'all'
        }
      })
    };

  } catch (error) {
    console.error('Flush cache error:', error);
    throw error;
  }
}

// Get cache statistics
async function getCacheStats(headers) {
  try {
    const totalKeys = cacheStorage.size;
    let totalSizeBytes = 0;
    let expiredKeys = 0;
    const now = Date.now();

    // Calculate statistics
    for (const entry of cacheStorage.values()) {
      totalSizeBytes += entry.size_bytes || 0;
      if (entry.expires && now > entry.expires) {
        expiredKeys++;
      }
    }

    const hitRate = cacheStats.hits + cacheStats.misses > 0 ? 
      ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2) : 0;

    const statistics = {
      cache_size: {
        total_keys: totalKeys,
        total_size_bytes: totalSizeBytes,
        total_size_mb: (totalSizeBytes / (1024 * 1024)).toFixed(2),
        expired_keys: expiredKeys
      },
      performance: {
        hit_rate_percent: parseFloat(hitRate),
        total_hits: cacheStats.hits,
        total_misses: cacheStats.misses,
        total_sets: cacheStats.sets,
        total_deletes: cacheStats.deletes,
        total_flushes: cacheStats.flushes
      },
      health: {
        status: totalKeys < 10000 ? 'healthy' : 'warning',
        memory_usage_percent: ((totalSizeBytes / (50 * 1024 * 1024)) * 100).toFixed(2), // Assuming 50MB limit
        fragmentation_ratio: expiredKeys > 0 ? ((expiredKeys / totalKeys) * 100).toFixed(2) : 0
      },
      generated_at: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: statistics
      })
    };

  } catch (error) {
    console.error('Get cache statistics error:', error);
    throw error;
  }
}

// Get cache health
async function getCacheHealth(headers) {
  try {
    const totalKeys = cacheStorage.size;
    let totalSizeBytes = 0;
    let expiredKeys = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;
    const now = Date.now();

    for (const entry of cacheStorage.values()) {
      totalSizeBytes += entry.size_bytes || 0;
      
      if (entry.expires && now > entry.expires) {
        expiredKeys++;
      }
      
      const entryTime = new Date(entry.created_at).getTime();
      if (entryTime < oldestEntry) oldestEntry = entryTime;
      if (entryTime > newestEntry) newestEntry = entryTime;
    }

    const memoryUsagePercent = (totalSizeBytes / (50 * 1024 * 1024)) * 100; // 50MB limit
    const fragmentationPercent = totalKeys > 0 ? (expiredKeys / totalKeys) * 100 : 0;
    
    let healthStatus = 'healthy';
    const issues = [];
    
    if (memoryUsagePercent > 90) {
      healthStatus = 'critical';
      issues.push('Memory usage above 90%');
    } else if (memoryUsagePercent > 75) {
      healthStatus = 'warning';
      issues.push('Memory usage above 75%');
    }
    
    if (fragmentationPercent > 25) {
      healthStatus = fragmentationPercent > 50 ? 'critical' : 'warning';
      issues.push(`High fragmentation: ${fragmentationPercent.toFixed(1)}% expired keys`);
    }
    
    if (totalKeys > 8000) {
      healthStatus = totalKeys > 10000 ? 'critical' : 'warning';
      issues.push(`High key count: ${totalKeys}`);
    }

    const recommendations = [];
    
    if (fragmentationPercent > 20) {
      recommendations.push('Consider running cache cleanup to remove expired entries');
    }
    
    if (memoryUsagePercent > 70) {
      recommendations.push('Consider increasing cache TTL or implementing LRU eviction');
    }
    
    if (totalKeys > 5000) {
      recommendations.push('Monitor cache growth and consider implementing key expiration policies');
    }

    const health = {
      status: healthStatus,
      score: Math.max(0, 100 - (memoryUsagePercent * 0.5) - (fragmentationPercent * 0.3) - (totalKeys / 100)),
      metrics: {
        memory_usage_percent: memoryUsagePercent.toFixed(2),
        fragmentation_percent: fragmentationPercent.toFixed(2),
        total_keys: totalKeys,
        expired_keys: expiredKeys,
        size_mb: (totalSizeBytes / (1024 * 1024)).toFixed(2),
        oldest_entry_age_hours: totalKeys > 0 ? ((now - oldestEntry) / (1000 * 60 * 60)).toFixed(1) : 0
      },
      issues: issues,
      recommendations: recommendations,
      checked_at: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: health
      })
    };

  } catch (error) {
    console.error('Get cache health error:', error);
    throw error;
  }
}

// List cache keys
async function listCacheKeys(pattern, headers) {
  try {
    let keys = Array.from(cacheStorage.keys());
    
    if (pattern) {
      const regex = new RegExp(pattern);
      keys = keys.filter(key => regex.test(key));
    }
    
    // Add metadata for each key
    const keyDetails = keys.slice(0, 100).map(key => { // Limit to 100 keys
      const entry = cacheStorage.get(key);
      const now = Date.now();
      
      return {
        key: key,
        size_bytes: entry.size_bytes || 0,
        created_at: entry.created_at,
        expires_at: entry.expires ? new Date(entry.expires).toISOString() : null,
        is_expired: entry.expires ? now > entry.expires : false,
        ttl_remaining: entry.expires ? Math.max(0, Math.floor((entry.expires - now) / 1000)) : null
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          keys: keyDetails,
          total_matching: keys.length,
          pattern: pattern || 'all',
          truncated: keys.length > 100
        }
      })
    };

  } catch (error) {
    console.error('Cache maintenance error:', error);
    throw error;
  }
}

// Helper function to cleanup expired entries
async function cleanupExpiredEntries() {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, entry] of cacheStorage.entries()) {
    if (entry.expires && now > entry.expires) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => {
    cacheStorage.delete(key);
  });
  
  return expiredKeys.length;
}

// Helper function to calculate object size
function calculateSize(obj) {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch (error) {
    // Fallback estimation
    return JSON.stringify(obj).length * 2; // Rough estimate
  }
}