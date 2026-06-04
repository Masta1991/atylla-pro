import os
import sys
from database import get_supabase

supabase = get_supabase()

# Pick the first client that has some calendar events
events = supabase.table("calendar_events").select("client_id").limit(1).execute()
if events.data:
    cid = events.data[0]['client_id']
    print(f"Trying to delete client {cid} which has events...")
    try:
        supabase.table("clients").delete().eq("id", cid).execute()
        print("Success?")
    except Exception as e:
        print(f"Failed: {e}")
else:
    print("No events found.")
