const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const lusca = require('lusca'); // switched from csurf to lusca for CSRF protection
const cookieParser = require('cookie-parser');
const session = require('express-session'); // required for lusca CSRF
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables preferring process environment, then local overrides
const envCandidates = [
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env')
];

envCandidates.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
});

// Import Supabase configuration
const { testConnection } = require('./config/supabase');

// Import your admin routes and models
const sendMessageRoute = require('./api/send-message');
const viewingRequestRoute = require('./api/viewing-request');
const viewingConfirmedRoute = require('./api/viewing-confirmed');
const viewingReadyRoute = require('./api/viewing-ready');
const viewingDidntWorkOutRoute = require('./api/viewing-didnt-work-out');
const uploadApartmentRoute = require('./api/upload-apartment');
const conversationsRoute = require('./api/conversations');
const apartmentsRoute = require('./routes/apartments');
const adminRoutes = require('./routes/admin');
const auth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const gdprRoutes = require('./routes/gdpr');
const gdprTrackingRoutes = require('./routes/gdpr-tracking');
const advancedGdprRoutes = require('./routes/advancedGdpr');
const errorHandler = require('./middleware/errorHandler');
const messagesRoutes = require('./routes/messages');
const emailRoutes = require('./routes/emails');
const googleFormsRoutes = require('./routes/googleForms');
const configRoutes = require('./routes/config');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../../backend/swagger.json');
const bookingRequestsLegacyRoutes = require('./routes/booking-requests');
const integrationHealthRoutes = require('./routes/integration-health');

// Import viewing requests routes (Step 3)
const viewingRequestsRoutes = require('./routes/viewing-requests');

// Import Google Maps routes (Step 9.2)
const mapsRoutes = require('./routes/maps');

// Import Performance routes (Step 9.1)
const performanceRoutes = require('./routes/performance');

// Import Redis Cache Service (Step 9.1)
const { cacheService } = require('./services/RedisCacheService');

const app = express();
const PORT = process.env.PORT || 3000; // Changed to match the running port

// ===== CRITICAL: ENVIRONMENT VALIDATION =====
console.log('🔍 ===== ENVIRONMENT CONFIGURATION CHECK =====');
const requiredEnvVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'JWT_SECRET': process.env.JWT_SECRET
};

const optionalEnvVars = {
  'FRONTEND_URL': process.env.FRONTEND_URL,
  'NODE_ENV': process.env.NODE_ENV,
  'GMAIL_USER': process.env.GMAIL_USER,
  'PAYPAL_CLIENT_ID': process.env.PAYPAL_CLIENT_ID
};

let hasErrors = false;

