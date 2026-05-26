import requests
import json
import uuid
import datetime

# get a valid client_id from backend
res = requests.get("http://localhost:8000/clients/")
clients = res.json()
if not clients:
    print("No clients found")
    exit()

client_id = clients[0]["id"]

payload = {
    "event_date": "2026-05-24",
    "event_hour": 10,
    "client_id": client_id,
    "status": "active"
}

res = requests.post("http://localhost:8000/calendar/", json=payload)
print(res.status_code, res.text)
