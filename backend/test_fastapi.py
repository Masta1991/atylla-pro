from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
response = client.get("/calendar/week/2026-05-24")
print(response.json())
