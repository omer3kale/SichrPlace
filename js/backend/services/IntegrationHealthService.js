const path = require('path');
const fs = require('fs');
const CloudinaryService = require('./CloudinaryService');
const GoogleMapsService = require('./GoogleMapsService');

class IntegrationHealthService {
  constructor({ env = process.env, fileSystem = fs } = {}) {
    this.env = env;
    this.fs = fileSystem;
  }

  async checkPayPal() {
    const missing = [];
    if (!this.env.PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
    if (!this.env.PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');

    let sdkReady = false;
    let clientDetails = null;
    let error = null;

    if (missing.length === 0) {
      try {
        const paypal = require('@paypal/checkout-server-sdk');
        const Environment = this.env.PAYPAL_ENVIRONMENT === 'production'
          ? paypal.core.ProductionEnvironment
          : paypal.core.SandboxEnvironment;
        const environment = new Environment(this.env.PAYPAL_CLIENT_ID, this.env.PAYPAL_CLIENT_SECRET);
        const client = new paypal.core.PayPalHttpClient(environment);
        sdkReady = Boolean(client);
        clientDetails = {
          environment: this.env.PAYPAL_ENVIRONMENT || 'sandbox'
        };
      } catch (err) {
        error = err.message;
      }
    }

    const ready = missing.length === 0 && sdkReady && !error;
    return {
      ready,
      details: {
        environment: this.env.PAYPAL_ENVIRONMENT || 'sandbox',
        missingEnv: missing,
        sdkReady,
        error
      }
    };
  }

  async checkGmail() {
    try {
      const EmailService = require('./emailService');
      const emailService = new EmailService();
      const result = await emailService.testEmailConfiguration();
      return {
        ready: Boolean(result?.success),
        details: {
          strategy: result?.strategy || 'unknown',
          error: result?.error || null
        }
      };
    } catch (err) {
      return {
        ready: false,
        details: {
          error: err.message || 'Email verification failed'
        }
      };
    }
  }

  async checkCloudinary() {
    const { ready, details } = CloudinaryService.verifyConfiguration();
    return { ready, details };
  }

  async checkGoogleMaps() {
    const mapsService = new GoogleMapsService();
    const apiKeyPresent = Boolean(mapsService.apiKey);
  const mapsConfigPath = path.resolve(__dirname, '../../..', 'frontend', 'js', 'location-services.js');
    let frontendAligned = false;
    let error = null;

    try {
      if (this.fs.existsSync(mapsConfigPath)) {
        const fileContent = this.fs.readFileSync(mapsConfigPath, 'utf8');
        frontendAligned = fileContent.includes('/api/maps/config');
      }
    } catch (err) {
      error = err.message;
    }

    return {
      ready: apiKeyPresent && frontendAligned && !error,
      details: {
        apiKeyPresent,
        frontendAligned,
        error,
        defaultCenter: {
          lat: parseFloat(this.env.GOOGLE_MAPS_DEFAULT_LAT || 52.52),
          lng: parseFloat(this.env.GOOGLE_MAPS_DEFAULT_LNG || 13.405)
        }
      }
    };
  }

  async checkWebPush() {
    const vapidPublic = this.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = this.env.VAPID_PRIVATE_KEY;
  const pwaInitPath = path.resolve(__dirname, '../../..', 'frontend', 'js', 'pwa-init.js');
    let frontendAligned = false;
    let error = null;

    try {
      if (this.fs.existsSync(pwaInitPath)) {
        const fileContent = this.fs.readFileSync(pwaInitPath, 'utf8');
        frontendAligned = fileContent.includes("/api/push/vapid-public-key");
      }
    } catch (err) {
      error = err.message;
    }

    return {
      ready: Boolean(vapidPublic && vapidPrivate && frontendAligned && !error),
      details: {
        vapidPublicPresent: Boolean(vapidPublic),
        vapidPrivatePresent: Boolean(vapidPrivate),
        frontendAligned,
        error
      }
    };
  }

  async getStatus() {
    const [paypal, gmail, cloudinary, googleMaps, webPush] = await Promise.all([
      this.checkPayPal(),
      this.checkGmail(),
      this.checkCloudinary(),
      this.checkGoogleMaps(),
      this.checkWebPush()
    ]);

    const integrations = { paypal, gmail, cloudinary, googleMaps, webPush };
    const allReady = Object.values(integrations).every(entry => entry.ready);

    return {
      allReady,
      integrations
    };
  }
}

module.exports = new IntegrationHealthService();
module.exports.IntegrationHealthService = IntegrationHealthService;
