import requests
try:
    res = requests.get("http://localhost:8000/")
    print(res.json())
except Exception as e:
    print(e)
