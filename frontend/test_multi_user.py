#!/usr/bin/env python3
"""
Test script to simulate multiple users and verify session isolation
"""
import socketio
import requests
import time
import threading
import json
from concurrent.futures import ThreadPoolExecutor

# Test configuration
BASE_URL = "http://localhost:5000"
SOCKET_URL = "http://localhost:5000"

def test_user_session(user_id, topic):
    """Simulate a user session"""
    print(f"🧪 User {user_id} starting test with topic: {topic}")
    
    # Create socket connection
    sio = socketio.Client()
    session_id = None
    received_updates = []
    
    @sio.event
    def connect():
        print(f"User {user_id}: Connected to WebSocket")
        
    @sio.event
    def disconnect():
        print(f"User {user_id}: Disconnected from WebSocket")
    
    @sio.on('status_update')
    def on_status_update(data):
        received_updates.append(data)
        print(f"User {user_id}: Received update - {data.get('message', 'No message')[:50]}...")
        
    @sio.on('session_started')
    def on_session_started(data):
        nonlocal session_id
        session_id = data.get('session_id')
        print(f"User {user_id}: Session started with ID: {session_id}")
    
    try:
        # Connect to WebSocket
        sio.connect(SOCKET_URL)
        time.sleep(1)
        
        # Send research request
        response = requests.post(f"{BASE_URL}/research", json={
            "topic": topic,
            "analysts": [
                {"role": "Research Analyst", "goal": f"Research {topic}", "backstory": "Expert researcher"}
            ]
        })
        
        if response.status_code == 200:
            print(f"User {user_id}: Research request sent successfully")
            
            # Wait for some updates
            time.sleep(10)
            
            print(f"User {user_id}: Received {len(received_updates)} updates")
            
            # Check if all updates belong to this session
            wrong_session_updates = [
                update for update in received_updates 
                if update.get('session_id') and update.get('session_id') != session_id
            ]
            
            if wrong_session_updates:
                print(f"❌ User {user_id}: Received {len(wrong_session_updates)} updates from other sessions!")
                for update in wrong_session_updates[:3]:  # Show first 3
                    print(f"   Wrong session: {update.get('session_id')} (expected: {session_id})")
            else:
                print(f"✅ User {user_id}: All updates belong to correct session")
                
        else:
            print(f"❌ User {user_id}: Research request failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ User {user_id}: Error - {e}")
    finally:
        sio.disconnect()
        
    return {
        'user_id': user_id,
        'session_id': session_id,
        'updates_received': len(received_updates),
        'wrong_session_updates': len([u for u in received_updates if u.get('session_id') and u.get('session_id') != session_id])
    }

def main():
    """Run multi-user test"""
    print("🚀 Starting multi-user session isolation test...")
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print("❌ Server not responding. Please start the backend first.")
            return
    except:
        print("❌ Cannot connect to server. Please start the backend first.")
        return
    
    # Test scenarios
    test_scenarios = [
        ("Alice", "Artificial Intelligence trends 2024"),
        ("Bob", "Climate change impact on agriculture"),
        ("Charlie", "Quantum computing applications")
    ]
    
    # Run tests concurrently
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(test_user_session, user_id, topic) 
            for user_id, topic in test_scenarios
        ]
        
        results = [future.result() for future in futures]
    
    # Analyze results
    print("\n📊 Test Results:")
    print("-" * 50)
    
    total_wrong_updates = 0
    for result in results:
        user_id = result['user_id']
        updates = result['updates_received']
        wrong_updates = result['wrong_session_updates']
        total_wrong_updates += wrong_updates
        
        status = "✅ PASS" if wrong_updates == 0 else "❌ FAIL"
        print(f"{status} User {user_id}: {updates} updates, {wrong_updates} wrong session")
    
    print("-" * 50)
    if total_wrong_updates == 0:
        print("🎉 SUCCESS: Session isolation is working correctly!")
    else:
        print(f"❌ FAILURE: {total_wrong_updates} cross-session updates detected")

if __name__ == "__main__":
    main()
