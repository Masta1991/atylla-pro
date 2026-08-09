import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

TEST_ID = "520504a4-1a24-4534-aac6-56237ff84f15"

def check_active_packages():
    print("Checking active packages for trainer staws22-1@gmail.com...")
    # Fetch all packages for the trainer
    res = supabase.table("client_packages")\
        .select("id, client_id, size, start_training_id, end_training_id, offset, clients(name)")\
        .eq("trainer_id", TEST_ID)\
        .execute()
    
    packages = res.data or []
    active = [p for p in packages if p.get("end_training_id") is None]
    
    print(f"Total packages found: {len(packages)}")
    print(f"Active packages found: {len(active)}")
    for p in active:
        client_name = p.get("clients", {}).get("name") if p.get("clients") else "Unknown"
        print(f"- Package ID: {p['id']}, Client: {client_name} (ID: {p['client_id']}), Size: {p['size']}, Start Event: {p['start_training_id']}, Offset: {p['offset']}")

if __name__ == "__main__":
    check_active_packages()
