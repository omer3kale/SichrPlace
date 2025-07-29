const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Anonymous messages allowed (e.g., contact form)
  },
  name: {
    type: String,
    maxlength: 64
  },
  email: {
    type: String,
    maxlength: 128
  },
  subject: {
    type: String,
    maxlength: 128
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  isRead: {
    type: Boolean,
    default: false
  },
  adminReply: {
    type: String,
    maxlength: 2000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  repliedAt: {
    type: Date
  }
});

// Prevent OverwriteModelError in tests and hot reloads
module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);