// Check required variables
for (const [varName, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ CRITICAL: Missing required environment variable: ${varName}`);
    hasErrors = true;
  } else if (varName === 'JWT_SECRET' && (value === 'default-secret' || value.length < 32)) {
    console.error(`❌ CRITICAL: ${varName} is insecure (${value === 'default-secret' ? 'using default' : 'too short'})`);
    hasErrors = true;
  } else {
    const preview = varName.includes('SECRET') || varName.includes('KEY') 
      ? '[CONFIGURED]' 
      : value.substring(0, 30) + (value.length > 30 ? '...' : '');
    console.log(`✅ ${varName}: ${preview}`);
  }
}

// Check optional variables
for (const [varName, value] of Object.entries(optionalEnvVars)) {
  if (!value) {
    console.warn(`⚠️ Optional: ${varName} is not set`);
  } else {
    const preview = varName.includes('SECRET') || varName.includes('KEY') 
      ? '[CONFIGURED]' 
      : value.substring(0, 30) + (value.length > 30 ? '...' : '');
    console.log(`✅ ${varName}: ${preview}`);
  }
}

if (hasErrors) {
  console.error('\n❌❌❌ CRITICAL ERRORS FOUND IN ENVIRONMENT CONFIGURATION ❌❌❌');
  console.error('❌ Authentication will NOT work properly!');
  console.error('❌ Please configure missing variables in your .env file');
  console.error('❌ Location: js/backend/.env\n');
  
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ EXITING due to missing required environment variables in PRODUCTION mode');
    process.exit(1);
  } else {
    console.warn('⚠️ Continuing in DEVELOPMENT mode, but authentication may fail\n');
  }
} else {
  console.log('✅ All required environment variables present and valid\n');
}

console.log('🚀 Server Configuration:', {
  port: PORT,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'not configured'
});
console.log('===============================================\n');

// Initialize Redis Cache Service
console.log('🚀 Initializing Redis Cache Service...');
if (!cacheService.enabled) {
  console.log('ℹ️ Redis cache disabled. Set REDIS_ENABLED=true (and REDIS_URL) once a Redis instance is provisioned.');
}

// --- LOGGING MIDDLEWARE ---
app.use(morgan('combined'));

// --- SECURITY MIDDLEWARE ---
// Configure helmet with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "https://www.paypal.com",
        "https://www.paypalobjects.com",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'", 
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.paypal.com",
        "https://api.sandbox.paypal.com",
        "https://sichrplace-production.up.railway.app"
      ],
      frameSrc: [
        "'self'",
        "https://www.paypal.com"
      ],
      formAction: ["'self'"]
    },
  },
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- CORS CONFIGURATION ---
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://sichrplace-production.up.railway.app', 
      'https://www.sichrplace.com',
      'https://sichrplace.com', // Allow both with and without www
      process.env.FRONTEND_URL // Allow configured frontend URL
    ].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5500'];

console.log('🔒 CORS Configuration:', {
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins
});

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, or API tests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In development, be more permissive for testing
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ CORS allowing unlisted origin for development:', origin);
        return callback(null, true);
      }
      console.error('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // Add URL-encoded form parsing

// Serve frontend static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Serve frontend files from frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend images from parent img directory
app.use('/img', express.static(path.join(__dirname, '..', 'img')));

// --- COOKIE PARSER (required for session/lusca) ---
app.use(cookieParser());

// --- SESSION (required for lusca CSRF) ---
app.use(session({
  secret: process.env.JWT_SECRET || 'your_super_secret_jwt_key_here',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using HTTPS
}));

// --- LUSCA CSRF PROTECTION (replaces csurf) ---
if (process.env.ENABLE_CSRF === 'true') {
  app.use(lusca.csrf());
  // Use the external csrf-token route module
  const csrfTokenRoute = require('./api/csrf-token');
  app.use('/api/csrf-token', csrfTokenRoute);
}

// Supabase connection with improved error handling
console.log('🔌 Attempting to connect to Supabase...');

// Test Supabase connection
testConnection().then(connected => {
  if (connected) {
    console.log('✅ Connected to Supabase successfully');
    console.log('🌐 Using Supabase PostgreSQL database');
  } else {
    console.error('❌ Failed to connect to Supabase');
    console.log('📋 Check these Supabase settings:');
    console.log('   • SUPABASE_URL in .env file');
    console.log('   • SUPABASE_SERVICE_ROLE_KEY in .env file');
    console.log('   • Database tables are created');
    console.log('⚠️  Continuing without database connection...');
  }
}).catch(err => {
  console.error('❌ Supabase connection error:', err.message);
  console.log('⚠️  Continuing without database connection...');
});

// Note: Database models have been migrated to Supabase
// Legacy booking request endpoints will be updated to use ViewingRequestService

// Existing routes
app.use('/api/send-message', sendMessageRoute);
app.use('/api', viewingRequestRoute); // Updated to mount at /api level for new endpoints
app.use('/api/viewing-confirmed', viewingConfirmedRoute);
app.use('/api/viewing-ready', viewingReadyRoute);
app.use('/api/viewing-didnt-work-out', viewingDidntWorkOutRoute);
app.use('/api/upload-apartment', uploadApartmentRoute); // Fixed route path
app.use('/api/apartments', apartmentsRoute);
app.use('/api/conversations', conversationsRoute);

// Add favorites API
const favoritesRoute = require('./api/favorites');
app.use('/api/favorites', favoritesRoute);

// Add Step 4 Enhanced User Experience APIs
const profileRoute = require('./api/profile');
app.use('/api/profile', profileRoute);

const savedSearchesRoute = require('./api/saved-searches');
app.use('/api/saved-searches', savedSearchesRoute);

const reviewsRoute = require('./api/reviews');
app.use('/api/reviews', reviewsRoute);

const notificationsRoute = require('./api/notifications');
app.use('/api/notifications', notificationsRoute);

const recentlyViewedRoute = require('./api/recently-viewed');
app.use('/api/recently-viewed', recentlyViewedRoute);


// Add Step 5 Advanced Search APIs
const advancedSearchRoute = require('./routes/advancedSearch');
app.use('/api/search', advancedSearchRoute);

// Add Step 6 Analytics Dashboard APIs
const analyticsDashboardRoute = require('./routes/analyticsDashboard');
app.use('/api/analytics', analyticsDashboardRoute);

// --- VIEWING REQUESTS ROUTES (Step 3) ---
app.use('/api/viewing-requests', viewingRequestsRoutes);
app.use('/api', bookingRequestsLegacyRoutes);

// --- GOOGLE MAPS ROUTES (Step 9.2) ---
app.use('/api/maps', mapsRoutes);

// --- PERFORMANCE ROUTES (Step 9.1) ---
app.use('/api/performance', performanceRoutes);
console.log('📊 Performance monitoring routes loaded');

// --- INTEGRATION HEALTH ROUTES ---
app.use('/api/integration-health', integrationHealthRoutes);

app.use('/auth', authRoutes); // Fixed route path - should be /auth not /api/auth
app.use('/api/gdpr', gdprRoutes);
app.use('/api/gdpr', gdprTrackingRoutes);

// Add missing feedback route
const feedbackRoute = require('./api/feedback');
app.use('/api/feedback', feedbackRoute);


// Add Stripe/Payment Integration routes
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// Add RESTful payments routes (for integration tests)
const paymentsRoutes = require('./routes/payments');
app.use('/api/payments', paymentsRoutes);

// Add PayPal payment routes
const paypalRoutes = require('./routes/paypal');
app.use('/api/payment/paypal', paypalRoutes);
app.use('/api/paypal', paypalRoutes); // Also mount on /api/paypal for compatibility

// Add Marketplace routes
const marketplaceRoutes = require('./routes/marketplace');
app.use('/api/marketplace', marketplaceRoutes);
console.log('🛒 Marketplace routes loaded');

// Add Smart Matching routes
const smartMatchingRoutes = require('./routes/smartMatching');
app.use('/api/matching', smartMatchingRoutes);
console.log('🎯 Smart matching routes loaded');

// --- CSRF Token Endpoint ---
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: res.locals._csrf || 'csrf-token-placeholder' });
});

// --- Google Forms Route ---
app.get('/api/google-forms/config', (req, res) => {
  res.json({
    formId: process.env.GOOGLE_FORM_ID || 'test-form-id',
    webhookUrl: process.env.WEBHOOK_URL || `${req.protocol}://${req.get('host')}/api/google-forms/webhook`
  });
});

