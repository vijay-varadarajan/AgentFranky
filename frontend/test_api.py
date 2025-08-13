#!/usr/bin/env python3
"""
Test script for the Research Assistant API
"""

import requests
import json
import time

API_BASE_URL = "http://localhost:5000/api"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_research_flow():
    """Test the complete research flow"""
    print("\n🔍 Testing research flow...")
    
    # Step 1: Start research
    print("1. Starting research...")
    try:
        start_payload = {
            "topic": "Machine Learning in Drug Discovery",
            "max_analysts": 2
        }
        response = requests.post(f"{API_BASE_URL}/research/start", json=start_payload)
        
        if response.status_code != 200:
            print(f"❌ Start research failed: {response.status_code}")
            print(response.text)
            return False
        
        data = response.json()
        session_id = data.get('session_id')
        analysts = data.get('analysts', [])
        
        print(f"✅ Research started. Session ID: {session_id}")
        print(f"📊 Created {len(analysts)} analysts")
        
        # Step 2: Approve research
        print("2. Approving research...")
        approve_payload = {
            "session_id": session_id
        }
        
        # Note: This will take a while as it actually runs the research
        print("⏳ Running full research (this may take 2-3 minutes)...")
        response = requests.post(f"{API_BASE_URL}/research/approve", json=approve_payload, timeout=300)
        
        if response.status_code != 200:
            print(f"❌ Approve research failed: {response.status_code}")
            print(response.text)
            return False
        
        data = response.json()
        final_report = data.get('final_report', '')
        
        print("✅ Research completed successfully")
        print(f"📋 Report length: {len(final_report)} characters")
        print(f"📋 Report preview: {final_report[:200]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Research flow error: {e}")
        return False

def main():
    print("🔬 AI Research Assistant API Test")
    print("=" * 40)
    
    # Test health check
    if not test_health_check():
        print("\n❌ API server is not running or not responding")
        print("Please start the API server with: python api_server.py")
        return
    
    # Ask user if they want to run the full test
    print("\n⚠️  Full research test will take 2-3 minutes and use API credits.")
    user_input = input("Do you want to run the full research test? (y/N): ").strip().lower()
    
    if user_input in ['y', 'yes']:
        if test_research_flow():
            print("\n🎉 All tests passed!")
        else:
            print("\n❌ Some tests failed")
    else:
        print("\n✅ Basic health check completed. Skipping full research test.")

if __name__ == "__main__":
    main()
