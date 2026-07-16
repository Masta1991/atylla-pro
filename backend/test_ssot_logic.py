import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

sys.path.append(r'c:\Projects\Aktualne projekty w trakcie\atylla-pro\backend')
from routers.clients import assign_client_packages_status

raw_clients = supabase.table('clients').select('*').execute().data
processed_clients = assign_client_packages_status(raw_clients, supabase)

print(f"{'Client':<20} | {'Type':<8} | {'DB Stale':<10} | {'SSOT Dynamic'}")
print("-" * 65)

for c in processed_clients:
    if c['billing_type'] in ['package', 'single']:
        name = c.get('name')
        db_count = supabase.table('clients').select('package_current_count').eq('id', c['id']).execute().data[0]['package_current_count']
        ssot_count = c.get('package_current_count')
        print(f"{name:<20} | {c['billing_type']:<8} | {str(db_count):<10} | {str(ssot_count)}")
