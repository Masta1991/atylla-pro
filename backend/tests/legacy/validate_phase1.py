import os
from dotenv import load_dotenv
from supabase import create_client, Client
import sys

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)
TEST_ID = "520504a4-1a24-4534-aac6-56237ff84f15"

def validate_phase1():
    clients = supabase.table("clients").select("id, name").eq("trainer_id", TEST_ID).execute().data
    events = supabase.table("calendar_events").select("id").eq("trainer_id", TEST_ID).execute().data
    packages = supabase.table("client_packages").select("*").eq("trainer_id", TEST_ID).execute().data
    
    print(f"--- RAPORT TESTOWY FAZY 1 ---")
    print(f"Clients cloned: {len(clients)}")
    print(f"Calendar events cloned: {len(events)}")
    print(f"SSOT Packages generated: {len(packages)}")
    
    if packages:
        print("\nSample packages (first 5):")
        for p in packages[:5]:
            c_name = next((c['name'] for c in clients if c['id'] == p['client_id']), "Unknown")
            print(f"- Client: {c_name} | Size: {p['size']} | Offset: {p['offset']} | Start: {p['start_training_id']}")

if __name__ == "__main__":
    validate_phase1()
