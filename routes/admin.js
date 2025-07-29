/**
 * POST /api/admin/messages/:idx/resolve
 * Resolve a support ticket (admin only)
 */
router.post('/messages/:idx/resolve', auth, adminOnly, async (req, res) => {
  // TODO: Implement real DB logic to resolve ticket
  res.json({ success: true, message: `Ticket ${req.params.idx} resolved.` });
});

/**
 * POST /api/admin/reports/:idx/resolve
 * Resolve a trust/safety report (admin only)
 */
router.post('/reports/:idx/resolve', auth, adminOnly, async (req, res) => {
  // TODO: Implement real DB logic to resolve report
  res.json({ success: true, message: `Report ${req.params.idx} resolved.` });
});

/**
 * POST /api/admin/refunds/:idx/approve
 * Approve a refund request (admin only)
 */
router.post('/refunds/:idx/approve', auth, adminOnly, async (req, res) => {
  // TODO: Implement real DB logic to approve refund
  res.json({ success: true, message: `Refund ${req.params.idx} approved.` });
});

/**
 * POST /api/admin/refunds/:idx/deny
 * Deny a refund request (admin only)
 */
router.post('/refunds/:idx/deny', auth, adminOnly, async (req, res) => {
  // TODO: Implement real DB logic to deny refund
  res.json({ success: true, message: `Refund ${req.params.idx} denied.` });
});

/**
 * POST /api/admin/gdpr/:idx/action
 * Handle GDPR request (admin only)
 */
router.post('/gdpr/:idx/action', auth, adminOnly, async (req, res) => {
  // TODO: Implement real DB logic for GDPR action
  res.json({ success: true, message: `GDPR request ${req.params.idx} actioned.` });
});
/**
 * GET /api/admin/upload-queue
 * Fetch upload queue (admin only)
 */
router.get('/upload-queue', auth, adminOnly, (req, res) => {
  // Example mock data
  res.json([
    { apartment: 'APT-123', status: 'Awaiting upload' },
    { apartment: 'APT-456', status: 'Processing' }
  ]);
});

/**
 * GET /api/admin/video-links
 * Fetch secure video links (admin only)
 */
router.get('/video-links', auth, adminOnly, (req, res) => {
  // Example mock data
  res.json([
    { apartment: 'APT-123', recipient: 'Jane Doe', url: '#', status: 'Active (expires in 47h)' },
    { apartment: 'APT-456', recipient: 'John Smith', url: '#', status: 'Expired' }
  ]);
});

/**
 * GET /api/admin/account-reps
 * Fetch account rep tracker (admin only)
 */
router.get('/account-reps', auth, adminOnly, (req, res) => {
  // Example mock data
  res.json([
    { name: 'Sarah Rep', assignedCases: 8, avgTurnaround: 2.1 },
    { name: 'Mike Rep', assignedCases: 5, avgTurnaround: 1.7 }
  ]);
});

/**
 * GET /api/admin/payments
 * Fetch payments & transactions (admin only)
 */
router.get('/payments', auth, adminOnly, async (req, res) => {
  // TODO: Replace with real payment DB logic
  res.json({
    revenueMonth: '€2,300',
    fraudFlags: 1,
    logs: [],
    refunds: []
  });
});

/**
 * POST /api/admin/payments/:id/refund
 * Refund a payment (admin only)
 */
router.post('/payments/:id/refund', auth, adminOnly, async (req, res) => {
  // TODO: Implement real refund logic
  res.json({ success: true, message: `Payment ${req.params.id} refunded.` });
});

/**
 * GET /api/admin/reports
 * Fetch trust & safety reports (admin only)
 */
router.get('/reports', auth, adminOnly, (req, res) => {
  // Example mock data
  res.json({
    users: 2,
    listings: 1,
    items: [
      { type: 'User', target: 'John Smith', reason: 'Spam', status: 'Open' },
      { type: 'Listing', target: 'APT-123', reason: 'Scam Suspicion', status: 'Pending' }
    ],
    gdpr: [
      { type: 'Access', user: 'Jane Doe' },
      { type: 'Deletion', user: 'Bob Owner' }
    ],
    flags: [
      { user: 'John Smith', count: 3, patterns: ['Spam', 'Dispute', 'Inappropriate Msg'] }
    ]
  });
});

/**
 * GET /api/admin/analytics
 * Fetch analytics & insights (admin only)
 */
router.get('/analytics', auth, adminOnly, (req, res) => {
  // Example mock data
  res.json({
    heatmapUsers: 120,
    peakUsage: '19:00',
    topQueries: 8,
    matchSuccess: '72%',
    commonQueries: [
      'How do I book a viewing?',
      'How do I contact a landlord?',
      'How do I upload documents?'
    ]
  });
});
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Middleware to check for admin role
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admins only.' });
}

/**
 * GET /api/admin/login-check
 * Checks if the authenticated user is an admin.
 * Frontend can use this to decide navigation after login.
 */
router.get('/login-check', auth, adminOnly, (req, res) => {
  res.status(200).json({
    message: 'Welcome, admin!',
    user: {
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

/**
 * GET /api/admin/users
 * Fetch all users with optional filtering/searching (admin only)
 * Query params: role, status, q (search)
 */
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const { role, status, q } = req.query;
    let filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ];
    }
    const users = await User.find(filter).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

/**
 * POST /api/admin/users/:username/verify
 * Verify a user (admin only)
 */
router.post('/users/:username/verify', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { verified: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify user.' });
  }
});

/**
 * POST /api/admin/users/:username/suspend
 * Suspend a user (admin only)
 */
router.post('/users/:username/suspend', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { status: 'suspended' },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend user.' });
  }
});

