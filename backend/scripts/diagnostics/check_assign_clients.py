import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

from routers.clients import assign_client_packages_status
res = supabase.table('clients').select('*').order('name').execute()
clients = res.data or []
clients = assign_client_packages_status(clients, supabase)
for c in clients:
    if 'Pawe' in c['name']:
        print(f"{c['name']} -> {c.get('package_current_count')}")
