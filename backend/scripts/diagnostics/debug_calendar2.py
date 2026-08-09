import sys
import os
import io
from dotenv import load_dotenv
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
TEST_ID = '520504a4-1a24-4534-aac6-56237ff84f15'

def main():
    clients_res = supabase.table('clients').select('id, name').eq('trainer_id', TEST_ID).execute()
    for c in clients_res.data:
        pkgs = supabase.table('client_packages').select('*').eq('client_id', c['id']).order('created_at').execute().data
        if not pkgs:
            continue
        print(f"Client: {c['name']} (id: {c['id']})")
        for p in pkgs:
            print(f"  Package: id={p['id']}, start={p.get('start_training_id')}, end={p.get('end_training_id')}, size={p.get('size')}, offset={p.get('offset')}")
            
        print("  Events (all):")
        evs = supabase.table('calendar_events').select('id, event_date, event_hour, status, is_settled').eq('client_id', c['id']).order('event_date').execute().data
        for i, e in enumerate(evs):
            print(f"    [{i}] id={e['id']}, date={e['event_date']} {e['event_hour']}:00, status={e['status']}, settled={e['is_settled']}")

if __name__ == '__main__':
    main()
