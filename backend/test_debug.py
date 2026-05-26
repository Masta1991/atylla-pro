import requests
try:
    res = requests.get("http://localhost:8000/debug_model")
    print(res.json())
except Exception as e:
    print(e)
