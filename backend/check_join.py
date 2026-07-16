import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
TEST_ID = '520504a4-1a24-4534-aac6-56237ff84f15'

res = supabase.table('clients').select('id').eq('trainer_id', TEST_ID).ilike('name', '%Pawe%').execute()
for p in res.data:
    client_id = p['id']
    events = supabase.table('calendar_events').select('id, client_id, event_date, event_hour, status, is_settled, clients!calendar_events_client_id_fkey(name, billing_type, package_size, package_current_count)').eq('client_id', client_id).execute().data
    for e in events:
        print(f"{e['event_date']} {e['event_hour']} -> {e.get('clients')}")
