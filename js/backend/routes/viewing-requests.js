const express = require('express');
const router = express.Router();
const ViewingRequestService = require('../services/ViewingRequestService');
const EmailService = require('../services/emailService');
const auth = require('../middleware/auth');
const { supabase } = require('../config/supabase');

// Initialize email service
const emailService = new EmailService();

const NOTIFICATION_TYPES = {
  VIEWING_REQUEST: 'viewing_request',
  VIEWING_APPROVED: 'viewing_approved',
  VIEWING_REJECTED: 'viewing_rejected'
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = {},
  actionUrl = '/viewing-requests-dashboard.html',
  priority = 'normal'
}) => {
  if (!userId) {
    return { success: false, error: 'Missing user id' };
  }

  try {
    const { error } = await supabase.from('notifications').insert([
      {
        user_id: userId,
        type,
        title,
        message,
        data,
        action_url: actionUrl,
        priority
      }
    ]);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to create viewing notification:', error.message || error);
    return { success: false, error: error.message };
  }
};

// GET /api/viewing-requests - List viewing requests with filters
router.get('/', auth, async (req, res) => {
  try {
    const {
      status,
      payment_status,
      apartment_id,
      date_from,
      date_to,
      limit = 20,
      offset = 0
    } = req.query;

    const options = {
      status,
      paymentStatus: payment_status,
      apartmentId: apartment_id,
      dateFrom: date_from,
      dateTo: date_to,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Remove undefined values
    Object.keys(options).forEach(key => 
      options[key] === undefined && delete options[key]
    );

    const viewingRequests = await ViewingRequestService.list(options);
    
    res.json({
      success: true,
      data: viewingRequests,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: viewingRequests.length
      }
    });
  } catch (error) {
    console.error('Error fetching viewing requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch viewing requests'
    });
  }
});

// GET /api/viewing-requests/my-requests - Get current user's viewing requests (as tenant)
router.get('/my-requests', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const viewingRequests = await ViewingRequestService.findByRequester(userId);
    
    res.json({
      success: true,
      data: viewingRequests,
      count: viewingRequests.length
    });
  } catch (error) {
    console.error('Error fetching user viewing requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch your viewing requests'
    });
  }
});

// GET /api/viewing-requests/my-properties - Get viewing requests for current user's properties (as landlord)
router.get('/my-properties', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const viewingRequests = await ViewingRequestService.findByLandlord(userId);
    
    res.json({
      success: true,
      data: viewingRequests,
      count: viewingRequests.length
    });
  } catch (error) {
    console.error('Error fetching property viewing requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch viewing requests for your properties'
    });
  }
});

// GET /api/viewing-requests/statistics - Get viewing request statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await ViewingRequestService.getStatistics(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching viewing request statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// GET /api/viewing-requests/:id - Get specific viewing request
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const viewingRequest = await ViewingRequestService.findById(id);
    
    if (!viewingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Check if user has permission to view this request
    const userId = req.user.id;
    if (viewingRequest.requester_id !== userId && 
        viewingRequest.landlord_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: viewingRequest
    });
  } catch (error) {
    console.error('Error fetching viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch viewing request'
    });
  }
});

