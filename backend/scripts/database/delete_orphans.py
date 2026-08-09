import os
import sys

from database import get_supabase

supabase = get_supabase()

# Fetch orphans
res = supabase.table("training_plans").select("*").is_("workout_type_id", "null").execute()
print(f"Found {len(res.data)} orphaned plans.")

# Delete orphans
for row in res.data:
    print(f"Deleting {row['name']} ({row['id']})")
    supabase.table("training_plans").delete().eq("id", row['id']).execute()

print("Done deleting orphans.")
