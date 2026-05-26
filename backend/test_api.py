import requests
import json
import io
try:
    res = requests.get("http://localhost:8000/calendar/week/2026-05-24")
    with io.open("test_resp.json", "w", encoding="utf-8") as f:
        json.dump(res.json(), f, ensure_ascii=False, indent=2)
    print("Done")
except Exception as e:
    print(e)
