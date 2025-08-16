import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import API_BASE_URL from '../config';

const useWebSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);

  useEffect(() => {
    // Create WebSocket connection - use the same base URL as the API
    console.log('🔌 Connecting to WebSocket:', API_BASE_URL);
    
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      forceNew: true
    });

    // Connection event handlers
    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connected', (data) => {
      console.log('📡 Server confirmed connection:', data);
    });

    // Status update handlers
    socketRef.current.on('status_update', (status) => {
      console.log('📊 Status update received:', status);
      setCurrentStatus(status);
      setStatusUpdates(prev => [...prev, {
        ...status,
        timestamp: new Date(),
        id: Date.now()
      }]);
    });

    // Session event handlers
    socketRef.current.on('session_started', (data) => {
      console.log('🎬 Session started:', data);
      setStatusUpdates(prev => [...prev, {
        step: 'SESSION_STARTED',
        message: `Research session started for: "${data.topic}"`,
        session_id: data.session_id,
        timestamp: new Date(),
        id: Date.now(),
        type: 'session'
      }]);
    });

    socketRef.current.on('research_approved', (data) => {
      console.log('✅ Research approved:', data);
      setStatusUpdates(prev => [...prev, {
        step: 'RESEARCH_APPROVED',
        message: data.message,
        session_id: data.session_id,
        timestamp: new Date(),
        id: Date.now(),
        type: 'approval'
      }]);
    });

    socketRef.current.on('research_completed', (data) => {
      console.log('🎉 Research completed:', data);
      setStatusUpdates(prev => [...prev, {
        step: 'RESEARCH_COMPLETED',
        message: data.message,
        session_id: data.session_id,
        final_report: data.final_report, // Include the final report
        timestamp: new Date(),
        id: Date.now(),
        type: 'completion'
      }]);
    });

    socketRef.current.on('analysts_modification_started', (data) => {
      console.log('🔄 Analyst modification started:', data);
      setStatusUpdates(prev => [...prev, {
        step: 'MODIFICATION_STARTED',
        message: data.message,
        session_id: data.session_id,
        timestamp: new Date(),
        id: Date.now(),
        type: 'modification'
      }]);
    });

    socketRef.current.on('analysts_modified', (data) => {
      console.log('✏️ Analysts modified:', data);
      setStatusUpdates(prev => [...prev, {
        step: 'ANALYSTS_MODIFIED',
        message: data.message,
        session_id: data.session_id,
        timestamp: new Date(),
        id: Date.now(),
        type: 'modification'
      }]);
    });

    socketRef.current.on('error', (data) => {
      console.error('❌ WebSocket error:', data);
      setStatusUpdates(prev => [...prev, {
        step: 'ERROR',
        message: `Error: ${data.message}`,
        session_id: data.session_id,
        timestamp: new Date(),
        id: Date.now(),
        type: 'error'
      }]);
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
