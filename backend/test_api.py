import urllib.request
import json

req = urllib.request.Request('http://127.0.0.1:8000/clients/')
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    for c in data:
        if c['name'] == 'Maciek':
            print(f"Name: {c['name']}, pkg: {c.get('active_package_id')}, count: {c.get('package_current_count')}")
