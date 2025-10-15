const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const UserService = require('../services/UserService');
const EmailService = require('../services/emailService');
const { supabase } = require('../config/supabase');
const router = express.Router();

const emailService = new EmailService();

// ===== HEALTH CHECK ENDPOINT =====
// This endpoint verifies that all critical authentication components are working
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
    environment: process.env.NODE_ENV || 'development'
  };

  // Check 1: Supabase Database Connection
  try {
    const startDb = Date.now();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    const dbTime = Date.now() - startDb;
    
    if (error) {
      health.checks.database = { 
        status: 'error', 
        message: error.message,
        responseTime: `${dbTime}ms`
      };
      health.status = 'degraded';
    } else {
      health.checks.database = { 
        status: 'ok',
        responseTime: `${dbTime}ms`
      };
    }
  } catch (err) {
    health.checks.database = { 
      status: 'error', 
      message: err.message 
    };
    health.status = 'degraded';
  }

  // Check 2: JWT Configuration
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    health.checks.jwt = { 
      status: 'error', 
      message: 'JWT_SECRET not configured' 
    };
    health.status = 'degraded';
  } else if (jwtSecret === 'default-secret') {
    health.checks.jwt = { 
      status: 'error', 
      message: 'JWT_SECRET using insecure default value' 
    };
    health.status = 'degraded';
  } else if (jwtSecret.length < 32) {
    health.checks.jwt = { 
      status: 'warning', 
      message: 'JWT_SECRET is too short (recommend 64+ characters)' 
    };
    health.status = 'degraded';
  } else {
    health.checks.jwt = { 
      status: 'ok',
      length: jwtSecret.length
    };
  }

  // Check 3: Supabase URL Configuration
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    health.checks.supabaseUrl = { 
      status: 'error', 
      message: 'SUPABASE_URL not configured' 
    };
    health.status = 'degraded';
  } else {
    health.checks.supabaseUrl = { 
      status: 'ok',
      configured: true
    };
  }

  // Check 4: Supabase Service Role Key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    health.checks.supabaseKey = { 
      status: 'error', 
      message: 'SUPABASE_SERVICE_ROLE_KEY not configured' 
    };
    health.status = 'degraded';
  } else {
    health.checks.supabaseKey = { 
      status: 'ok',
      configured: true
    };
  }

  // Check 5: Email Service (optional)
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    health.checks.email = { 
      status: 'warning', 
      message: 'Email service not configured (optional)' 
    };
  } else {
    health.checks.email = { 
      status: 'ok',
      configured: true
    };
  }

  // Overall health summary
  health.summary = {
    critical: Object.values(health.checks).filter(c => c.status === 'error').length,
    warnings: Object.values(health.checks).filter(c => c.status === 'warning').length,
    healthy: Object.values(health.checks).filter(c => c.status === 'ok').length
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Validation middleware
const validateRegistration = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('phone').optional().matches(/^[\+\d\s\-\(\)]+$/).withMessage('Please enter a valid phone number'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['tenant', 'landlord']).withMessage('Role must be either tenant or landlord'),
  body('terms').equals('true').withMessage('You must agree to the terms and conditions')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// User Registration
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, phone, username, password, role } = req.body;

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if username is taken
    const existingUsername = await UserService.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const emailVerificationToken = jwt.sign(
      { email: email.toLowerCase() },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );

    // Create user with role mapping
    const user = await UserService.create({
      username: username,
      first_name: firstName,
      last_name: lastName,
      email: email.toLowerCase(),
      phone: phone,
      password: hashedPassword,
      role: role, // UserService will handle the mapping
      email_verified: false,
      email_verification_token: emailVerificationToken,
      account_status: 'active'
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, emailVerificationToken);
    } catch (emailError) {
      console.warn('Failed to send verification email:', emailError.message);
    }

    // Get the effective role for response
    const userRole = UserService.getUserRole(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: userRole, // Return original role
        emailVerified: false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// User Login - BULLETPROOF VERSION
router.post('/login', validateLogin, async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🔐 [${requestId}] Login attempt started`, {
      email: req.body.email,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn(`⚠️ [${requestId}] Validation failed`, errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, remember } = req.body;

    // Find user by email with timeout protection
    let user;
    try {
      const userPromise = UserService.findByEmail(email.toLowerCase());
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      );
      user = await Promise.race([userPromise, timeoutPromise]);
    } catch (dbError) {
      console.error(`❌ [${requestId}] Database error finding user`, {
        error: dbError.message,
        email: email.toLowerCase()
      });
      return res.status(500).json({
        success: false,
        message: 'Database connection error. Please try again.',
        requestId
      });
    }

    if (!user) {
      console.warn(`⚠️ [${requestId}] User not found: ${email}`);
      await UserService.trackFailedLogin(email).catch(err => 
        console.error(`[${requestId}] Failed to track login attempt:`, err)
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log(`👤 [${requestId}] User found`, {
      userId: user.id,
      email: user.email,
      dbRole: user.role,
      bioRole: user.bio,
      accountStatus: user.account_status,
      blocked: user.blocked,
      failedAttempts: user.failed_login_attempts
    });

    // Check if user can login
    if (!UserService.canUserLogin(user)) {
      console.warn(`⛔ [${requestId}] Account cannot login`, { 
        userId: user.id,
        reason: user.account_status !== 'active' ? 'suspended' : 'blocked'
      });
      return res.status(403).json({
        success: false,
        message: 'Account is suspended or blocked. Please contact support.'
      });
    }

    // BULLETPROOF: Verify password exists and is valid
    if (!user.password || typeof user.password !== 'string' || user.password.length < 10) {
      console.error(`❌ [${requestId}] Invalid password hash in database`, { 
        userId: user.id,
        hasPassword: !!user.password,
        passwordType: typeof user.password,
        passwordLength: user.password?.length
      });
      return res.status(500).json({
        success: false,
        message: 'Account configuration error. Please reset your password or contact support.',
        requestId
      });
    }

    // BULLETPROOF: Password comparison with timeout and error handling
    let isPasswordValid;
    try {
      const comparePromise = bcrypt.compare(password, user.password);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Password comparison timeout')), 5000)
      );
      isPasswordValid = await Promise.race([comparePromise, timeoutPromise]);
      
      // Validate bcrypt returned boolean
      if (typeof isPasswordValid !== 'boolean') {
        throw new Error(`bcrypt.compare returned invalid type: ${typeof isPasswordValid}`);
      }
    } catch (compareError) {
      console.error(`❌ [${requestId}] Password comparison failed`, {
        error: compareError.message,
        userId: user.id
      });
      return res.status(500).json({
        success: false,
        message: 'Authentication service error. Please try again.',
        requestId
      });
    }

    if (!isPasswordValid) {
      console.warn(`⚠️ [${requestId}] Invalid password for user ${user.id}`);
      await UserService.trackFailedLogin(email).catch(err =>
        console.error(`[${requestId}] Failed to track failed login:`, err)
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Track successful login (non-blocking)
    UserService.trackSuccessfulLogin(user.id).catch(err =>
      console.error(`[${requestId}] Failed to track successful login:`, err)
    );

    // Get effective role and validate consistency
    const userRole = UserService.getUserRole(user);
    const roleIsValid = UserService.validateRoleConsistency(user);
    
    if (!roleIsValid) {
      console.error(`❌ [${requestId}] Role consistency validation failed`, {
        userId: user.id,
        dbRole: user.role,
        bioRole: user.bio,
        effectiveRole: userRole
      });
    }

    // BULLETPROOF: Verify JWT_SECRET exists and is secure
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'default-secret' || jwtSecret.length < 32) {
      console.error(`🚨 [${requestId}] JWT_SECRET not configured properly!`, {
        exists: !!jwtSecret,
        isDefault: jwtSecret === 'default-secret',
        length: jwtSecret?.length
      });
      return res.status(500).json({
        success: false,
        message: 'Authentication configuration error. Please contact administrator.',
        requestId
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: userRole,
        remember: remember || false
      },
      jwtSecret,
      { expiresIn: remember ? '30d' : '7d' }
    );

    const responseTime = Date.now() - startTime;
    console.log(`✅ [${requestId}] Login successful`, {
      userId: user.id,
      role: userRole,
      responseTime: `${responseTime}ms`,
      tokenExpiry: remember ? '30d' : '7d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: userRole,
        emailVerified: user.email_verified
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] Unexpected login error (${responseTime}ms)`, {
      error: error.message,
      stack: error.stack,
      email: req.body?.email
    });
    
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during login. Please try again.',
      requestId
    });
  }
});

