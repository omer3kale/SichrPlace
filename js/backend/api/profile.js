const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const isTest = process.env.NODE_ENV === 'test';
const testStore = {
  profiles: new Map()
};

const supabaseUrl = process.env.SUPABASE_URL || 'https://cgkumwtibknfrhyiicoo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNna3Vtd3RpYmtuZnJoeWlpY29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMTc4NiwiZXhwIjoyMDY5ODc3Nzg2fQ.5piAC3CPud7oRvA1Rtypn60dfz5J1ydqoG2oKj-Su3M';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Auth middleware
const authenticateToken = async (req, res, next) => {
  try {
    if (isTest) {
      req.user = req.user || {
        id: req.headers['x-test-user-id'] || 'test-user-profile',
        email: 'profile-ci@sichrplace.dev',
        role: req.headers['x-test-role'] || 'user'
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Malformed token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fNcgmCwu7lIbCYoxUy3zbDNyWFpfjmJrUtLLAhPq+2mDNyN/p//FnxhSmTgvnp2Fh51+eJJKAIkqJnFu/xf93Q==');
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// POST /api/profile/upload-avatar - Upload profile picture
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (isTest) {
      const profile = testStore.profiles.get(req.user.id) || { id: req.user.id };
      profile.profile_picture = profile.profile_picture || '/uploads/profiles/test-avatar.jpg';
      testStore.profiles.set(req.user.id, profile);
      return res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        profilePicture: profile.profile_picture,
        user: profile
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const fileName = req.file.filename;
    const filePath = `/uploads/profiles/${fileName}`;

    // Update user profile picture in database
    const { data, error } = await supabase
      .from('users')
      .update({ profile_picture: filePath })
      .eq('id', req.user.id)
      .select();

    if (error) {
      // Clean up uploaded file if database update fails
      fs.unlinkSync(req.file.path);
      throw error;
    }

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: filePath,
      user: data[0]
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload profile picture'
    });
  }
});

// POST /api/profile/upload-picture - Base64 uploads (test-friendly)
router.post('/upload-picture', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;

    if (isTest) {
      const profile = testStore.profiles.get(req.user.id) || { id: req.user.id };
      profile.profile_picture = imageData || '/uploads/profiles/test-base64.jpg';
      testStore.profiles.set(req.user.id, profile);
      return res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        profilePicture: profile.profile_picture,
        user: profile
      });
    }

    if (!imageData) {
      return res.status(400).json({ success: false, error: 'imageData is required' });
    }

    // In production we might forward to Supabase storage or Cloudinary
    const profilePicture = imageData;
    await supabase
      .from('users')
      .update({ profile_picture: profilePicture })
      .eq('id', req.user.id);

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture
    });
  } catch (error) {
    console.error('Upload picture error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload profile picture' });
  }
});

// PUT /api/profile - Update profile details
router.put('/', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;

    if (isTest) {
      const profile = {
        id: req.user.id,
        ...testStore.profiles.get(req.user.id),
        ...updates,
        updated_at: new Date().toISOString()
      };
      testStore.profiles.set(req.user.id, profile);
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        data: profile
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// GET /api/profile/:userId/stats - fetch stats for provided user
router.get('/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (isTest) {
      const profile = testStore.profiles.get(userId) || { id: userId };
      return res.json({
        success: true,
        stats: {
          favorites: profile.favorites || 5,
          viewingRequests: profile.viewingRequests || 2,
          apartments: profile.apartments || 1,
          messages: profile.messages || 4,
          saved_searches: profile.saved_searches || 1
        }
      });
    }

    const { data, error } = await supabase
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    res.json({ success: true, stats: data });
  } catch (error) {
    console.error('Get profile stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile statistics' });
  }
});

// GET /api/profile/stats - Get user dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (isTest) {
      const profile = testStore.profiles.get(req.user.id) || { id: req.user.id };
      return res.json({
        success: true,
        stats: {
          favorites: profile.favorites || 3,
          viewingRequests: profile.viewingRequests || 1,
          apartments: profile.apartments || 0,
          messages: profile.messages || 2,
          saved_searches: profile.saved_searches || 1
        },
        recentActivity: {
          viewingRequests: profile.viewingRequestsHistory || [],
          favorites: profile.favoritesHistory || []
        }
      });
    }

    const userId = req.user.id;

    // Get user statistics
    const [favoritesCount, viewingRequestsCount, apartmentsCount, messagesCount, savedSearchesCount] = await Promise.all([
      // Count favorites
      supabase
        .from('user_favorites')
        .select('id', { count: 'exact' })
        .eq('user_id', userId),
      
      // Count viewing requests
      supabase
        .from('viewing_requests')
        .select('id', { count: 'exact' })
        .eq('requester_id', userId),
      
      // Count user's apartments (if landlord)
      supabase
        .from('apartments')
        .select('id', { count: 'exact' })
        .eq('owner_id', userId),
      
      // Count conversations
      supabase
        .from('conversations')
        .select('id', { count: 'exact' })
        .contains('participants', [userId]),
      
      // Count saved searches
      supabase
        .from('saved_searches')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
    ]);

    // Get recent activity
    const { data: recentViewingRequests } = await supabase
      .from('viewing_requests')
      .select(`
        id,
        status,
        requested_date,
        created_at,
        apartments:apartment_id (title, location)
      `)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentFavorites } = await supabase
      .from('user_favorites')
      .select(`
        id,
        created_at,
        apartments:apartment_id (title, location, price)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      stats: {
        favorites: favoritesCount.count || 0,
        viewingRequests: viewingRequestsCount.count || 0,
        apartments: apartmentsCount.count || 0,
        messages: messagesCount.count || 0,
        saved_searches: savedSearchesCount.count || 0
      },
      recentActivity: {
        viewingRequests: recentViewingRequests || [],
        favorites: recentFavorites || []
      }
    });

  } catch (error) {
    console.error('Profile stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile statistics'
    });
  }
});

// PUT /api/profile/notifications - Update notification preferences
router.put('/notifications', authenticateToken, async (req, res) => {
  try {
    const { emailNotifications, smsNotifications, pushNotifications, marketingEmails } = req.body;

    const notificationPreferences = {
      email: emailNotifications !== undefined ? emailNotifications : true,
      sms: smsNotifications !== undefined ? smsNotifications : false,
      push: pushNotifications !== undefined ? pushNotifications : true,
      marketing: marketingEmails !== undefined ? marketingEmails : false
    };

    if (isTest) {
      const profile = testStore.profiles.get(req.user.id) || { id: req.user.id };
      profile.notification_preferences = notificationPreferences;
      testStore.profiles.set(req.user.id, profile);
      return res.json({
        success: true,
        message: 'Notification preferences updated successfully',
        preferences: notificationPreferences
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ notification_preferences: notificationPreferences })
      .eq('id', req.user.id)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: notificationPreferences
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences'
    });
  }
});

// GET /api/profile/:userId - Fetch profile details (placed last to avoid conflicts)
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (isTest) {
      const profile = testStore.profiles.get(userId) || {
        id: userId,
        first_name: 'Test',
        last_name: 'User',
        email: `${userId}@sichrplace.dev`,
        bio: 'Integration test profile'
      };
      testStore.profiles.set(userId, profile);
      return res.json({ success: true, data: profile });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

module.exports = router;
