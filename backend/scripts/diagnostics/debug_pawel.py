import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
TEST_ID = '520504a4-1a24-4534-aac6-56237ff84f15'

res = supabase.table('clients').select('id, name').eq('trainer_id', TEST_ID).ilike('name', '%Pawe%').execute()
if not res.data:
    print("Pawel not found")
    sys.exit()

pawel = res.data[0]
client_id = pawel['id']
print(f"Client: {pawel}")

pkgs = supabase.table('client_packages').select('*').eq('client_id', client_id).execute().data
print('Packages:')
for p in pkgs:
    print(' ', p)

evs = supabase.table('calendar_events').select('*').eq('client_id', client_id).order('event_date').order('event_hour').execute().data
print('Events:')
for e in evs:
    print(f"  {e['id']}: {e['event_date']} {e['event_hour']}:00, settled={e['is_settled']}, status={e['status']}")

from routers.calendar import assign_chronological_numbers

test_events = supabase.table('calendar_events').select('id, client_id, event_date, event_hour, status, is_settled, clients!calendar_events_client_id_fkey(billing_type, package_purchase_date, payment_history)').eq('client_id', client_id).order('event_date').order('event_hour').execute().data
filtered_test_events = [e for e in test_events if e['status'] != 'deleted']

print("Running assign_chronological_numbers with the exact same DB logic...")
out = assign_chronological_numbers(filtered_test_events, supabase)

print('Assign Results:')
for o in out:
    c = o['clients']
    print(f"  {o['event_date']} {o['event_hour']}:00 -> has_active={c.get('has_active_billing_or_history')}, count={c.get('package_current_count')}/{c.get('package_size')}")
