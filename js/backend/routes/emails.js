const express = require('express');
const router = express.Router();
const EmailService = require('../services/emailService');
const ViewingRequestService = require('../services/ViewingRequestService');
const { supabase } = require('../config/supabase');
const { logEmailActivity } = require('../services/EmailLogService');

// Initialize email service
const emailService = new EmailService();

/**
 * Email Activity Logging Function
 * Logs email activities for tracking and audit purposes
 */
/**
 * Email Flow Integration for SichrPlace Viewing Requests
 * Handles all three email stages of the viewing process
 */

/**
 * General email sending endpoint
 */
router.post('/send', async (req, res) => {
    try {
        const { to, subject, message, type = 'general' } = req.body;

        if (!to || !subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: to, subject, message'
            });
        }

        // Use the appropriate email method based on type
        let result;
        switch (type) {
            case 'viewing_confirmation':
                result = await emailService.sendRequestConfirmation(to, { message });
                break;
            case 'viewing_ready':
                result = await emailService.sendViewingReadyEmail(to, { message });
                break;
            case 'payment_confirmation':
                result = await emailService.sendPaymentConfirmation(to, { message });
                break;
            default:
                result = await emailService.sendTestEmail(to, subject, message);
        }

        if (result.success) {
            res.json({
                success: true,
                message: 'Email sent successfully',
                messageId: result.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send email'
            });
        }
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({
            success: false,
            error: 'Email service error'
        });
    }
});

/**
 * Get available email templates
 */
router.get('/templates', async (req, res) => {
    try {
        const templates = {
            viewing_confirmation: {
                name: 'Viewing Request Confirmation',
                description: 'Sent when user submits a viewing request'
            },
            viewing_ready: {
                name: 'Viewing Ready Notification',
                description: 'Sent when landlord approves viewing request'
            },
            payment_confirmation: {
                name: 'Payment Confirmation',
                description: 'Sent when payment is successfully processed'
            },
            general: {
                name: 'General Email',
                description: 'Generic email template'
            }
        };

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('Templates retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve templates'
        });
    }
});

/**
 * Stage 1: Send request confirmation email
 * Triggered when user submits a viewing request
 */
