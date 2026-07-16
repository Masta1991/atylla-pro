import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
# Actually trainer_profiles has no email. auth.users is inaccessible.
# I'll just check ALL Pawels across ALL trainers.
res2 = supabase.table('clients').select('id, name, billing_type, trainer_id').ilike('name', '%Pawe%').execute()
for c in res2.data:
    cid = c['id']
    pkgs = supabase.table('client_packages').select('*').eq('client_id', cid).execute().data
    print(f"{c['name']} (trainer: {c['trainer_id']}) -> {len(pkgs)} packages")
