import os
import sys
from database import get_supabase

supabase = get_supabase()

# Create a test client
print("Creating a test client...")
res = supabase.table("clients").insert({"name": "Deletable Client"}).execute()
client_id = res.data[0]['id']
print(f"Created client {client_id}")

# Delete the client the way the API does
print("Deleting the client...")
res_del = supabase.table("clients").delete().eq("id", client_id).execute()

print("Delete result:", res_del.data)
