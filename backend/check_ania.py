import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

res = supabase.table('calendar_events').select('*').eq('client_id', '2bd73424-4fce-4347-8d60-85cef68c2f94').gte('event_date', '2026-06-01').neq('status', 'deleted').execute()
events = res.data or []
for e in sorted(events, key=lambda x: x['event_date']):
    print(f"{e['event_date']} {e['event_hour']} settled={e['is_settled']}")
