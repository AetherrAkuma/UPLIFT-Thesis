import urllib.request
import urllib.error
import json

def test_http():
    url = "http://127.0.0.1:8000/api/admin/system-info"
    print(f"Sending HTTP GET to {url} without auth (30s timeout)...")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"Response status: {status}")
            print(f"Response body: {body}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError status: {e.code}")
        print(f"HTTPError body: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_http()
