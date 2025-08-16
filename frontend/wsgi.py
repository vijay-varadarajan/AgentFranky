#!/usr/bin/env python3
"""
WSGI entry point for production deployment
"""
import os
import sys

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from api_server import app, socketio

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=port, 
        debug=False,
        allow_unsafe_werkzeug=True
    )
