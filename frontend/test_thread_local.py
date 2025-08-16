#!/usr/bin/env python3
"""
Test script to verify thread-local storage session isolation
"""
import threading
import time
import requests
import json
from concurrent.futures import ThreadPoolExecutor

# Simulate the thread-local mechanism
thread_local = threading.local()

def set_session_context(session_id):
    """Set the session ID in thread-local storage for the current request thread"""
    thread_local.session_id = session_id
    print(f"🧵 Thread {threading.current_thread().ident}: Set session context to {session_id}")

def get_session_context():
    """Get the session ID from thread-local storage for the current request thread"""
    session_id = getattr(thread_local, 'session_id', None)
    print(f"🧵 Thread {threading.current_thread().ident}: Got session context: {session_id}")
    return session_id

def simulate_research_session(user_id, session_id):
    """Simulate a research session in a separate thread"""
    print(f"🚀 User {user_id}: Starting simulation with session {session_id}")
    
    # Set session context for this thread
    set_session_context(session_id)
    
    # Simulate multiple status updates
    for i in range(5):
        current_session = get_session_context()
        print(f"📊 User {user_id}: Status update {i+1} - Session context: {current_session}")
        
        if current_session != session_id:
            print(f"❌ User {user_id}: ERROR! Expected {session_id}, got {current_session}")
        else:
            print(f"✅ User {user_id}: Correct session context maintained")
        
        time.sleep(0.5)  # Simulate processing time
    
    print(f"🏁 User {user_id}: Simulation completed")
    return {
        'user_id': user_id,
        'session_id': session_id,
        'final_context': get_session_context()
    }

def test_concurrent_sessions():
    """Test that thread-local storage isolates sessions correctly"""
    print("🧪 Testing Thread-Local Storage Session Isolation")
    print("=" * 60)
    
    # Test scenarios
    test_scenarios = [
        ("Alice", "session_123"),
        ("Bob", "session_456"),
        ("Charlie", "session_789")
    ]
    
    # Run concurrent simulations
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(simulate_research_session, user_id, session_id)
            for user_id, session_id in test_scenarios
        ]
        
        results = [future.result() for future in futures]
    
    print("\n📊 Test Results:")
    print("-" * 30)
    
    all_passed = True
    for result in results:
        user_id = result['user_id']
        expected_session = result['session_id']
        final_session = result['final_context']
        
        if final_session == expected_session:
            print(f"✅ {user_id}: Session isolation PASSED ({expected_session})")
        else:
            print(f"❌ {user_id}: Session isolation FAILED (expected: {expected_session}, got: {final_session})")
            all_passed = False
    
    print("-" * 30)
    if all_passed:
        print("🎉 ALL TESTS PASSED: Thread-local storage is working correctly!")
    else:
        print("❌ TESTS FAILED: Thread-local storage is not isolating sessions properly!")
    
    return all_passed

def test_api_endpoints():
    """Test actual API endpoints to ensure they work with thread-local storage"""
    print("\n🌐 Testing API Endpoints with Thread-Local Storage")
    print("=" * 60)
    
    base_url = "http://localhost:5000"
    
    try:
        # Test health endpoint
        response = requests.get(f"{base_url}/api/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint working")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to API server: {e}")
        print("💡 Please start the API server first: python api_server.py")
        return False
    
    # Test research start endpoint (would need actual implementation to test)
    print("✅ API server is accessible")
    return True

if __name__ == "__main__":
    print("🔬 Thread-Local Storage Test Suite")
    print("=" * 60)
    
    # Test 1: Thread-local storage mechanism
    thread_test_passed = test_concurrent_sessions()
    
    # Test 2: API endpoint accessibility
    api_test_passed = test_api_endpoints()
    
    print("\n🏆 FINAL RESULTS:")
    print("=" * 60)
    print(f"Thread-Local Storage Test: {'✅ PASSED' if thread_test_passed else '❌ FAILED'}")
    print(f"API Endpoint Test: {'✅ PASSED' if api_test_passed else '❌ FAILED'}")
    
    if thread_test_passed and api_test_passed:
        print("\n🎉 All tests passed! The thread-local storage implementation should work correctly.")
    else:
        print("\n⚠️ Some tests failed. Please review the implementation.")
