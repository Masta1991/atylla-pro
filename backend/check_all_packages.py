import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

res = supabase.table('client_packages').select('*').execute()
print(f'Total packages: {len(res.data)}')
for p in res.data:
    c = supabase.table('clients').select('name').eq('id', p['client_id']).execute().data[0]
    print(f"{c['name']}: size={p['size']}, start={p['start_training_id']}, end={p.get('end_training_id')}, offset={p.get('offset')}")
