const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const lusca = require('lusca'); // switched from csurf to lusca for CSRF protection
const cookieParser = require('cookie-parser');
const session = require('express-session'); // required for lusca CSRF
const morgan = require('morgan');
require('dotenv').config({ path: __dirname + '/.env' });

// Import your admin routes and models
const sendMessageRoute = require('./api/send-message');
const viewingRequestRoute = require('./api/viewing-request');
const viewingConfirmedRoute = require('./api/viewing-confirmed');
const viewingReadyRoute = require('./api/viewing-ready');
const viewingDidntWorkOutRoute = require('./api/viewing-didnt-work-out');
const uploadApartmentRoute = require('./api/upload-apartment');
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
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const PORT = process.env.PORT || 3000; // Changed to match the running port

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
  ? ['https://sichrplace-production.up.railway.app', 'https://www.sichrplace.com']
  : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(bodyParser.json());

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

// MongoDB connection with improved error handling
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sichrplace';

console.log('🔌 Attempting to connect to MongoDB...');
console.log('📍 MongoDB URI:', mongoUri.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

// Detect connection type
const isAtlas = mongoUri.includes('mongodb+srv://');
const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');

mongoose
  .connect(mongoUri, {
    // Remove deprecated options
    serverSelectionTimeoutMS: 10000, // 10 seconds timeout for Atlas
    socketTimeoutMS: 45000, // 45 seconds socket timeout
  })
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    if (isAtlas) {
      console.log('🌐 Using MongoDB Atlas (SichrPlace cluster)');
    } else if (isLocal) {
      console.log('🏠 Using local MongoDB instance');
    }
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    
    if (isAtlas) {
      console.log('🌐 MongoDB Atlas Connection Failed');
      console.log('📋 Check these Atlas settings:');
      console.log('   • Database user credentials in connection string');
      console.log('   • IP address whitelist (Network Access)');
      console.log('   • Cluster is running (not paused)');
      console.log('📖 See MONGODB_ATLAS_SETUP.md for detailed instructions');
    } else if (isLocal) {
      console.log('🏠 Local MongoDB Connection Failed');
      console.log('💡 Make sure MongoDB is running on your system');
      console.log('🔧 Start MongoDB with: mongod');
      console.log('📖 Or switch to MongoDB Atlas - see MONGODB_ATLAS_SETUP.md');
    }
    
    // Don't exit the process, let the app run without MongoDB for frontend testing
    console.log('⚠️  Continuing without MongoDB connection...');
    console.log('🌐 Frontend will still work at http://localhost:3000');
  });

// BookingRequest Schema and Model (legacy, keep if used)
const bookingRequestSchema = new mongoose.Schema({
  apartmentId: { type: String, required: true },
  move_in: String,
  move_out: String,
  tenant_names: String,
  reason: String,
  habits: String,
  payer: String,
  profile_link: String,
  createdAt: { type: Date, default: Date.now }
});
const BookingRequest = mongoose.model('BookingRequest', bookingRequestSchema);

// API to create a booking request
app.post('/api/booking-request', async (req, res) => {
  try {
    const booking = new BookingRequest(req.body);
    await booking.save();
    res.json({ success: true, booking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// API to get all booking requests for an apartment
app.get('/api/booking-requests/:apartmentId', async (req, res) => {
  try {
    const requests = await BookingRequest.find({ apartmentId: req.params.apartmentId });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Existing routes
app.use('/api/send-message', sendMessageRoute);
app.use('/api', viewingRequestRoute); // Updated to mount at /api level for new endpoints
app.use('/api/viewing-confirmed', viewingConfirmedRoute);
app.use('/api/viewing-ready', viewingReadyRoute);
app.use('/api/viewing-didnt-work-out', viewingDidntWorkOutRoute);
app.use('/upload-apartment', uploadApartmentRoute);
app.use('/api/auth', authRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/gdpr', gdprTrackingRoutes);

// --- ADMIN ROUTES ---
app.use('/api/admin', adminRoutes);

// --- ADVANCED GDPR ROUTES ---
app.use('/api/admin/advanced-gdpr', advancedGdprRoutes);

// --- MESSAGES ROUTES ---
app.use('/api', messagesRoutes);

// --- EMAIL ROUTES ---
app.use('/api/emails', emailRoutes);

// --- GOOGLE FORMS INTEGRATION ---
app.use('/api/google-forms', googleFormsRoutes);

// --- CHECK ADMIN ROUTE ---
app.get('/api/check-admin', auth, (req, res) => {
  res.json({ isAdmin: req.user.role === 'admin' });
});

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- SWAGGER DOCUMENTATION ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- ERROR HANDLER (should be last) ---
app.use(errorHandler);

// Start the server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