/**
 * POST /api/admin/users/:username/deactivate
 * Deactivate a user (admin only)
 */
router.post('/users/:username/deactivate', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      { status: 'deactivated' },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user.' });
  }
});

/**
 * GET /api/admin/dashboard
 * Aggregated analytics for dashboard (admin only)
 */
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    const [totalUsers, activeOffers, totalListings, verifiedListings, expiredListings, newRenters, newLandlords, checksRequested, checksDelivered, satisfactionScore] = await Promise.all([
      User.countDocuments(),
      Offer.countDocuments({ isActive: true }),
      Offer.countDocuments(),
      Offer.countDocuments({ verified: true }),
      Offer.countDocuments({ status: 'Expired' }),
      User.countDocuments({ role: 'applicant', createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } }),
      User.countDocuments({ role: 'landlord', createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } }),
      ViewingRequest.countDocuments({}),
      ViewingRequest.countDocuments({ status: 'Delivered' }),
      4.7 // Placeholder for satisfaction score
    ]);
    res.json({
      analytics: {
        totalUsers,
        activeOffers,
        totalListings,
        verifiedListings,
        expiredListings,
        newRenters,
        newLandlords,
        checksRequested,
        checksDelivered,
        satisfactionScore
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard analytics.' });
  }
});

/**
 * GET /api/admin/offers
 * Fetch all offers with optional filtering/searching (admin only)
 * Query params: status, q (search)
 */
router.get('/offers', auth, adminOnly, async (req, res) => {
  try {
    const { status, q } = req.query;
    let filter = {};
    if (status) filter.status = status;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } }
      ];
    }
    const offers = await Offer.find(filter).populate('landlord', 'username email').lean();
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offers.' });
  }
});

/**
 * POST /api/admin/offers/:id/highlight
 * Highlight an offer (admin only)
 */
router.post('/offers/:id/highlight', auth, adminOnly, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { highlight: true },
      { new: true }
    );
    if (!offer) return res.status(404).json({ error: 'Offer not found.' });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to highlight offer.' });
  }
});

/**
 * POST /api/admin/offers/:id/activate
 * Activate an offer (admin only)
 */
router.post('/offers/:id/activate', auth, adminOnly, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { isActive: true, status: 'Active' },
      { new: true }
    );
    if (!offer) return res.status(404).json({ error: 'Offer not found.' });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate offer.' });
  }
});

/**
 * POST /api/admin/offers/:id/deactivate
 * Deactivate an offer (admin only)
 */
router.post('/offers/:id/deactivate', auth, adminOnly, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      { isActive: false, status: 'Inactive' },
      { new: true }
    );
    if (!offer) return res.status(404).json({ error: 'Offer not found.' });
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate offer.' });
  }
});

/**
 * GET /api/admin/viewing-requests
 * Fetch all viewing requests (admin only)
 */
router.get('/viewing-requests', auth, adminOnly, (req, res) => {
  // Example mock data:
  const viewingRequests = [
    { id: 'VR-001', apartment: 'APT-123', requestedBy: 'applicant1', dateRequested: '2025-07-05', status: 'Pending' }
  ];
  res.json(viewingRequests);
});

/**
 * GET /api/admin/messages
 * Fetch all support messages (admin only)
 */
router.get('/messages', auth, adminOnly, (req, res) => {
  // Example mock data:
  const messages = [
    { id: 'msg-1', user: 'omer', message: 'How do I reset my password?', date: '2025-06-15' }
  ];
  res.json(messages);
});

/**
 * GET /api/admin/settings
 * Example: Get admin settings
 */
router.get('/settings', auth, adminOnly, (req, res) => {
  // Replace this with real settings data if needed
  res.json({ settings: { theme: 'dark', notifications: true } });
});

/**
 * POST /api/admin/announce
 * Example: Send an announcement to all users (future feature)
 */
router.post('/announce', auth, adminOnly, (req, res) => {
  // Placeholder for sending announcements
  // e.g., sendMailToAllUsers(req.body.subject, req.body.message);
  res.status(200).json({ message: 'Announcement sent (demo endpoint).' });
});

/**
 * POST /api/admin/users/:username/block
 * Block a user (admin only)
 */
router.post('/users/:username/block', auth, adminOnly, async (req, res) => {
  try {
    // Example: await User.updateOne({ username: req.params.username }, { blocked: true });
    res.json({ success: true, message: `User ${req.params.username} blocked.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block user.' });
  }
});

/**
 * DELETE /api/admin/users/:username
 * Delete a user (admin only)
 */
router.delete('/users/:username', auth, adminOnly, async (req, res) => {
  try {
    // Example: await User.deleteOne({ username: req.params.username });
    res.json({ success: true, message: `User ${req.params.username} deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

/**
 * DELETE /api/admin/offers/:id
 * Remove an offer (admin only)
 */
router.delete('/offers/:id', auth, adminOnly, async (req, res) => {
  try {
    // Example: await Offer.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: `Offer ${req.params.id} removed.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove offer.' });
  }
});

/**
 * POST /api/admin/viewing-requests/:id/done
 * Mark a viewing request as done (admin only)
 */
router.post('/viewing-requests/:id/done', auth, adminOnly, async (req, res) => {
  try {
    // Example: await ViewingRequest.updateOne({ _id: req.params.id }, { status: 'Done' });
    res.json({ success: true, message: `Viewing request ${req.params.id} marked as done.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark viewing as done.' });
  }
});

module.exports = router;