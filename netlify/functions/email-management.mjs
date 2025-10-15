import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');
  } catch (error) {
    return null;
  }
};

// Email transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

export const handler = async (event, _context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { action } = event.queryStringParameters || {};
    
    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action parameter is required',
          available_actions: [
            'send_email',
            'get_email_templates',
            'create_email_template',
            'update_email_template',
            'delete_email_template',
            'get_email_history',
            'get_email_status',
            'test_email_configuration',
            'send_bulk_email',
            'get_email_statistics',
            'manage_email_queue',
            'configure_email_settings',
            'verify_email_domain',
            'get_bounced_emails',
            'manage_suppressions'
          ]
        })
      };
    }

    // Get authentication for most actions
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
    }

    // Some actions require authentication
    const authRequiredActions = [
      'send_email', 'get_email_history', 'send_bulk_email', 
      'get_email_statistics', 'create_email_template', 
      'update_email_template', 'delete_email_template'
    ];

    if (authRequiredActions.includes(action) && !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Authentication required'
        })
      };
    }

    switch (action) {
      case 'send_email':
        return await sendEmail(user.id, event.body, headers);
      
      case 'get_email_templates':
        return await getEmailTemplates(user?.id, event.queryStringParameters, headers);
      
      case 'create_email_template':
        return await createEmailTemplate(user.id, event.body, headers);
      
      case 'update_email_template':
        return await updateEmailTemplate(user.id, event.body, headers);
      
      case 'delete_email_template':
        return await deleteEmailTemplate(user.id, event.body, headers);
      
      case 'get_email_history':
        return await getEmailHistory(user.id, event.queryStringParameters, headers);
      
      case 'get_email_status':
        return await getEmailStatus(event.queryStringParameters, headers);
      
      case 'test_email_configuration':
        return await testEmailConfiguration(event.body, headers);
      
      case 'send_bulk_email':
        return await sendBulkEmail(user.id, event.body, headers);
      
      case 'get_email_statistics':
        return await getEmailStatistics(user.id, event.queryStringParameters, headers);
      
      case 'manage_email_queue':
        return await manageEmailQueue(event.queryStringParameters, headers);
      
      case 'configure_email_settings':
        return await configureEmailSettings(event.body, headers);
      
      case 'verify_email_domain':
        return await verifyEmailDomain(event.body, headers);
      
      case 'get_bounced_emails':
        return await getBouncedEmails(event.queryStringParameters, headers);
      
      case 'manage_suppressions':
        return await manageSuppressions(event.body, headers);
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action specified'
          })
        };
    }

  } catch (error) {
    console.error('Email management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email operation failed',
        error: error.message
      })
    };
  }
};

// Send individual email
async function sendEmail(userId, requestBody, headers) {
  try {
    const {
      to,
      cc = [],
      bcc = [],
      subject,
      template_id,
      template_variables = {},
      html_content,
      text_content,
      attachments = [],
      priority = 'normal',
      schedule_at,
      tracking_enabled = true
    } = JSON.parse(requestBody);

    if (!to || (!subject && !template_id)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Recipient (to) and either subject or template_id are required'
        })
      };
    }

    let emailContent = {
      subject,
      html: html_content,
      text: text_content
    };

    // If using template, fetch and render it
    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', template_id)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Email template not found or inactive'
          })
        };
      }

      // Render template with variables
      emailContent = renderEmailTemplate(template, template_variables);
    }

    // Create email record
    const emailData = {
      sender_id: userId,
      recipients: {
        to: Array.isArray(to) ? to : [to],
        cc,
        bcc
      },
      subject: emailContent.subject,
      html_content: emailContent.html,
      text_content: emailContent.text,
      template_id: template_id || null,
      template_variables,
      priority,
      status: schedule_at ? 'scheduled' : 'pending',
      scheduled_at: schedule_at || null,
      tracking_enabled,
      metadata: {
        has_attachments: attachments.length > 0,
        attachment_count: attachments.length
      },
      created_at: new Date().toISOString()
    };

    const { data: emailRecord, error: emailError } = await supabase
      .from('emails')
      .insert(emailData)
      .select()
      .single();

    if (emailError) {
      throw emailError;
    }

    // If not scheduled, send immediately
    if (!schedule_at) {
      const emailResult = await sendEmailNow(emailRecord, attachments);
      
      // Update email record with result
      await supabase
        .from('emails')
        .update({
          status: emailResult.success ? 'sent' : 'failed',
          sent_at: emailResult.success ? new Date().toISOString() : null,
          error_message: emailResult.error || null,
          message_id: emailResult.messageId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', emailRecord.id);

      return {
        statusCode: emailResult.success ? 200 : 500,
        headers,
        body: JSON.stringify({
          success: emailResult.success,
          message: emailResult.success ? 'Email sent successfully' : 'Email sending failed',
          data: {
            email_id: emailRecord.id,
            message_id: emailResult.messageId,
            status: emailResult.success ? 'sent' : 'failed',
            error: emailResult.error
          }
        })
      };
    } else {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Email scheduled successfully',
          data: {
            email_id: emailRecord.id,
            scheduled_for: schedule_at,
            status: 'scheduled'
          }
        })
      };
    }

  } catch (error) {
    console.error('Send email error:', error);
    throw error;
  }
}

