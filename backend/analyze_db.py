import os
from dotenv import load_dotenv
from supabase import create_client, Client
import json
from datetime import date

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def analyze():
    # 1. Get trainer profile id for treneratyll@gmail.com (by querying auth.users if possible, but service_role can query trainer_profiles directly if we search by name or just fetch all trainers to find him)
    # Actually, we can fetch all trainer_profiles to find the one. Since trainer_profiles has 'name', let's just fetch all clients and group by trainer_id to find the one with most clients.
    
    # Or try to fetch from clients directly
    print("--- FETCHING CLIENTS ---")
    response = supabase.table("clients").select("id, name, billing_type, package_size, package_current_count, trainer_id").limit(10).execute()
    clients = response.data
    for c in clients:
        print(f"Client: {c['name']} | Billing: {c['billing_type']} | Pkg: {c['package_current_count']}/{c['package_size']} | Trainer: {c['trainer_id']}")
    
    if not clients:
        print("No clients found.")
        return

    # Let's pick a trainer who has clients, likely Darek
    trainer_id = clients[0]['trainer_id']
    
    print(f"\n--- FETCHING CALENDAR EVENTS FOR TRAINER {trainer_id} ---")
    events_res = supabase.table("calendar_events").select("id, event_date, client_id, status, is_settled, note").eq("trainer_id", trainer_id).order("event_date", desc=True).limit(20).execute()
    
    events = events_res.data
    for e in events:
        c_name = next((c['name'] for c in clients if c['id'] == e['client_id']), "Unknown")
        print(f"Date: {e['event_date']} | Client: {c_name} | Status: {e['status']} | Settled: {e['is_settled']} | Note: {e['note']}")

if __name__ == "__main__":
    analyze()