router.post('/send-request-confirmation', async (req, res) => {
    try {
        const { userEmail, userData } = req.body;

        if (!userEmail) {
            return res.status(400).json({
                success: false,
                error: 'User email is required'
            });
        }

        // Send Email #1: Request Confirmation
        const emailResult = await emailService.sendRequestConfirmation(userEmail, userData);

        if (emailResult.success) {
            // Log email sent in database
            try {
                await logEmailActivity({
                    recipientEmail: userEmail,
                    emailType: 'request_confirmation',
                    subject: emailResult.subject,
                    messageId: emailResult.messageId,
                    viewingRequestId: userData.requestId
                });
            } catch (logError) {
                console.warn('Failed to log email activity:', logError.message);
            }

            res.json({
                success: true,
                message: 'Request confirmation email sent successfully',
                messageId: emailResult.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send confirmation email',
                details: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error sending request confirmation email:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * Stage 2: Send viewing confirmation with payment link
 * Triggered when viewer is assigned and payment is required
 */
router.post('/send-viewing-confirmation', async (req, res) => {
    try {
        const { userEmail, userData, viewerData, paymentData } = req.body;

        if (!userEmail || !paymentData) {
            return res.status(400).json({
                success: false,
                error: 'User email and payment data are required'
            });
        }

        // Send Email #2: Viewing Confirmation with Payment
        const emailResult = await emailService.sendViewingConfirmation(
            userEmail, 
            userData, 
            viewerData, 
            paymentData
        );

        if (emailResult.success) {
            // Update viewing request status
            try {
                if (userData.requestId) {
                    const updates = {
                        status: 'payment_required',
                        payment_status: paymentData?.status || 'pending',
                        payment_id: paymentData?.paymentId || paymentData?.paypalOrderId || null,
                        booking_fee: paymentData?.amount ? Number(paymentData.amount) : undefined,
                        notes: [
                            viewerData?.name ? `Viewer assigned: ${viewerData.name}` : null,
                            paymentData?.paymentLink ? `Payment link: ${paymentData.paymentLink}` : null
                        ]
                        .filter(Boolean)
                        .join(' | ') || undefined
                    };

                    Object.keys(updates).forEach((key) => {
                        if (updates[key] === undefined || updates[key] === null || updates[key] === '') {
                            delete updates[key];
                        }
                    });

                    await ViewingRequestService.update(userData.requestId, updates);
                }

                await logEmailActivity({
                    recipientEmail: userEmail,
                    emailType: 'viewing_confirmation',
                    subject: emailResult.subject,
                    messageId: emailResult.messageId,
                    viewingRequestId: userData.requestId
                });
            } catch (updateError) {
                console.warn('Failed to update viewing request:', updateError.message);
            }

            res.json({
                success: true,
                message: 'Viewing confirmation email sent successfully',
                messageId: emailResult.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send viewing confirmation email',
                details: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error sending viewing confirmation email:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * Stage 3: Send viewing results with video/feedback
 * Triggered when viewing is completed and results are ready
 */
router.post('/send-viewing-results', async (req, res) => {
    try {
        const { userEmail, userData, resultsData } = req.body;

        if (!userEmail || !resultsData) {
            return res.status(400).json({
                success: false,
                error: 'User email and results data are required'
            });
        }

        // Send Email #3: Viewing Results
        const emailResult = await emailService.sendViewingResults(
            userEmail, 
            userData, 
            resultsData
        );

        if (emailResult.success) {
            // Update viewing request status to completed
            try {
                if (userData.requestId) {
                    const updates = {
                        status: 'completed',
                        notes: [
                            resultsData?.videoLink ? `Video: ${resultsData.videoLink}` : null,
                            resultsData?.summary ? `Summary: ${resultsData.summary}` : null
                        ]
                        .filter(Boolean)
                        .join(' | ') || undefined
                    };

                    Object.keys(updates).forEach((key) => {
                        if (updates[key] === undefined || updates[key] === null || updates[key] === '') {
                            delete updates[key];
                        }
                    });

                    await ViewingRequestService.update(userData.requestId, updates);
                }

                await logEmailActivity({
                    recipientEmail: userEmail,
                    emailType: 'viewing_results',
                    subject: emailResult.subject,
                    messageId: emailResult.messageId,
                    viewingRequestId: userData.requestId
                });
            } catch (updateError) {
                console.warn('Failed to update viewing request:', updateError.message);
            }

            res.json({
                success: true,
                message: 'Viewing results email sent successfully',
                messageId: emailResult.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send viewing results email',
                details: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error sending viewing results email:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * Stage 4: Send payment confirmation email
 * Triggered when PayPal payment is successfully processed
 */
router.post('/send-payment-confirmation', async (req, res) => {
    try {
        const { userEmail, userData, paymentData } = req.body;

        if (!userEmail || !paymentData) {
            return res.status(400).json({
                success: false,
                error: 'User email and payment data are required'
            });
        }

        // Send Email #4: Payment Confirmation
        const emailResult = await emailService.sendPaymentConfirmation(
            userEmail, 
            userData, 
            paymentData
        );

        if (emailResult.success) {
            // Update viewing request status to payment confirmed
            try {
                if (userData.requestId) {
                    const updates = {
                        status: 'approved',
                        payment_status: paymentData?.status || 'paid',
                        payment_id: paymentData?.transactionId || paymentData?.paymentId || null,
                        payment_amount: paymentData?.amount ? Number(paymentData.amount) : undefined
                    };

                    Object.keys(updates).forEach((key) => {
                        if (updates[key] === undefined || updates[key] === null || updates[key] === '') {
                            delete updates[key];
                        }
                    });

                    await ViewingRequestService.update(userData.requestId, updates);
                }

                await logEmailActivity({
                    recipientEmail: userEmail,
                    emailType: 'payment_confirmation',
                    subject: emailResult.subject,
                    messageId: emailResult.messageId,
                    viewingRequestId: userData.requestId
                });
            } catch (updateError) {
                console.warn('Failed to update viewing request:', updateError.message);
            }

            res.json({
                success: true,
                message: 'Payment confirmation email sent successfully',
                messageId: emailResult.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send payment confirmation email',
                details: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error sending payment confirmation email:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * Stage 5: Send viewing reminder email
 * Triggered 24 hours before scheduled viewing
 */
router.post('/send-viewing-reminder', async (req, res) => {
    try {
        const { userEmail, userData, viewingData } = req.body;

        if (!userEmail || !viewingData) {
            return res.status(400).json({
                success: false,
                error: 'User email and viewing data are required'
            });
        }

        // Send Email #5: Viewing Reminder
        const emailResult = await emailService.sendViewingReminder(
            userEmail, 
            userData, 
            viewingData
        );

        if (emailResult.success) {
            // Update viewing request with reminder sent
            try {
                if (userData.requestId) {
                    try {
                        const existing = await ViewingRequestService.findById(userData.requestId);
                        const noteParts = [];
                        if (existing?.notes) {
                            noteParts.push(existing.notes);
                        }
                        noteParts.push(`Reminder email sent ${new Date().toISOString()}`);

                        await ViewingRequestService.update(userData.requestId, {
                            notes: noteParts.join(' | ')
                        });
                    } catch (updateError) {
                        console.warn('Failed to record reminder note:', updateError.message);
                    }
                }

                await logEmailActivity({
                    recipientEmail: userEmail,
                    emailType: 'viewing_reminder',
                    subject: emailResult.subject,
                    messageId: emailResult.messageId,
                    viewingRequestId: userData.requestId
                });
            } catch (updateError) {
                console.warn('Failed to update viewing request:', updateError.message);
            }

            res.json({
                success: true,
                message: 'Viewing reminder email sent successfully',
                messageId: emailResult.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send viewing reminder email',
                details: emailResult.error
            });
        }

    } catch (error) {
        console.error('Error sending viewing reminder email:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * Test email configuration endpoint
 */
router.post('/test-email-config', async (req, res) => {
    try {
        const testResult = await emailService.testEmailConfiguration();
        
        res.json({
            success: testResult.success,
            message: testResult.success ? 'Email configuration is working' : 'Email configuration failed',
            details: testResult.error || 'Test email sent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to test email configuration',
            details: error.message
        });
    }
});

/**
 * Get email status for a viewing request
 */
router.get('/email-status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        
        let viewingRequest = null;
        try {
            viewingRequest = await ViewingRequestService.findById(requestId);
        } catch (serviceError) {
            console.warn('Failed to fetch viewing request for email status:', serviceError.message);
        }

        if (!viewingRequest) {
            return res.status(404).json({
                success: false,
                error: 'Viewing request not found'
            });
        }

        const statusSummary = {
            request_confirmation: null,
            viewing_confirmation: null,
            viewing_results: null,
            payment_confirmation: null,
            viewing_reminder: null
        };

        if (supabase && typeof supabase.from === 'function') {
            const candidateFilters = [
                { column: 'viewing_request_id', value: requestId },
                { column: 'related_entity_id', value: requestId }
            ];

            const recipientEmail = viewingRequest.email || viewingRequest.requester_email;
            if (recipientEmail) {
                candidateFilters.push({ column: 'recipient_email', value: recipientEmail });
            }

            for (const filter of candidateFilters) {
                try {
                    const { data, error } = await supabase
                        .from('email_logs')
                        .select('email_type, status, sent_at, subject')
                        .eq(filter.column, filter.value)
                        .order('sent_at', { ascending: false })
                        .limit(20);

                    if (error) {
                        console.warn(`Email status query failed for column ${filter.column}:`, error.message);
                        continue;
                    }

                    if (Array.isArray(data)) {
                        for (const log of data) {
                            if (log?.email_type && statusSummary.hasOwnProperty(log.email_type) && !statusSummary[log.email_type]) {
                                statusSummary[log.email_type] = {
                                    status: log.status || 'sent',
                                    sentAt: log.sent_at,
                                    subject: log.subject
                                };
                            }
                        }
                        // If we've captured all statuses, no need for further queries
                        const remaining = Object.values(statusSummary).filter((entry) => entry === null).length;
                        if (remaining === 0) {
                            break;
                        }
                    }
                } catch (logError) {
                    console.warn('Email status lookup error:', logError.message);
                }
            }
        }

        res.json({
            success: true,
            emailStatus: {
                requestConfirmation: statusSummary.request_confirmation,
                viewingConfirmation: statusSummary.viewing_confirmation,
                viewingResults: statusSummary.viewing_results,
                paymentConfirmation: statusSummary.payment_confirmation,
                viewingReminder: statusSummary.viewing_reminder
            },
            viewingRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get email status',
            details: error.message
        });
    }
});

module.exports = router;
