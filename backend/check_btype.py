import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

# Get exactly what assign_chronological_numbers does
cid = '755a0020-3222-40dd-8bfe-f9eaf79665b7' # Paweł
client_ids = [cid]
pkgs_res = supabase.table("client_packages").select("*").in_("client_id", client_ids).execute()
packages = pkgs_res.data or []
print('packages:', packages)

all_events_res = supabase.table("calendar_events") \
    .select("id, client_id, event_date, event_hour, status, is_settled, clients!calendar_events_client_id_fkey(billing_type, package_purchase_date, payment_history)") \
    .in_("client_id", client_ids) \
    .order("event_date") \
    .order("event_hour") \
    .execute()

all_client_events = {}
client_info = {}
for e in all_events_res.data:
    if cid not in all_client_events:
        all_client_events[cid] = []
    all_client_events[cid].append(e)
    if cid not in client_info and e.get("clients"):
        client_info[cid] = e["clients"]

print('client_info:', client_info)

b_type = client_info.get(cid, {}).get("billing_type")
print('b_type:', b_type)
