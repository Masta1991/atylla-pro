import json
import io
from database import get_supabase
supabase = get_supabase()
res = supabase.table("calendar_events").select("*, clients(name), workout_types(name)").execute()
with io.open("test_raw.json", "w", encoding="utf-8") as f:
    json.dump(res.data, f, ensure_ascii=False, indent=2)
print("Done")