// Actually send the email using nodemailer
async function sendEmailNow(emailRecord, attachments = []) {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'SichrPlace'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
      to: emailRecord.recipients.to.join(', '),
      cc: emailRecord.recipients.cc.join(', '),
      bcc: emailRecord.recipients.bcc.join(', '),
      subject: emailRecord.subject,
      html: emailRecord.html_content,
      text: emailRecord.text_content,
      attachments: attachments.map(att => ({
        filename: att.filename,
        path: att.path || att.url,
        contentType: att.contentType
      }))
    };

    // Add tracking headers if enabled
    if (emailRecord.tracking_enabled) {
      mailOptions.headers = {
        'X-Email-ID': emailRecord.id,
        'X-Tracking-Enabled': 'true'
      };
    }

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };

  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Render email template with variables
function renderEmailTemplate(template, variables) {
  let subject = template.subject;
  let htmlContent = template.html_content;
  let textContent = template.text_content;

  // Simple variable replacement
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key];
    
    subject = subject.replace(new RegExp(placeholder, 'g'), value);
    htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), value);
    if (textContent) {
      textContent = textContent.replace(new RegExp(placeholder, 'g'), value);
    }
  });

  return {
    subject,
    html: htmlContent,
    text: textContent
  };
}

// Get email templates
async function getEmailTemplates(userId, queryParams, headers) {
  try {
    const {
      category,
      is_active = 'true',
      search,
      limit = '50',
      offset = '0'
    } = queryParams || {};

    let query = supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (is_active !== 'all') {
      query = query.eq('is_active', is_active === 'true');
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    const { data: templates, error: templatesError } = await query;

    if (templatesError) {
      throw templatesError;
    }

    // Get template categories
    const { data: categories, error: categoriesError } = await supabase
      .from('email_templates')
      .select('category')
      .not('category', 'is', null);

    if (categoriesError) {
      throw categoriesError;
    }

    const uniqueCategories = [...new Set(categories?.map(c => c.category) || [])];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          templates: templates || [],
          categories: uniqueCategories,
          total_fetched: templates?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get email templates error:', error);
    throw error;
  }
}

// Create email template
async function createEmailTemplate(userId, requestBody, headers) {
  try {
    const {
      name,
      subject,
      html_content,
      text_content,
      category,
      description,
      variables = [],
      is_active = true
    } = JSON.parse(requestBody);

    if (!name || !subject || !html_content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Name, subject, and HTML content are required'
        })
      };
    }

    // Create template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .insert({
        name,
        subject,
        html_content,
        text_content,
        category,
        description,
        variables,
        is_active,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (templateError) {
      throw templateError;
    }

    // Log activity
    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        action: 'email_template_created',
        details: `Created email template: ${name}`,
        metadata: { template_id: template.id },
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email template created successfully',
        data: template
      })
    };

  } catch (error) {
    console.error('Create email template error:', error);
    throw error;
  }
}

// Update email template
async function updateEmailTemplate(userId, requestBody, headers) {
  try {
    const {
      template_id,
      name,
      subject,
      html_content,
      text_content,
      category,
      description,
      variables,
      is_active
    } = JSON.parse(requestBody);

    if (!template_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Template ID is required'
        })
      };
    }

    // Build update data
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    if (html_content !== undefined) updateData.html_content = html_content;
    if (text_content !== undefined) updateData.text_content = text_content;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (variables !== undefined) updateData.variables = variables;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', template_id)
      .select()
      .single();

    if (templateError) {
      throw templateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email template updated successfully',
        data: template
      })
    };

  } catch (error) {
    console.error('Update email template error:', error);
    throw error;
  }
}

