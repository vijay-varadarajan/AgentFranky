#!/usr/bin/env python3
"""
Flask API server for the Research Assistant frontend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import sys
import os
import uuid
import asyncio
from threading import Thread

# Add the src directory to the path so we can import the research assistant
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from research_assistant import graph, graph_no_interrupt, set_status_callback
from schema import ResearchGraphState

app = Flask(__name__)

# Initialize SocketIO with CORS support
if os.environ.get('FLASK_ENV') == 'production':
    # In production, allow your Vercel domain and any HTTPS origins
    socketio = SocketIO(app, 
                       cors_allowed_origins=[
                           "https://research-agent-v0.vercel.app",
                           "https://agentfranky.vercel.app", 
                           "https://*.vercel.app"
                       ],
                       logger=True,
                       engineio_logger=True,
                       ping_timeout=60,
                       ping_interval=25)
else:
    # In development, allow all origins
    socketio = SocketIO(app, 
                       cors_allowed_origins="*",
                       logger=True,
                       engineio_logger=True,
                       ping_timeout=60,
                       ping_interval=25)

# Configure CORS for HTTP requests
if os.environ.get('FLASK_ENV') == 'production':
    # In production, only allow your Vercel domain
    CORS(app, origins=[
        "https://research-agent-v0.vercel.app/",  # Replace with your actual Vercel URL
        "https://agentfranky.vercel.app",
        "https://*.vercel.app"  # Allow all Vercel preview deployments
    ])
else:
    # In development, allow all origins
    CORS(app)

# Store active sessions
sessions = {}

# WebSocket status update function
def send_status_update(message: str, status: dict):
    """Send status update via WebSocket to all connected clients"""
    try:
        # Add session_id to status if we have an active session
        current_session_id = getattr(send_status_update, 'current_session_id', None)
        if current_session_id:
            status['session_id'] = current_session_id
        
        print(f"📡 Broadcasting status update: {message}")
        socketio.emit('status_update', status)
    except Exception as e:
        print(f"Error sending status update: {e}")

# Set the callback for the research assistant
set_status_callback(send_status_update)

class ResearchSession:
    def __init__(self, session_id, topic, max_analysts=3):
        self.id = session_id
        self.topic = topic
        self.max_analysts = max_analysts
        self.state = 'creating_analysts'
        self.analysts = None
        self.graph_state = None
        self.final_report = None

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    print(f"🔌 Client connected: {request.sid}")
    emit('connected', {'status': 'Connected to Research Assistant API'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f"🔌 Client disconnected: {request.sid}")

@socketio.on('join_session')
def handle_join_session(data):
    session_id = data.get('session_id')
    if session_id in sessions:
        emit('session_joined', {'session_id': session_id, 'status': 'success'})
        print(f"📱 Client {request.sid} joined session {session_id}")
    else:
        emit('session_joined', {'session_id': session_id, 'status': 'error', 'message': 'Session not found'})

@app.route('/api/research/start', methods=['POST'])
def start_research():
    """Start a new research session"""
    try:
        data = request.get_json()
        topic = data.get('topic', '').strip()
        max_analysts = data.get('max_analysts', 3)
        
        if not topic:
            return jsonify({'error': 'Topic is required'}), 400
        
        # Create new session
        session_id = str(uuid.uuid4())
        session = ResearchSession(session_id, topic, max_analysts)
        
        # Set current session for status updates
        send_status_update.current_session_id = session_id
        
        # Emit session started event
        socketio.emit('session_started', {
            'session_id': session_id,
            'topic': topic,
            'max_analysts': max_analysts
        })
        
        # Create initial state and run graph until human feedback
        initial_state = {
            'topic': topic,
            'max_analysts': max_analysts,
            'human_analyst_feedback': ''
        }
        
        # Run the graph until human feedback is needed
        result = graph.invoke(initial_state, {"recursion_limit": 10})
        
        # Store session data
        session.analysts = result.get('analysts', [])
        session.graph_state = result
        session.state = 'awaiting_approval'
        sessions[session_id] = session
        
        # Convert analysts to dict format for JSON response
        analysts_data = []
        for analyst in session.analysts:
            analysts_data.append({
                'name': analyst.name,
                'role': analyst.role,
                'affiliation': analyst.affiliation,
                'description': analyst.description
            })
        
        return jsonify({
            'session_id': session_id,
            'topic': topic,
            'analysts': analysts_data,
            'status': 'awaiting_approval'
        })
        
    except Exception as e:
        print(f"Error starting research: {e}")
        # Clear session id on error
        send_status_update.current_session_id = None
        socketio.emit('error', {'message': str(e), 'session_id': session_id if 'session_id' in locals() else None})
        return jsonify({'error': str(e)}), 500

@app.route('/api/research/approve', methods=['POST'])
def approve_research():
    """Approve the analysts and start the full research"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id or session_id not in sessions:
            return jsonify({'error': 'Invalid session ID'}), 400
        
        session = sessions[session_id]
        
        if session.state != 'awaiting_approval':
            return jsonify({'error': 'Session not in approval state'}), 400
        
        # Set current session for status updates
        send_status_update.current_session_id = session_id
        
        # Emit research started event
        socketio.emit('research_approved', {
            'session_id': session_id,
            'message': 'Research approved, starting full analysis...'
        })
        
        # Use the no-interrupt graph with approved analysts
        research_state = {
            'topic': session.topic,
            'max_analysts': len(session.analysts),
            'analysts': session.analysts,
            'human_analyst_feedback': 'approve'
        }
        
        # Run the complete research process
        final_result = graph_no_interrupt.invoke(research_state, {"recursion_limit": 100})
        
        session.final_report = final_result.get('final_report', 'No report generated')
        session.state = 'completed'
        
        # Clear session id after completion
        send_status_update.current_session_id = None
        
        # Emit completion event
        socketio.emit('research_completed', {
            'session_id': session_id,
            'final_report': session.final_report,
            'message': 'Research completed successfully!'
        })
        
        return jsonify({
            'session_id': session_id,
            'final_report': session.final_report,
            'status': 'completed'
        })
        
    except Exception as e:
        print(f"Error approving research: {e}")
        # Clear session id on error
        send_status_update.current_session_id = None
        socketio.emit('error', {'message': str(e), 'session_id': session_id if 'session_id' in locals() else None})
        return jsonify({'error': str(e)}), 500

