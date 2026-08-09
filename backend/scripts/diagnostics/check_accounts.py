import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def check_accounts():
    print("Fetching users via admin API...")
    try:
        users = supabase.auth.admin.list_users()
        darek_id = None
        test_id = None
        for u in users:
            if u.email == "treneratylla@gmail.com":
                darek_id = u.id
            elif u.email == "staws22-1@gmail.com":
                test_id = u.id
                
        print(f"Darek ID: {darek_id}")
        print(f"Test ID: {test_id}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_accounts()