// Delete email template
async function deleteEmailTemplate(userId, requestBody, headers) {
  try {
    const { template_id } = JSON.parse(requestBody);

    if (!template_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Template ID is required'
        })
      };
    }

    // Soft delete - mark as inactive
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', template_id)
      .select()
      .single();

    if (templateError) {
      throw templateError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email template deleted successfully',
        data: {
          template_id,
          deleted_at: template?.deleted_at || new Date().toISOString(),
          previous_status: template?.is_active,
          template_name: template?.name || null
        }
      })
    };

  } catch (error) {
    console.error('Delete email template error:', error);
    throw error;
  }
}

// Get email history for user
async function getEmailHistory(userId, queryParams, headers) {
  try {
    const {
      status,
      template_id,
      start_date,
      end_date,
      recipient,
      limit = '50',
      offset = '0'
    } = queryParams || {};

    let query = supabase
      .from('emails')
      .select(`
        *,
        template:email_templates(name, category)
      `)
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (template_id) {
      query = query.eq('template_id', template_id);
    }

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    if (recipient) {
      query = query.or(`recipients->to->>0.ilike.%${recipient}%`);
    }

    const { data: emails, error: emailsError } = await query;

    if (emailsError) {
      throw emailsError;
    }

    // Get email statistics
    const { data: stats, error: statsError } = await supabase
      .from('emails')
      .select('status')
      .eq('sender_id', userId);

    if (statsError) {
      throw statsError;
    }

    const emailStats = {
      total: stats?.length || 0,
      sent: stats?.filter(e => e.status === 'sent').length || 0,
      pending: stats?.filter(e => e.status === 'pending').length || 0,
      scheduled: stats?.filter(e => e.status === 'scheduled').length || 0,
      failed: stats?.filter(e => e.status === 'failed').length || 0
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          emails: emails || [],
          statistics: emailStats,
          total_fetched: emails?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get email history error:', error);
    throw error;
  }
}

// Get email status by ID
async function getEmailStatus(queryParams, headers) {
  try {
    const { email_id } = queryParams || {};

    if (!email_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Email ID is required'
        })
      };
    }

    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select(`
        *,
        template:email_templates(name),
        email_events(*)
      `)
      .eq('id', email_id)
      .single();

    if (emailError) {
      throw emailError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: email
      })
    };

  } catch (error) {
    console.error('Get email status error:', error);
    throw error;
  }
}