@app.route('/api/research/modify', methods=['POST'])
def modify_analysts():
    """Modify the analyst team based on feedback"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        feedback = data.get('feedback', '').strip()
        
        if not session_id or session_id not in sessions:
            return jsonify({'error': 'Invalid session ID'}), 400
            
        if not feedback:
            return jsonify({'error': 'Feedback is required'}), 400
        
        session = sessions[session_id]
        
        if session.state != 'awaiting_approval':
            return jsonify({'error': 'Session not in approval state'}), 400
        
        # Set current session for status updates
        send_status_update.current_session_id = session_id
        
        # Emit modification started event
        socketio.emit('analysts_modification_started', {
            'session_id': session_id,
            'feedback': feedback,
            'message': 'Modifying analyst team based on feedback...'
        })
        
        # Update state with feedback and regenerate analysts
        current_state = session.graph_state
        current_state['human_analyst_feedback'] = feedback
        
        # Run graph to regenerate analysts
        result = graph.invoke(current_state, {"recursion_limit": 10})
        
        # Update session
        session.analysts = result.get('analysts', [])
        session.graph_state = result
        
        # Clear session id after modification
        send_status_update.current_session_id = None
        
        # Convert analysts to dict format for JSON response
        analysts_data = []
        for analyst in session.analysts:
            analysts_data.append({
                'name': analyst.name,
                'role': analyst.role,
                'affiliation': analyst.affiliation,
                'description': analyst.description
            })
        
        # Emit modification completed event
        socketio.emit('analysts_modified', {
            'session_id': session_id,
            'analysts': analysts_data,
            'message': 'Analyst team updated successfully!'
        })
        
        return jsonify({
            'session_id': session_id,
            'analysts': analysts_data,
            'status': 'awaiting_approval'
        })
        
    except Exception as e:
        print(f"Error modifying analysts: {e}")
        # Clear session id on error
        send_status_update.current_session_id = None
        socketio.emit('error', {'message': str(e), 'session_id': session_id if 'session_id' in locals() else None})
        return jsonify({'error': str(e)}), 500

@app.route('/api/test-websocket', methods=['POST'])
def test_websocket():
    """Test WebSocket functionality"""
    try:
        # Send a test status update
        test_status = {
            'step': 'TEST_WEBSOCKET',
            'step_number': 0,
            'message': 'Testing WebSocket connection...',
            'type': 'test'
        }
        
        socketio.emit('status_update', test_status)
        
        return jsonify({'status': 'success', 'message': 'Test WebSocket message sent'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy', 
        'message': 'Research Assistant API is running',
        'websocket_enabled': True,
        'port': os.environ.get('PORT', 5000)
    })

@app.route('/api/websocket-test', methods=['GET'])
def websocket_test():
    """WebSocket connectivity test endpoint"""
    try:
        # Test if SocketIO is properly initialized
        socketio.emit('test', {'message': 'WebSocket test'})
        return jsonify({
            'status': 'success',
            'message': 'WebSocket is properly configured',
            'endpoint': '/socket.io/'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'WebSocket error: {str(e)}'
        }), 500

@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    """List all active sessions (for debugging)"""
    session_list = []
    for session_id, session in sessions.items():
        session_list.append({
            'id': session_id,
            'topic': session.topic,
            'state': session.state,
            'analysts_count': len(session.analysts) if session.analysts else 0
        })
    return jsonify({'sessions': session_list})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("🔬 Research Assistant API Server")
    print("=" * 40)
    
    # Get port from environment variable (for Render) or default to 5000
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    
    if debug_mode:
        print(f"Starting API server on http://localhost:{port}")
        print("Frontend should be accessible on http://localhost:3000")
        print(f"Health check: http://localhost:{port}/api/health")
        print(f"WebSocket connection: ws://localhost:{port}")
    else:
        print(f"Starting production API server on port {port}")
        print("Production mode - WebSocket support enabled")
    
    print("=" * 40)
    
    # Use socketio.run instead of app.run for WebSocket support
    # In production, allow unsafe werkzeug since we're using it for simplicity
    socketio.run(
        app, 
        debug=debug_mode, 
        port=port, 
        host='0.0.0.0',
        allow_unsafe_werkzeug=True  # Allow in production for simplicity
    )
