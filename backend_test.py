#!/usr/bin/env python3
"""
Backend API Testing Script for Indoor Wayfinding System
Tests the Spring Boot Indoor Wayfinding API endpoints
"""

import requests
import json
import sys
import os
from typing import Dict, Any, List

# Get the backend URL from environment
BACKEND_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://beaconway.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing Health Check: GET /api/")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "status" in data and data.get("status") == "healthy":
                print("   ✅ Health check passed")
                return True
            else:
                print("   ❌ Health check failed - unexpected response format")
                return False
        else:
            print("   ❌ Health check failed - non-200 status")
            return False
    except Exception as e:
        print(f"   ❌ Health check failed - Exception: {e}")
        return False

def test_buildings():
    """Test the buildings endpoint"""
    print("\n🔍 Testing Buildings: GET /api/buildings")
    try:
        response = requests.get(f"{API_BASE}/buildings", timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"   ✅ Buildings endpoint working - returned {len(data)} buildings")
                return True, data
            else:
                print("   ❌ Buildings endpoint failed - not a list")
                return False, None
        else:
            print("   ❌ Buildings endpoint failed - non-200 status")
            return False, None
    except Exception as e:
        print(f"   ❌ Buildings endpoint failed - Exception: {e}")
        return False, None

def test_floors():
    """Test the floors endpoint"""
    print("\n🔍 Testing Floors: GET /api/floors")
    try:
        response = requests.get(f"{API_BASE}/floors", timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"   ✅ Floors endpoint working - returned {len(data)} floors")
                return True, data
            else:
                print("   ❌ Floors endpoint failed - not a list")
                return False, None
        else:
            print("   ❌ Floors endpoint failed - non-200 status")
            return False, None
    except Exception as e:
        print(f"   ❌ Floors endpoint failed - Exception: {e}")
        return False, None

def test_beacons():
    """Test the beacons endpoint"""
    print("\n🔍 Testing Beacons: GET /api/beacons")
    try:
        response = requests.get(f"{API_BASE}/beacons", timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"   ✅ Beacons endpoint working - returned {len(data)} beacons")
                # Check beacon structure
                if data and len(data) > 0:
                    beacon = data[0]
                    required_fields = ['uuid', 'major', 'minor', 'x', 'y']
                    if all(field in beacon for field in required_fields):
                        print("   ✅ Beacon structure is correct")
                    else:
                        print(f"   ⚠️ Beacon missing fields. Expected: {required_fields}, Got: {list(beacon.keys())}")
                return True, data
            else:
                print("   ❌ Beacons endpoint failed - not a list")
                return False, None
        else:
            print("   ❌ Beacons endpoint failed - non-200 status")
            return False, None
    except Exception as e:
        print(f"   ❌ Beacons endpoint failed - Exception: {e}")
        return False, None

def test_pois():
    """Test the POIs endpoint"""
    print("\n🔍 Testing POIs: GET /api/pois")
    try:
        response = requests.get(f"{API_BASE}/pois", timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"   ✅ POIs endpoint working - returned {len(data)} POIs")
                return True, data
            else:
                print("   ❌ POIs endpoint failed - not a list")
                return False, None
        else:
            print("   ❌ POIs endpoint failed - non-200 status")
            return False, None
    except Exception as e:
        print(f"   ❌ POIs endpoint failed - Exception: {e}")
        return False, None

def test_position_computation():
    """Test the position computation endpoint"""
    print("\n🔍 Testing Position Computation: POST /api/position")
    
    # Test payload as specified in the request
    payload = {
        "beacons": [
            {
                "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
                "major": 1,
                "minor": 1,
                "rssi": -65
            },
            {
                "uuid": "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0",
                "major": 1,
                "minor": 2,
                "rssi": -75
            }
        ]
    }
    
    try:
        response = requests.post(f"{API_BASE}/position", 
                               json=payload, 
                               headers={'Content-Type': 'application/json'},
                               timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ['buildingId', 'floorId', 'x', 'y', 'valid']
            if all(field in data for field in required_fields):
                if data.get('valid') == True:
                    print("   ✅ Position computation working - valid position returned")
                    return True, data
                else:
                    print("   ⚠️ Position computation returned invalid position")
                    return True, data  # Still working, just invalid position
            else:
                print(f"   ❌ Position computation failed - missing fields. Expected: {required_fields}, Got: {list(data.keys())}")
                return False, None
        else:
            print("   ❌ Position computation failed - non-200 status")
            return False, None
    except Exception as e:
        print(f"   ❌ Position computation failed - Exception: {e}")
        return False, None

def test_navigation(floors_data):
    """Test the navigation endpoint"""
    print("\n🔍 Testing Navigation: POST /api/navigate")
    
    # Get a floor ID from the floors data
    if not floors_data or len(floors_data) == 0:
        print("   ❌ Cannot test navigation - no floors available")
        return False, None
    
    floor_id = floors_data[0].get('id') or floors_data[0].get('floorId') or str(floors_data[0])
    print(f"   Using floor ID: {floor_id}")
    
    payload = {
        "floorId": floor_id,
        "startX": 150,
        "startY": 150,
        "destX": 700,
        "destY": 300
    }
    
    try:
        response = requests.post(f"{API_BASE}/navigate", 
                               json=payload, 
                               headers={'Content-Type': 'application/json'},
                               timeout=10)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'route' in data and isinstance(data['route'], list):
                print(f"   ✅ Navigation working - returned route with {len(data['route'])} points")
                return True, data
            else:
                print("   ❌ Navigation failed - no route array in response")
                return False, None
        else:
            print("   ❌ Navigation failed - non-200 status")
            return False, None
    except Exception as e:
        print(f"   ❌ Navigation failed - Exception: {e}")
        return False, None

def main():
    """Run all tests"""
    print("🚀 Starting Indoor Wayfinding API Tests")
    print(f"🌐 Backend URL: {API_BASE}")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Health Check
    results['health'] = test_health_check()
    
    # Test 2: Buildings
    buildings_success, buildings_data = test_buildings()
    results['buildings'] = buildings_success
    
    # Test 3: Floors
    floors_success, floors_data = test_floors()
    results['floors'] = floors_success
    
    # Test 4: Beacons
    beacons_success, beacons_data = test_beacons()
    results['beacons'] = beacons_success
    
    # Test 5: POIs
    pois_success, pois_data = test_pois()
    results['pois'] = pois_success
    
    # Test 6: Position Computation
    position_success, position_data = test_position_computation()
    results['position'] = position_success
    
    # Test 7: Navigation (requires floors data)
    navigation_success, navigation_data = test_navigation(floors_data if floors_success else None)
    results['navigation'] = navigation_success
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for success in results.values() if success)
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"   {test_name.upper():<20} {status}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Indoor Wayfinding API is working correctly.")
        return 0
    else:
        print("⚠️ Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())