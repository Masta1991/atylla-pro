import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from supabase import create_client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

try:
    res = supabase.table("plan_exercises").select("*").limit(1).execute()
    print("Columns:", res.data[0].keys() if res.data else "No rows")
except Exception as e:
    print("Error:", e)
