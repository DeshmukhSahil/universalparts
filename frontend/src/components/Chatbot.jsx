import React, { useState } from 'react';
import axios from 'axios';
import styles from './Chatbot.module.css';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // const apiBaseURL = process.env.REACT_APP_API_BASE_URL;

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async () => {
    if (userMessage.trim() === '') return;

    const newMessages = [...messages, { sender: 'user', text: userMessage }];
    setMessages(newMessages);
    setUserMessage('');

    try {
      const response = await axios.post(`http://localhost:5000/api/chatbot`, { message: userMessage });
      setMessages([...newMessages, { sender: 'bot', text: response.data.response }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages([...newMessages, { sender: 'bot', text: 'Sorry, something went wrong.' }]);
    }
  };

  return (
    <div className={styles.chatbotContainer}>
      <button className={styles.chatbotToggle} onClick={toggleChatbot}>
        Chat
      </button>
      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatMessages}>
            {messages.map((msg, index) => (
              <div key={index} className={`${styles.message} ${styles[msg.sender]}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className={styles.inputArea}>
            <input
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
