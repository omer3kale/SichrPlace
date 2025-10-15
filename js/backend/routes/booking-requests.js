const express = require('express');
const ViewingRequestService = require('../services/ViewingRequestService');
const EmailService = require('../services/emailService');
const { logEmailActivity } = require('../services/EmailLogService');

const router = express.Router();
const emailService = new EmailService();

function normalizeDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function sanitizeNumber(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function stripEmptyFields(payload) {
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (value === undefined || value === null || value === '') {
      delete payload[key];
    }
  });
  return payload;
}

router.post('/booking-request', async (req, res) => {
  try {
    const body = req.body || {};

    const apartmentId = body.apartmentId || body.apartment_id || body.apartment || body.apartmentID;
    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: 'apartmentId is required'
      });
    }

    const tenantEmail = body.applicantEmail || body.tenant_email || body.tenantEmail || body.email || body.userEmail;
    const requesterName = body.applicantName || body.tenant_names || body.tenantName || body.full_name || 'Guest';
    const requesterId = body.requesterId || body.requester_id || body.userId || '550e8400-e29b-41d4-a716-446655440000';
    const landlordId = body.landlordId || body.landlord_id || body.ownerId || '550e8400-e29b-41d4-a716-446655440001';

    const requestedDate = normalizeDate(body.viewingDate || body.move_in || body.requested_date || new Date());

    const messageParts = [];
    if (body.reason) messageParts.push(`Reason: ${body.reason}`);
    if (body.questions) messageParts.push(`Questions: ${body.questions}`);
    if (body.attentionPoints) messageParts.push(`Attention: ${body.attentionPoints}`);
    if (body.habits) messageParts.push(`Habits: ${body.habits}`);
    if (body.move_in) messageParts.push(`Move-in: ${body.move_in}`);
    if (body.move_out) messageParts.push(`Move-out: ${body.move_out}`);
    if (body.payer) messageParts.push(`Payer: ${body.payer}`);
    if (body.profile_link) messageParts.push(`Profile: ${body.profile_link}`);

    const requestData = stripEmptyFields({
      apartment_id: apartmentId,
      requester_id: requesterId,
      landlord_id: landlordId,
      requested_date: requestedDate,
      phone: body.applicantPhone || body.phone || null,
      email: tenantEmail,
      message: messageParts.length ? messageParts.join(' | ') : (body.message || null),
      notes: body.notes || body.additionalNotes || null,
      booking_fee: sanitizeNumber(body.booking_fee || body.paymentAmount || body.serviceFee),
      payment_id: body.paymentId || body.transactionId || null,
      payment_status: body.paymentStatus || (body.paymentId ? 'paid' : 'pending'),
      payment_amount: sanitizeNumber(body.paymentAmount || body.amount)
    });

    const viewingRequest = await ViewingRequestService.create(requestData);

    let emailSent = false;
    if (tenantEmail) {
      const userData = {
        firstName: requesterName.split(' ')[0] || 'there',
        apartmentAddress: body.apartmentAddress || body.apartment_title || body.apartmentLocation || 'Details being processed',
        requestId: viewingRequest.id
      };

      const emailResult = await emailService.sendRequestConfirmation(tenantEmail, userData);
      emailSent = emailResult.success;

      if (emailResult.success) {
        await logEmailActivity({
          recipientEmail: tenantEmail,
          emailType: 'request_confirmation',
          subject: emailResult.subject,
          messageId: emailResult.messageId,
          viewingRequestId: viewingRequest.id
        });
      }
    }

    return res.status(201).json({
      success: true,
      viewingRequest,
      emailSent
    });
  } catch (error) {
    console.error('Error processing booking request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

router.get('/booking-requests/:apartmentId', async (req, res) => {
  try {
    const { apartmentId } = req.params;
    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: 'apartmentId parameter is required'
      });
    }

    const requests = await ViewingRequestService.list({
      apartment_id: apartmentId,
      apartmentId
    });

    return res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching booking requests:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