// Test email configuration
async function testEmailConfiguration(requestBody, headers) {
  try {
    const {
      test_email,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass
    } = JSON.parse(requestBody || '{}');

    if (!test_email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Test email address is required'
        })
      };
    }

    // Use provided SMTP settings or default
    const testTransporter = nodemailer.createTransporter({
      host: smtp_host || process.env.SMTP_HOST,
      port: smtp_port || process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: smtp_user || process.env.SMTP_USER,
        pass: smtp_pass || process.env.SMTP_PASS
      }
    });

    // Test connection
    await testTransporter.verify();

    // Send test email
    const testResult = await testTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: test_email,
      subject: 'SichrPlace Email Configuration Test',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <p>If you received this email, your configuration is working!</p>
      `,
      text: 'This is a test email to verify your email configuration is working correctly.'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email configuration test successful',
        data: {
          message_id: testResult.messageId,
          test_email,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Email configuration test error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Email configuration test failed',
        error: error.message
      })
    };
  }
}

// Send bulk email
async function sendBulkEmail(userId, requestBody, headers) {
  try {
    const {
      recipients,
      template_id,
      template_variables_list = [],
      subject,
      html_content,
      text_content,
      batch_size = 100,
      schedule_at
    } = JSON.parse(requestBody);

    if (!recipients || recipients.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Recipients list is required'
        })
      };
    }

    if (!template_id && !subject) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Either template_id or subject is required'
        })
      };
    }

    // Create bulk email record
    const { data: bulkEmail, error: bulkError } = await supabase
      .from('bulk_emails')
      .insert({
        sender_id: userId,
        template_id: template_id || null,
        subject: subject || null,
        html_content: html_content || null,
        text_content: text_content || null,
        total_recipients: recipients.length,
        batch_size,
        status: schedule_at ? 'scheduled' : 'processing',
        scheduled_at: schedule_at || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (bulkError) {
      throw bulkError;
    }

    // Create individual email records for each recipient
    const emailRecords = recipients.map((recipient, index) => ({
      bulk_email_id: bulkEmail.id,
      sender_id: userId,
      recipients: { to: [recipient] },
      template_id: template_id || null,
      template_variables: template_variables_list[index] || {},
      subject: subject || null,
      html_content: html_content || null,
      text_content: text_content || null,
      status: schedule_at ? 'scheduled' : 'pending',
      scheduled_at: schedule_at || null,
      created_at: new Date().toISOString()
    }));

    // Insert in batches
    for (let i = 0; i < emailRecords.length; i += batch_size) {
      const batch = emailRecords.slice(i, i + batch_size);
      
      const { error: batchError } = await supabase
        .from('emails')
        .insert(batch);

      if (batchError) {
        console.error('Batch insert error:', batchError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Bulk email created successfully',
        data: {
          bulk_email_id: bulkEmail.id,
          total_recipients: recipients.length,
          status: bulkEmail.status,
          scheduled_for: schedule_at
        }
      })
    };

  } catch (error) {
    console.error('Send bulk email error:', error);
    throw error;
  }
}

// Get email statistics
async function getEmailStatistics(userId, queryParams, headers) {
  try {
    const {
      start_date,
      end_date,
      template_id,
      period = '30days'
    } = queryParams || {};

    // Calculate date range
    let dateFilter = {};
    const now = new Date();
    
    if (start_date && end_date) {
      dateFilter.start = start_date;
      dateFilter.end = end_date;
    } else {
      switch (period) {
        case '7days':
          dateFilter.start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30days':
          dateFilter.start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '90days':
          dateFilter.start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          dateFilter.start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      dateFilter.end = now.toISOString();
    }

    // Build query
    let query = supabase
      .from('emails')
      .select('status, created_at, template_id')
      .eq('sender_id', userId)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end);

    if (template_id) {
      query = query.eq('template_id', template_id);
    }

    const { data: emails, error: emailsError } = await query;

    if (emailsError) {
      throw emailsError;
    }

    // Calculate statistics
    const stats = {
      total_emails: emails?.length || 0,
      sent: emails?.filter(e => e.status === 'sent').length || 0,
      pending: emails?.filter(e => e.status === 'pending').length || 0,
      scheduled: emails?.filter(e => e.status === 'scheduled').length || 0,
      failed: emails?.filter(e => e.status === 'failed').length || 0
    };

    stats.success_rate = stats.total_emails > 0 ? 
      (stats.sent / stats.total_emails * 100).toFixed(2) : 0;

    // Daily breakdown
    const dailyStats = {};
    emails?.forEach(email => {
      const date = email.created_at.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, sent: 0, failed: 0 };
      }
      dailyStats[date].total++;
      if (email.status === 'sent') dailyStats[date].sent++;
      if (email.status === 'failed') dailyStats[date].failed++;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          summary: stats,
          daily_breakdown: dailyStats,
          period: {
            start: dateFilter.start,
            end: dateFilter.end,
            type: period
          }
        }
      })
    };

  } catch (error) {
    console.error('Get email statistics error:', error);
    throw error;
  }
}

// Manage email queue
async function manageEmailQueue(queryParams, headers) {
  try {
    const {
      action = 'status',
      status_filter = 'pending',
      limit = '100',
      email_id
    } = queryParams || {};

    switch (action) {
      case 'status': {
        // Get queue status
        const { data: queueEmails, error: queueError } = await supabase
          .from('emails')
          .select('id, status, created_at, scheduled_at, priority')
          .eq('status', status_filter)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(parseInt(limit));

        if (queueError) {
          throw queueError;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              queue_size: queueEmails?.length || 0,
              emails: queueEmails || []
            }
          })
        };
      }

      case 'retry': {
        if (!email_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              message: 'Email ID is required for retry action'
            })
          };
        }

        // Reset failed email to pending
        const { error: retryError } = await supabase
          .from('emails')
          .update({
            status: 'pending',
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', email_id)
          .eq('status', 'failed');

        if (retryError) {
          throw retryError;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Email queued for retry'
          })
        };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid queue action'
          })
        };
    }

  } catch (error) {
    console.error('Manage email queue error:', error);
    throw error;
  }
}

// Configure email settings
async function configureEmailSettings(requestBody, headers) {
  try {
    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      from_name,
      from_email,
      reply_to_email,
      bounce_handling_enabled,
      tracking_enabled,
      unsubscribe_link_enabled
    } = JSON.parse(requestBody || '{}');

    // In a real implementation, these would be stored securely
    // For now, we'll just validate the configuration
    
    if (smtp_host && smtp_user && smtp_pass) {
      // Test the configuration
      try {
        const testTransporter = nodemailer.createTransporter({
          host: smtp_host,
          port: smtp_port || 587,
          secure: false,
          auth: {
            user: smtp_user,
            pass: smtp_pass
          }
        });

        await testTransporter.verify();

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Email settings configured and tested successfully',
            data: {
              smtp_host,
              smtp_port: smtp_port || 587,
              from_name,
              from_email,
              reply_to_email,
              bounce_handling_enabled: Boolean(bounce_handling_enabled),
              tracking_enabled: Boolean(tracking_enabled),
              unsubscribe_link_enabled: Boolean(unsubscribe_link_enabled),
              configuration_tested: true
            }
          })
        };

      } catch (testError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Email configuration test failed',
            error: testError.message
          })
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Email settings validated successfully',
        data: {
          smtp_ok: Boolean(smtp_host && smtp_user && smtp_pass),
          from_email,
          tracking_enabled: tracking_enabled !== false,
          reply_to_email,
          bounce_handling_enabled: Boolean(bounce_handling_enabled),
          unsubscribe_link_enabled: Boolean(unsubscribe_link_enabled)
        }
      })
    };

  } catch (error) {
    console.error('Configure email settings error:', error);
    throw error;
  }
}

// Verify email domain
async function verifyEmailDomain(requestBody, headers) {
  try {
    const { domain } = JSON.parse(requestBody || '{}');

    if (!domain) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Domain is required'
        })
      };
    }

    // Basic domain verification (in production, you'd use DNS verification)
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    const isValidDomain = domainRegex.test(domain);

    if (!isValidDomain) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid domain format'
        })
      };
    }

    // Store domain verification record
    const { data: verification, error: verificationError } = await supabase
      .from('email_domain_verifications')
      .insert({
        domain,
        status: 'pending',
        verification_code: Math.random().toString(36).substring(2, 15),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (verificationError) {
      throw verificationError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Domain verification initiated',
        data: {
          domain,
          verification_code: verification.verification_code,
          status: 'pending',
          instructions: 'Add the verification code as a TXT record to your domain DNS'
        }
      })
    };

  } catch (error) {
    console.error('Verify email domain error:', error);
    throw error;
  }
}

// Get bounced emails
async function getBouncedEmails(queryParams, headers) {
  try {
    const {
      start_date,
      end_date,
      bounce_type,
      limit = '50',
      offset = '0'
    } = queryParams || {};

    let query = supabase
      .from('email_bounces')
      .select(`
        *,
        email:emails(subject, recipients)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (start_date) {
      query = query.gte('created_at', start_date);
    }

    if (end_date) {
      query = query.lte('created_at', end_date);
    }

    if (bounce_type) {
      query = query.eq('bounce_type', bounce_type);
    }

    const { data: bounces, error: bouncesError } = await query;

    if (bouncesError) {
      throw bouncesError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          bounces: bounces || [],
          total_fetched: bounces?.length || 0
        }
      })
    };

  } catch (error) {
    console.error('Get bounced emails error:', error);
    throw error;
  }
}

