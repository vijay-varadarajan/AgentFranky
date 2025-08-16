import React from 'react';
import { Loader, CheckCircle, Clock } from 'lucide-react';

const MessageStatusIndicator = ({ message, isConnected }) => {
  if (!message.isLoading && !message.currentStep) {
    return null;
  }

  return (
    <div className="message-status-indicator">
      {message.isLoading && (
        <div className="status-content">
          <div className="status-header">
            <div className="status-icon">
              <Loader className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
            <div className="status-text">
              <span className="status-step">{message.currentStep || 'Processing...'}</span>
              <div className="connection-indicator">
                <div className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                <span className="connection-text">
                  {isConnected ? 'Live Updates' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageStatusIndicator;
