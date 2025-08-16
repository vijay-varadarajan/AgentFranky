import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import API_BASE_URL from '../config';

const useWebSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  useEffect(() => {
    // Create WebSocket connection - use the same base URL as the API
    console.log('🔌 Connecting to WebSocket:', API_BASE_URL);
    
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      forceNew: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 10
    });

    // Connection event handlers
    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socketRef.current.on('reconnect_error', (error) => {
      console.error('❌ WebSocket reconnection error:', error);
    });

    socketRef.current.on('session_joined', (data) => {
      console.log('📱 Session joined:', data);
      if (data.status === 'success') {
        setCurrentSessionId(data.session_id);
      }
    });

    socketRef.current.on('session_left', (data) => {
      console.log('� Session left:', data);
      if (data.status === 'success') {
        setCurrentSessionId(null);
      }
    });

    socketRef.current.on('session_status', (data) => {
      console.log('📊 Session status:', data);
    });

    socketRef.current.on('connected', (data) => {
      console.log('📡 Server confirmed connection:', data);
    });

    // Status update handlers - only process if from current session
    socketRef.current.on('status_update', (status) => {
      console.log('📊 Status update received:', status);
      // Only process status updates for the current session
      if (!currentSessionId || status.session_id === currentSessionId) {
        setCurrentStatus(status);
        setStatusUpdates(prev => [...prev, {
          ...status,
          timestamp: new Date(),
          id: Date.now()
        }]);
      } else {
        console.log('🚫 Ignoring status update for different session:', status.session_id);
      }
    });

    // Session event handlers - only process if from current session
    socketRef.current.on('session_started', (data) => {
      console.log('🎬 Session started:', data);
      if (!currentSessionId || data.session_id === currentSessionId) {
        setStatusUpdates(prev => [...prev, {
          step: 'SESSION_STARTED',
          message: `Research session started for: "${data.topic}"`,
          session_id: data.session_id,
          timestamp: new Date(),
          id: Date.now(),
          type: 'session'
        }]);
      }
    });

    socketRef.current.on('research_approved', (data) => {
      console.log('✅ Research approved:', data);
      if (!currentSessionId || data.session_id === currentSessionId) {
        setStatusUpdates(prev => [...prev, {
          step: 'RESEARCH_APPROVED',
          message: data.message,
          session_id: data.session_id,
          timestamp: new Date(),
          id: Date.now(),
          type: 'approval'
        }]);
      }
    });

    socketRef.current.on('research_completed', (data) => {
      console.log('🎉 Research completed:', data);
      if (!currentSessionId || data.session_id === currentSessionId) {
        setStatusUpdates(prev => [...prev, {
          step: 'RESEARCH_COMPLETED',
          message: data.message,
          session_id: data.session_id,
          final_report: data.final_report, // Include the final report
          timestamp: new Date(),
          id: Date.now(),
          type: 'completion'
        }]);
      }
    });

    socketRef.current.on('analysts_modification_started', (data) => {
      console.log('🔄 Analyst modification started:', data);
      if (!currentSessionId || data.session_id === currentSessionId) {
        setStatusUpdates(prev => [...prev, {
          step: 'MODIFICATION_STARTED',
          message: data.message,
          session_id: data.session_id,
          timestamp: new Date(),
          id: Date.now(),
          type: 'modification'
        }]);
      }
    });

    socketRef.current.on('analysts_modified', (data) => {
      console.log('✏️ Analysts modified:', data);
      if (!currentSessionId || data.session_id === currentSessionId) {
        setStatusUpdates(prev => [...prev, {
          step: 'ANALYSTS_MODIFIED',
          message: data.message,
          session_id: data.session_id,
          timestamp: new Date(),
          id: Date.now(),
          type: 'modification'
        }]);
      }
    });

    socketRef.current.on('error', (data) => {
      console.error('❌ WebSocket error:', data);
      if (!currentSessionId || data.session_id === currentSessionId) {
        setStatusUpdates(prev => [...prev, {
          step: 'ERROR',
          message: `Error: ${data.message}`,
          session_id: data.session_id,
          timestamp: new Date(),
          id: Date.now(),
          type: 'error'
        }]);
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const joinSession = (sessionId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join_session', { session_id: sessionId });
    }
  };

  const clearStatusUpdates = () => {
    setStatusUpdates([]);
    setCurrentStatus(null);
  };

  return {
    isConnected,
    statusUpdates,
    currentStatus,
    joinSession,
    clearStatusUpdates
  };
};

export default useWebSocket;