// POST /api/viewing-requests - Create new viewing request
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Validate required fields
    const {
      apartment_id,
      requested_date,
      message,
      phone,
      booking_fee = 25.00
    } = req.body;

    if (!apartment_id || !requested_date) {
      return res.status(400).json({
        success: false,
        error: 'Apartment ID and requested date are required'
      });
    }

    // Create viewing request data structure for Supabase
    const requestData = {
      apartment_id,
      requester_id: userId,
      landlord_id: req.body.landlord_id, // This should come from apartment data
      requested_date,
      alternative_date_1: req.body.alternative_date_1,
      alternative_date_2: req.body.alternative_date_2,
      message,
      phone,
      email: req.user.email,
      booking_fee,
      status: 'pending',
      payment_status: 'pending'
    };

    const viewingRequest = await ViewingRequestService.create(requestData);

    // Prepare user data for email
    const userData = {
      firstName: req.user.first_name || req.user.username || 'there',
      apartmentAddress: req.body.apartment_address || 'Details being processed',
      requestId: viewingRequest.id
    };

    // Send Email #1: Request Confirmation
    const emailResult = await emailService.sendRequestConfirmation(
      req.user.email,
      userData
    );

    if (emailResult.success) {
      console.log(`✅ Request confirmation email sent to ${req.user.email}`);
    } else {
      console.error(`❌ Failed to send request confirmation email: ${emailResult.error}`);
    }

    const landlordId = viewingRequest.landlord_id || req.body.landlord_id;
    const apartmentTitle = viewingRequest.apartment?.title || req.body.apartment_title || 'Apartment';
    const requesterName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.username || 'Ein Interessent';

    if (landlordId) {
      await createNotification({
        userId: landlordId,
        type: NOTIFICATION_TYPES.VIEWING_REQUEST,
        title: 'Neue Besichtigungsanfrage',
        message: `${requesterName} möchte "${apartmentTitle}" besichtigen.`,
        data: {
          viewingRequestId: viewingRequest.id,
          apartmentTitle,
          requesterName
        },
        priority: 'high'
      });
    }

    res.status(201).json({ 
      success: true, 
      data: viewingRequest,
      emailSent: emailResult.success,
      message: 'Viewing request created successfully'
    });
  } catch (error) {
    console.error('Error creating viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create viewing request'
    });
  }
});

// PUT /api/viewing-requests/:id - Update viewing request
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First, get the existing viewing request to check permissions
    const existingRequest = await ViewingRequestService.findById(id);
    
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Check if user has permission to update this request
    if (existingRequest.requester_id !== userId && 
        existingRequest.landlord_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Filter allowed fields based on user role
    let allowedFields = [];
    if (existingRequest.requester_id === userId) {
      // Requester can update these fields
      allowedFields = ['requested_date', 'alternative_date_1', 'alternative_date_2', 'message', 'phone'];
    } else if (existingRequest.landlord_id === userId) {
      // Landlord can update these fields
      allowedFields = ['status', 'confirmed_date', 'notes'];
    }

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedRequest = await ViewingRequestService.update(id, updateData);
    
    res.json({
      success: true,
      data: updatedRequest,
      message: 'Viewing request updated successfully'
    });
  } catch (error) {
    console.error('Error updating viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update viewing request'
    });
  }
});

// PATCH /api/viewing-requests/:id/approve - Approve viewing request
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmed_date } = req.body;
    const userId = req.user.id;

    // Get the viewing request to check permissions
    const viewingRequest = await ViewingRequestService.findById(id);
    
    if (!viewingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Only landlord can approve
    if (viewingRequest.landlord_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the property owner can approve viewing requests'
      });
    }

    const updatedRequest = await ViewingRequestService.approve(id, confirmed_date);

    const tenantEmail = updatedRequest.requester_email || updatedRequest.email;
    const tenantFirstName = updatedRequest.requester?.first_name || updatedRequest.requester_name;
    const apartmentTitle = updatedRequest.apartment?.title || 'Apartment';
    const confirmedDateDisplay = updatedRequest.confirmed_date;

    if (tenantEmail) {
      const emailPayload = {
        firstName: tenantFirstName,
        apartmentTitle,
        confirmedDate: confirmedDateDisplay,
        additionalNotes: updatedRequest.notes || ''
      };

      const approvalEmail = await emailService.sendViewingApprovedEmail(tenantEmail, emailPayload);

      if (!approvalEmail.success) {
        console.error('Failed to send viewing approved email:', approvalEmail.error);
      }
    }

    await createNotification({
      userId: updatedRequest.requester_id,
      type: NOTIFICATION_TYPES.VIEWING_APPROVED,
      title: 'Besichtigung bestätigt',
      message: `Deine Anfrage für "${apartmentTitle}" wurde bestätigt.`,
      data: {
        viewingRequestId: updatedRequest.id,
        apartmentTitle,
        confirmedDate: confirmedDateDisplay
      },
      priority: 'high'
    });

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Viewing request approved successfully'
    });
  } catch (error) {
    console.error('Error approving viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve viewing request'
    });
  }
});