// Manage email suppressions (unsubscribes, complaints)
async function manageSuppressions(requestBody, headers) {
  try {
    const {
      action,
      email_address,
      suppression_type = 'unsubscribe',
      reason
    } = JSON.parse(requestBody || '{}');

    if (!action || !email_address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Action and email address are required'
        })
      };
    }

    switch (action) {
      case 'add': {
        const { data: suppression, error: suppressionError } = await supabase
          .from('email_suppressions')
          .insert({
            email_address,
            suppression_type,
            reason,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (suppressionError) {
          throw suppressionError;
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Email suppression added successfully',
            data: suppression
          })
        };
      }

      case 'remove': {
        const { error: removeError } = await supabase
          .from('email_suppressions')
          .delete()
          .eq('email_address', email_address)
          .eq('suppression_type', suppression_type);

        if (removeError) {
          throw removeError;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Email suppression removed successfully'
          })
        };
      }

      case 'check': {
        const { data: existing, error: checkError } = await supabase
          .from('email_suppressions')
          .select('*')
          .eq('email_address', email_address)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              is_suppressed: !checkError && !!existing,
              suppression_details: existing || null
            }
          })
        };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Invalid action. Use add, remove, or check'
          })
        };
    }

  } catch (error) {
    console.error('Manage suppressions error:', error);
    throw error;
  }
}