// --- ADMIN ROUTES ---
app.use('/api/admin', adminRoutes);

// --- ADVANCED GDPR ROUTES ---
app.use('/api/admin/advanced-gdpr', advancedGdprRoutes);

// --- MESSAGES ROUTES ---
app.use('/api', messagesRoutes);

// --- EMAIL ROUTES ---
app.use('/api/emails', emailRoutes);

// --- CONFIGURATION ROUTES ---
app.use('/api/config', configRoutes);

// --- GOOGLE FORMS INTEGRATION ---
app.use('/api/google-forms', googleFormsRoutes);

// --- CHECK ADMIN ROUTE ---
app.get('/api/check-admin', auth, (req, res) => {
  res.json({ isAdmin: req.user.role === 'admin' });
});

// --- HEALTH CHECK WITH ENHANCED MONITORING ---
app.get('/api/health', async (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: cacheService.enabled ? {
      enabled: true,
      connected: cacheService.connected,
      status: cacheService.connected ? 'healthy' : 'disconnected'
    } : {
      enabled: false,
      connected: false,
      status: 'disabled'
    }
  };
  
  // Test database connection
  try {
    const dbConnected = await testConnection();
    healthData.database = {
      connected: dbConnected,
      status: dbConnected ? 'healthy' : 'disconnected'
    };
  } catch (error) {
    healthData.database = {
      connected: false,
      status: 'error',
      error: error.message
    };
  }
  
  // Set appropriate status code
  const cacheHealthy = !cacheService.enabled || healthData.cache.connected;
  const isHealthy = cacheHealthy && healthData.database.connected;
  res.status(isHealthy ? 200 : 503).json(healthData);
});

// --- SWAGGER DOCUMENTATION ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- ERROR HANDLER (should be last) ---
app.use(errorHandler);

// Graceful shutdown handling for Redis
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await cacheService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await cacheService.close();
  process.exit(0);
});

// Start the server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📊 Performance Dashboard: http://localhost:${PORT}/performance-dashboard.html`);
    console.log(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
