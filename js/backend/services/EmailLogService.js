const { supabase } = require('../config/supabase');
const fsp = require('fs').promises;
const path = require('path');

const FALLBACK_LOG_DIR = path.join(__dirname, '..', 'logs');
const FALLBACK_LOG_FILE = path.join(FALLBACK_LOG_DIR, 'email-activity.log');

async function writeFallbackLog(entry) {
  try {
    await fsp.mkdir(FALLBACK_LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ...entry, persisted_at: new Date().toISOString(), target: 'file' }) + '\n';
    await fsp.appendFile(FALLBACK_LOG_FILE, line, 'utf8');
  } catch (fileError) {
    console.warn('⚠️  Failed to write fallback email log:', fileError.message);
  }
}

/**
 * Persist email activity to Supabase with graceful fallbacks.
 * @param {Object} params
 * @param {string} params.recipientEmail
 * @param {string} params.emailType
 * @param {string} [params.subject]
 * @param {string} [params.messageId]
 * @param {string} [params.viewingRequestId]
 * @returns {Promise<{success: boolean, logEntry?: Object, error?: string}>}
 */
async function logEmailActivity({
  recipientEmail,
  emailType,
  subject,
  messageId,
  viewingRequestId
}) {
  try {
    const sentAt = new Date().toISOString();
    const logEntry = {
      recipient_email: recipientEmail,
      email_type: emailType,
      subject: subject || `[${emailType}]`,
      status: 'sent',
      sent_at: sentAt
    };

    if (messageId) {
      logEntry.provider_message_id = messageId;
      logEntry.message_id = messageId;
    }

    if (viewingRequestId) {
      logEntry.viewing_request_id = viewingRequestId;
      logEntry.related_entity_type = 'viewing_request';
      logEntry.related_entity_id = viewingRequestId;
    }

    console.log('📧 Email Activity Logged:', logEntry);

    if (!supabase || typeof supabase.from !== 'function') {
      await writeFallbackLog({ ...logEntry, reason: 'supabase_unavailable' });
      return { success: false, reason: 'supabase_unavailable', logEntry };
    }

    const { error } = await supabase
      .from('email_logs')
      .insert([logEntry]);

    if (error) {
      console.warn('⚠️  Failed to persist email activity to Supabase:', error.message);
      await writeFallbackLog({ ...logEntry, error: error.message });
      return { success: false, error: error.message, logEntry };
    }

    return { success: true, logEntry };
  } catch (error) {
    console.error('Failed to log email activity:', error);
    await writeFallbackLog({ error: error.message, raw: { recipientEmail, emailType, subject, messageId, viewingRequestId } });
    return { success: false, error: error.message };
  }
}

module.exports = {
  logEmailActivity
};
