import sys
import pathlib
import json
import shutil
import os
from pathlib import Path

p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

import requests

# Get API config from environment
API_HOST = os.getenv('API_HOST', 'localhost')
API_PORT = os.getenv('API_PORT', '8000')
BASE_URL = f"http://{API_HOST}:{API_PORT}"


def test_upload_endpoint():
    """Test the /upload endpoint with sample resume."""
    print("\n=== API Test 1: Upload Endpoint ===")
    
    test_dir = Path(__file__).parent
    resume_path = test_dir / "sample_resume_1.txt"
    
    url = f"{BASE_URL}/upload"
    
    with open(resume_path, 'rb') as f:
        files = {'resume': ('sample_resume_1.txt', f, 'text/plain')}
        data = {
            'jee_rank': 2487,
            'location': 'Bangalore',
            'preferences': 'CS, AI/ML'
        }
        
        response = requests.post(url, files=files, data=data)
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    assert response.status_code == 200
    result = response.json()
    assert result['status'] == 'ok'
    assert 'applicant_id' in result
    assert 'resume_hash' in result
    
    print("✓ Upload endpoint works")
    return result['applicant_id']


def test_parse_endpoint(applicant_id):
    """Test the /parse endpoint."""
    print(f"\n=== API Test 2: Parse Endpoint ===")
    
    url = f"{BASE_URL}/parse/{applicant_id}"
    response = requests.post(url)
    
    print(f"Status: {response.status_code}")
    
    assert response.status_code == 200
    result = response.json()
    
    print(f"\nParse Results:")
    print(f"  Applicant ID: {result['applicant_id']}")
    print(f"  Needs Review: {result['needs_review']}")
    print(f"  Flags: {result['flags']}")
    print(f"  Retry Used: {result['retry_used']}")
    
    normalized = result['normalized']
    print(f"\n  Personal Info:")
    print(f"    Email: {normalized['personal'].get('email')}")
    print(f"    Name: {normalized['personal'].get('name')}")
    
    print(f"\n  OCR Snippets: {normalized.get('ocr_snippets')}")
    print(f"  JEE Rank: {normalized.get('jee_rank')}")
    
    skills = normalized.get('skills', [])
    print(f"\n  Skills ({len(skills)}):")
    for skill in skills[:5]:
        print(f"    - {skill['name']} (ID: {skill.get('canonical_id', 'N/A')})")
    
    print(f"\n  LLM Provenance:")
    prov = result.get('llm_provenance', {})
    print(f"    Model: {prov.get('model')}")
    print(f"    Latency: {prov.get('latency')}s")
    print(f"    Mock: {prov.get('mock', False)}")
    
    assert result['applicant_id'] == applicant_id
    assert 'normalized' in result
    
    print("\n✓ Parse endpoint works")
    return result


def test_full_workflow():
    """Test complete workflow: upload + parse."""
    print("\n=== API Test 3: Full Workflow ===")
    
    test_dir = Path(__file__).parent
    
    # Test with both sample resumes
    for i, resume_file in enumerate(['sample_resume_1.txt', 'sample_resume_2.txt'], 1):
        print(f"\n--- Testing {resume_file} ---")
        resume_path = test_dir / resume_file
        
        # Upload
        url = f"{BASE_URL}/upload"
        with open(resume_path, 'rb') as f:
            files = {'resume': (resume_file, f, 'text/plain')}
            data = {
                'jee_rank': 2000 + i * 1000,
                'location': 'Mumbai' if i == 1 else 'Delhi',
                'preferences': 'CS' if i == 1 else 'ECE'
            }
            response = requests.post(url, files=files, data=data)
        
        applicant_id = response.json()['applicant_id']
        print(f"  Uploaded: {applicant_id}")
        
        # Parse
        parse_url = f"{BASE_URL}/parse/{applicant_id}"
        parse_response = requests.post(parse_url)
        parse_result = parse_response.json()
        
        print(f"  Email: {parse_result['normalized']['personal'].get('email')}")
        print(f"  Skills: {len(parse_result['normalized'].get('skills', []))}")
        print(f"  Needs Review: {parse_result['needs_review']}")
    
    print("\n✓ Full workflow test passed")


if __name__ == "__main__":
    print("=" * 60)
    print("Running API Integration Tests")
    print("=" * 60)
    print(f"\nNote: Make sure the server is running on {BASE_URL}")
    print(f"  uvicorn resume_pipeline.app:app --reload --host {API_HOST} --port {API_PORT}")
    print("=" * 60)
    
    try:
        # Basic tests
        app_id = test_upload_endpoint()
        test_parse_endpoint(app_id)
        
        # Full workflow
        test_full_workflow()
        
        print("\n" + "=" * 60)
        print("✓ ALL API TESTS PASSED")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("\n✗ ERROR: Cannot connect to server. Is it running?")
        sys.exit(1)
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
