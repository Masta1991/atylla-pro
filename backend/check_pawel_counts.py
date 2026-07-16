import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client
from routers.calendar import assign_chronological_numbers

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
TEST_ID = '520504a4-1a24-4534-aac6-56237ff84f15'

res = supabase.table('clients').select('id, name').eq('trainer_id', TEST_ID).ilike('name', '%Pawe%').execute()
for pawel in res.data:
    client_id = pawel['id']
    test_events = supabase.table('calendar_events').select('id, client_id, event_date, event_hour, status, is_settled, clients!calendar_events_client_id_fkey(billing_type, package_purchase_date, payment_history)').eq('client_id', client_id).neq('status', 'deleted').order('event_date').order('event_hour').execute().data
    out = assign_chronological_numbers(test_events, supabase)
    print(f"Client: {pawel['name']}")
    for o in out:
        if o['event_date'].startswith('2026-07'):
            cl = o['clients']
            print(f"  {o['event_date']} {o['event_hour']}:00 -> has_active={cl.get('has_active_billing_or_history')}, count={cl.get('package_current_count')}")
