// routes/chatbot.js
const express = require('express');
const fs = require('fs');
const router = express.Router();

const logUnresolvedRequest = (message) => {
  const logMessage = `Unresolved request: ${message}\nTimestamp: ${new Date().toISOString()}\n\n`;
  fs.appendFile('unresolved_requests.log', logMessage, (err) => {
    if (err) console.error('Error logging request:', err);
  });
};

router.post('/', (req, res) => {
  try {
    const raw = req.body && req.body.message ? String(req.body.message) : '';
    const userMessage = raw.toLowerCase().trim();

    if (!userMessage) {
      return res.status(400).json({ error: 'message is required' });
    }

    let botResponse = '';

    if (userMessage.includes('hello') || userMessage.includes('hi')) {
      botResponse = 'Hello! Welcome to our GSM Guide. How can I assist you today?';
    } else if (userMessage.includes('parts') || userMessage.includes('resources')) {
      botResponse = 'I can assist you with parts compatibility! Please specify the subject or topic you need help with.';
    } else if (userMessage.includes('mobile parts')) {
      botResponse = 'Search for the parts in the search area to know about compatible groups';
    } else if (userMessage.includes('help') || userMessage.includes('how to')) {
      botResponse = 'I can help you with various tasks like accessing parts compatibility, managing your profile, etc What do you need help with?';
    } else {
      botResponse = 'I’m not sure I understand. Please contact support at whatsapp number  for further assistance.';
      logUnresolvedRequest(userMessage);
    }

    return res.json({ response: botResponse });
  } catch (err) {
    console.error('chatbot handler error', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
