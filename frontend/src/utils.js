// utils.js - Utility functions for the frontend

export const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const validateTopic = (topic) => {
  if (!topic || topic.trim().length < 3) {
    return 'Topic must be at least 3 characters long';
  }
  if (topic.trim().length > 200) {
    return 'Topic must be less than 200 characters';
  }
  return null;
};

export const getTopicSuggestions = () => {
  return [
    'Artificial Intelligence in Healthcare',
    'Climate Change Mitigation Strategies',
    'Future of Renewable Energy',
    'Quantum Computing Applications',
    'Space Exploration Technologies',
    'Blockchain in Supply Chain',
    'Gene Therapy Advancements',
    'Sustainable Agriculture Practices',
    'Virtual Reality in Education',
    'Cybersecurity in IoT Devices'
  ];
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