// PATCH /api/viewing-requests/:id/reject - Reject viewing request
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Get the viewing request to check permissions
    const viewingRequest = await ViewingRequestService.findById(id);
    
    if (!viewingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Only landlord can reject
    if (viewingRequest.landlord_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the property owner can reject viewing requests'
      });
    }

    const updatedRequest = await ViewingRequestService.reject(id, reason);

    const tenantEmail = updatedRequest.requester_email || updatedRequest.email;
    const tenantFirstName = updatedRequest.requester?.first_name || updatedRequest.requester_name;
    const apartmentTitle = updatedRequest.apartment?.title || 'Apartment';

    if (tenantEmail) {
      const rejectionEmail = await emailService.sendViewingRejectedEmail(tenantEmail, {
        firstName: tenantFirstName,
        apartmentTitle,
        reason: updatedRequest.cancellation_reason
      });

      if (!rejectionEmail.success) {
        console.error('Failed to send viewing rejection email:', rejectionEmail.error);
      }
    }

    await createNotification({
      userId: updatedRequest.requester_id,
      type: NOTIFICATION_TYPES.VIEWING_REJECTED,
      title: 'Besichtigung nicht möglich',
      message: `Deine Anfrage für "${apartmentTitle}" wurde abgelehnt.`,
      data: {
        viewingRequestId: updatedRequest.id,
        apartmentTitle,
        reason: updatedRequest.cancellation_reason
      },
      priority: 'normal'
    });

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Viewing request rejected'
    });
  } catch (error) {
    console.error('Error rejecting viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject viewing request'
    });
  }
});

// PATCH /api/viewing-requests/:id/complete - Mark viewing request as completed
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get the viewing request to check permissions
    const viewingRequest = await ViewingRequestService.findById(id);
    
    if (!viewingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Only landlord can mark as completed
    if (viewingRequest.landlord_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the property owner can mark viewing as completed'
      });
    }

    const updatedRequest = await ViewingRequestService.complete(id);
    
    res.json({
      success: true,
      data: updatedRequest,
      message: 'Viewing request marked as completed'
    });
  } catch (error) {
    console.error('Error completing viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete viewing request'
    });
  }
});

// PATCH /api/viewing-requests/:id/payment - Update payment status
router.patch('/:id/payment', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_id } = req.body;
    const userId = req.user.id;

    // Get the viewing request to check permissions
    const viewingRequest = await ViewingRequestService.findById(id);
    
    if (!viewingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Only requester can update payment status
    if (viewingRequest.requester_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedRequest = await ViewingRequestService.updatePaymentStatus(id, payment_status, payment_id);
    
    res.json({
      success: true,
      data: updatedRequest,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
});

// DELETE /api/viewing-requests/:id - Cancel viewing request
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get the viewing request to check permissions
    const viewingRequest = await ViewingRequestService.findById(id);
    
    if (!viewingRequest) {
      return res.status(404).json({
        success: false,
        error: 'Viewing request not found'
      });
    }

    // Only requester can cancel their own request
    if (viewingRequest.requester_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the requester can cancel their viewing request'
      });
    }

    // If already approved or completed, don't allow cancellation
    if (['approved', 'completed'].includes(viewingRequest.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel an approved or completed viewing request'
      });
    }

  await ViewingRequestService.cancel(id, userId);
    
    res.json({
      success: true,
      message: 'Viewing request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling viewing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel viewing request'
    });
  }
});

module.exports = router;