// Email Verification
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // Find user and update verification status
    const user = await UserService.findByEmail(decoded.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.email_verified) {
      return res.status(200).json({
        success: true,
        message: 'Email already verified'
      });
    }

    // Update user verification status
    await UserService.update(user.id, {
      email_verified: true,
      email_verification_token: null
    });

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token'
    });
  }
});

// Password Reset Request
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    const { email } = req.body;
    
    const user = await UserService.findByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '1h' }
    );

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.warn('Failed to send password reset email:', emailError.message);
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

// Password Reset
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // Find user
    const user = await UserService.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password
    await UserService.update(user.id, {
      password: hashedPassword
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const user = await UserService.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.bio || 'user', // Return original role from bio
        emailVerified: user.email_verified,
        accountStatus: user.account_status,
        profilePicture: user.profile_picture,
        notificationPreferences: user.notification_preferences || {
          email: true,
          sms: false,
          push: true,
          marketing: false
        },
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Update user profile
router.put('/profile', [
  body('firstName').optional().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('lastName').optional().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('notificationPreferences').optional().isObject().withMessage('Notification preferences must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const { firstName, lastName, phone, notificationPreferences } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (notificationPreferences !== undefined) {
      updateData.notification_preferences = notificationPreferences;
    }

    const updatedUser = await UserService.update(decoded.userId, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        profilePicture: updatedUser.profile_picture,
        notificationPreferences: updatedUser.notification_preferences
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

/**
 * POST /auth/logout
 * User logout endpoint
 */
router.post('/logout', async (req, res) => {
  try {
    // In a stateless JWT setup, logout is typically handled client-side
    // by removing the token. However, we can log the logout event.
    
    // If using refresh tokens, you would invalidate them here
    // If using a token blacklist, you would add the token to it here
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

module.exports = router;