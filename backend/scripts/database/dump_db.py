import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
TEST_ID = '520504a4-1a24-4534-aac6-56237ff84f15'

res = supabase.table('clients').select('id, name').eq('trainer_id', TEST_ID).execute()
for c in res.data:
    pkgs = supabase.table('client_packages').select('*').eq('client_id', c['id']).execute().data
    events = supabase.table('calendar_events').select('id, event_date, is_settled, status').eq('client_id', c['id']).neq('status', 'deleted').order('event_date').execute().data
    print(f"Client: {c['name']} ({c['id']})")
    print("Packages:")
    for p in pkgs:
        print(f"  {p}")
    print("Events:")
    for e in events:
        print(f"  {e}")
