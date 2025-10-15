const path = require('path');

const mockVerifyConfiguration = jest.fn();
const mockTestEmailConfiguration = jest.fn();

jest.mock('../services/CloudinaryService', () => ({
  verifyConfiguration: mockVerifyConfiguration,
  CloudinaryService: jest.fn()
}));

const mockGoogleMapsConstructor = jest.fn(() => ({
  apiKey: 'maps-key'
}));

jest.mock('../services/GoogleMapsService', () => mockGoogleMapsConstructor);

jest.mock('../services/emailService', () => (
  jest.fn().mockImplementation(() => ({
    testEmailConfiguration: mockTestEmailConfiguration
  }))
));

jest.mock('@paypal/checkout-server-sdk', () => ({
  core: {
    SandboxEnvironment: function SandboxEnvironment(clientId, clientSecret) {
      this.clientId = clientId;
      this.clientSecret = clientSecret;
    },
    ProductionEnvironment: function ProductionEnvironment(clientId, clientSecret) {
      this.clientId = clientId;
      this.clientSecret = clientSecret;
    },
    PayPalHttpClient: function PayPalHttpClient() {
      return { ok: true };
    }
  }
}));

describe('IntegrationHealthService', () => {
  const { IntegrationHealthService } = require('../services/IntegrationHealthService');
  let service;
  let fakeFs;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleMapsConstructor.mockImplementation(() => ({
      apiKey: 'maps-key'
    }));
    fakeFs = {
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn((filename) => {
        if (filename.endsWith(path.join('frontend', 'js', 'location-services.js'))) {
          return 'fetch("/api/maps/config")';
        }
        if (filename.endsWith(path.join('frontend', 'js', 'pwa-init.js'))) {
          return 'fetch("/api/push/vapid-public-key")';
        }
        return '';
      })
    };
  });

  it('reports all integrations ready when dependencies resolve', async () => {
    const env = {
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_CLIENT_SECRET: 'secret',
      PAYPAL_ENVIRONMENT: 'sandbox',
      GMAIL_USER: 'test@sichrplace.com',
      GMAIL_APP_PASSWORD: 'app-password',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      GOOGLE_MAPS_DEFAULT_LAT: '52.52',
      GOOGLE_MAPS_DEFAULT_LNG: '13.405',
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private'
    };

    mockVerifyConfiguration.mockReturnValue({
      ready: true,
      details: { cloudName: 'demo' }
    });

    mockTestEmailConfiguration.mockResolvedValue({ success: true, strategy: 'app-password' });

    service = new IntegrationHealthService({ env, fileSystem: fakeFs });

    const status = await service.getStatus();

    expect(status.allReady).toBe(true);
    expect(status.integrations.paypal.ready).toBe(true);
    expect(status.integrations.gmail.ready).toBe(true);
    expect(status.integrations.cloudinary.ready).toBe(true);
    expect(status.integrations.googleMaps.ready).toBe(true);
    expect(status.integrations.webPush.ready).toBe(true);

    expect(mockGoogleMapsConstructor).toHaveBeenCalledTimes(1);
    expect(fakeFs.existsSync).toHaveBeenCalledTimes(2);
  });

  it('identifies missing configuration pieces', async () => {
    const env = {
      PAYPAL_CLIENT_ID: '',
      PAYPAL_CLIENT_SECRET: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: ''
    };

    mockGoogleMapsConstructor.mockImplementationOnce(() => ({ apiKey: null }));

    mockVerifyConfiguration.mockReturnValue({
      ready: false,
      details: { cloudName: null }
    });

    mockTestEmailConfiguration.mockResolvedValue({ success: false, error: 'missing credentials' });

    service = new IntegrationHealthService({ env, fileSystem: fakeFs });

    const status = await service.getStatus();

    expect(status.allReady).toBe(false);
    expect(status.integrations.paypal.ready).toBe(false);
    expect(status.integrations.paypal.details.missingEnv).toEqual(['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET']);
    expect(status.integrations.gmail.ready).toBe(false);
    expect(status.integrations.cloudinary.ready).toBe(false);
    expect(status.integrations.googleMaps.ready).toBe(false);
    expect(status.integrations.webPush.ready).toBe(false);
  });
});
