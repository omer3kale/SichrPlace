const crypto = require('crypto');
const path = require('path');

/**
 * Lightweight Cloudinary helper used to verify configuration and generate upload signatures
 * without requiring the official SDK. Keeping the implementation minimal avoids adding
 * network calls during health checks while still mirroring the parameters expected by
 * Cloudinary's signed upload flow.
 */
class CloudinaryService {
  constructor(env = process.env) {
    this.env = env;
    this.cloudName = env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = env.CLOUDINARY_API_KEY;
    this.apiSecret = env.CLOUDINARY_API_SECRET;
  }

  /**
   * Cloudinary credentials are considered configured when all three core pieces are present.
   */
  isConfigured() {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  getUploadEndpoint(resourceType = 'image') {
    if (!this.isConfigured()) {
      return null;
    }
    return `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`;
  }

  /**
   * Generate a signed payload for secure uploads. Mirrors Cloudinary's signature logic.
   */
  generateSignature(params = {}) {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured');
    }

    const filtered = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([aKey], [bKey]) => (aKey > bKey ? 1 : -1))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const toSign = `${filtered}${filtered ? '&' : ''}api_secret=${this.apiSecret}`;
    return crypto.createHash('sha1').update(toSign).digest('hex');
  }

  /**
   * Provide a quick status summary consumed by the integration health endpoint.
   */
  verifyConfiguration() {
    const configured = this.isConfigured();
    return {
      ready: configured,
      details: {
        cloudName: this.cloudName || null,
        apiKeyPresent: Boolean(this.apiKey),
        uploadEndpoint: this.getUploadEndpoint(),
        envFileHint: path.join('js', 'backend', '.env')
      }
    };
  }
}

module.exports = new CloudinaryService();
module.exports.CloudinaryService = CloudinaryService;
