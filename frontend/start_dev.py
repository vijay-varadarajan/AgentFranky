#!/usr/bin/env python3
"""
Development starter script for the Research Assistant Frontend
"""

import subprocess
import sys
import os
import time
import threading

def run_backend():
    """Run the Flask backend server"""
    print("🚀 Starting Backend API Server...")
    try:
        subprocess.run([sys.executable, "api_server.py"], check=True)
    except KeyboardInterrupt:
        print("\n📡 Backend server stopped")
    except Exception as e:
        print(f"❌ Backend error: {e}")

def run_frontend():
    """Run the React frontend"""
    print("🚀 Starting React Frontend...")
    time.sleep(2)  # Give backend time to start
    try:
        subprocess.run(["npm", "start"], check=True)
    except KeyboardInterrupt:
        print("\n🌐 Frontend stopped")
    except Exception as e:
        print(f"❌ Frontend error: {e}")

def main():
    print("🔬 AI Research Assistant - Development Mode")
    print("=" * 50)
    print("Starting both backend and frontend servers...")
    print("=" * 50)
    
    # Start backend in a separate thread
    backend_thread = threading.Thread(target=run_backend, daemon=True)
    backend_thread.start()
    
    # Start frontend in main thread
    try:
        run_frontend()
    except KeyboardInterrupt:
        print("\n👋 Shutting down development servers...")
        sys.exit(0)

if __name__ == "__main__":
    main()
