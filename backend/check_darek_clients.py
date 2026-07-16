import os
from dotenv import load_dotenv
from supabase import create_client, Client
import sys

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)
DAREK_ID = "afa0e62c-fbe3-41be-9fa3-a5841af7ef9e"

def check_clients():
    clients = supabase.table("clients").select("name, billing_type, package_current_count").eq("trainer_id", DAREK_ID).execute().data
    print("Darek's Clients Billing Info:")
    for c in clients:
        print(f"Name: {c['name']} | Billing Type: {c['billing_type']} | Current Count: {c['package_current_count']}")

if __name__ == "__main__":
    check_clients()
