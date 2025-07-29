const express = require('express');
const router = express.Router();

// Dummy conversations and messages for demonstration
const conversations = [
  { id: 'c1', participants: ['applicant1', 'landlord1'], name: 'Landlord Max' },
  { id: 'c2', participants: ['applicant1', 'landlord2'], name: 'Landlord Anna' }
];

const messagesData = {
  c1: [
    { sender: 'applicant1', message: 'Hello Max!', timestamp: Date.now() - 60000 },
    { sender: 'landlord1', message: 'Hi there!', timestamp: Date.now() - 30000 }
  ],
  c2: [
    { sender: 'applicant1', message: 'Hello Anna!', timestamp: Date.now() - 50000 },
    { sender: 'landlord2', message: 'Welcome!', timestamp: Date.now() - 20000 }
  ]
};

// GET /api/conversations/:userId - Get all conversations for a user
router.get('/conversations/:userId', (req, res) => {
  const userId = req.params.userId;
  const userConversations = conversations.filter(convo =>
    convo.participants.includes(userId)
  );
  res.json(userConversations);
});

// GET /api/messages/:conversationId - Get messages for a conversation
router.get('/messages/:conversationId', (req, res) => {
  const conversationId = req.params.conversationId;
  const messages = messagesData[conversationId] || [];
  res.json(messages);
});

// POST /api/send-message - Send a message in a conversation
router.post('/send-message', express.json(), (req, res) => {
  const { conversationId, sender, message } = req.body;
  if (!conversationId || !sender || !message) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }
  if (!messagesData[conversationId]) {
    messagesData[conversationId] = [];
  }
  const msgObj = { sender, message, timestamp: Date.now() };
  messagesData[conversationId].push(msgObj);
  res.json({ success: true, conversationId, sender, message });
});

module.exports = router;