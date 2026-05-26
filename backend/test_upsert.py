from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv(".env")
supabase = create_client(os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY"))

try:
    res = supabase.table("clients").select("*").execute()
    client_id = res.data[0]["id"]

    payload = {
        "event_date": "2026-05-24",
        "event_hour": 10,
        "client_id": client_id,
        "status": "active"
    }
    
    print("Testing upsert with payload:", payload)
    res = supabase.table("calendar_events").upsert(
        payload, on_conflict="event_date,event_hour"
    ).execute()
    print("Success:", res.data)
except Exception as e:
    print("Error during upsert:", repr(e))
