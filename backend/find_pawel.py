import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))
TEST_ID = '520504a4-1a24-4534-aac6-56237ff84f15'

res = supabase.table('clients').select('id, name, billing_type, package_purchase_date, payment_history').eq('trainer_id', TEST_ID).execute()
for c in res.data:
    if 'Pawe' in c['name']:
        print(f"Name: {c['name']}")
        print(f"ID: {c['id']}")
        print(f"Billing type: {c['billing_type']}")
        print(f"History: {c['payment_history']}")
        pkgs = supabase.table('client_packages').select('*').eq('client_id', c['id']).execute().data
        print('Packages:', pkgs)
