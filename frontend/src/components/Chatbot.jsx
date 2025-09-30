import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './Chatbot.module.css';

const Chatbot = () => {
  const [messages, setMessages] = useState([]); // { sender: 'user'|'bot', text }
  const [userMessage, setUserMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  const toggleChatbot = () => {
    setIsOpen((s) => !s);
  };

  // auto-scroll when messages change
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 50);
    }
  }, [isOpen]);

  const safePush = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleSendMessage = async () => {
    const trimmed = userMessage.trim();
    if (!trimmed) return;

    // push user message locally
    const userMsgObj = { sender: 'user', text: userMessage };
    safePush(userMsgObj);
    setUserMessage('');
    setLoading(true);

    try {
      // NOTE: keep base URL in env in production
      const response = await axios.post(
        'https://universalparts.onrender.com/api/chatbot',
        { message: trimmed },
        { timeout: 15000 }
      );

      const botText =
        response?.data?.response ??
        response?.data?.message ??
        JSON.stringify(response?.data) ??
        'No response from server';

      safePush({ sender: 'bot', text: String(botText) });
    } catch (error) {
      console.error('Chatbot request error:', error);
      const errText =
        error?.response?.data?.error ||
        error?.message ||
        'Sorry, something went wrong.';

      safePush({ sender: 'bot', text: `Error: ${errText}` });
    } finally {
      setLoading(false);
    }
  };

  // handle Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) handleSendMessage();
    }
  };

  return (
    <div className={styles.chatbotContainer}>
      <button
        className={styles.chatbotToggle}
        onClick={toggleChatbot}
        aria-expanded={isOpen}
        aria-controls="chat-window"
      >
        Chat
      </button>

      {isOpen && (
        <div className={styles.chatWindow} id="chat-window" role="region" aria-label="Chat window">
          <div className={styles.chatHeader} style={{ display: 'none' }}>
            {/* Optional header - hidden for now */}
            Assistant
          </div>

          <div className={styles.chatMessages} ref={messagesRef}>
            {messages.length === 0 && (
              <div className={styles.meta} style={{ padding: 12 }}>
                Hi — ask me anything. Press Enter to send, Shift+Enter for a new line.
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`${styles.message} ${msg.sender === 'user' ? styles.user : styles.bot}`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className={styles.inputArea}>
            <input
              ref={inputRef}
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? 'Waiting for reply...' : 'Type your message...'}
              disabled={loading}
            />
            <button onClick={handleSendMessage} disabled={loading}>
              {loading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
