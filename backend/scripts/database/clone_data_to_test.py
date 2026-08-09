import os
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
import sys

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

DAREK_ID = "afa0e62c-fbe3-41be-9fa3-a5841af7ef9e"
TEST_ID = "520504a4-1a24-4534-aac6-56237ff84f15"

def clean_test_account():
    print("Cleaning existing test account data...")
    supabase.table("client_packages").delete().eq("trainer_id", TEST_ID).execute()
    supabase.table("workout_logs").delete().eq("trainer_id", TEST_ID).execute()
    supabase.table("calendar_events").delete().eq("trainer_id", TEST_ID).execute()
    supabase.table("clients").delete().eq("trainer_id", TEST_ID).execute()
    supabase.table("training_plans").delete().eq("trainer_id", TEST_ID).execute()
    supabase.table("workout_types").delete().eq("trainer_id", TEST_ID).execute()

def clone_data():
    print("Starting clone process from Darek to Test (Fix V2)...")
    clean_test_account()

    # 1. Clone Workout Types
    wt_map = {}
    wts = supabase.table("workout_types").select("*").eq("trainer_id", DAREK_ID).execute().data
    new_wts = []
    for wt in wts:
        new_id = str(uuid.uuid4())
        wt_map[wt['id']] = new_id
        wt_copy = dict(wt)
        wt_copy['id'] = new_id
        wt_copy['trainer_id'] = TEST_ID
        new_wts.append(wt_copy)
    if new_wts:
        supabase.table("workout_types").insert(new_wts).execute()

    # 2. Clone Training Plans
    tp_map = {}
    tps = supabase.table("training_plans").select("*").eq("trainer_id", DAREK_ID).execute().data
    new_tps = []
    for tp in tps:
        new_id = str(uuid.uuid4())
        tp_map[tp['id']] = new_id
        tp_copy = dict(tp)
        tp_copy['id'] = new_id
        tp_copy['trainer_id'] = TEST_ID
        tp_copy['workout_type_id'] = wt_map.get(tp['workout_type_id'])
        new_tps.append(tp_copy)
    if new_tps:
        supabase.table("training_plans").insert(new_tps).execute()

    # 3. Clone Clients
    client_map = {}
    clients = supabase.table("clients").select("*").eq("trainer_id", DAREK_ID).execute().data
    new_clients = []
    for c in clients:
        new_id = str(uuid.uuid4())
        client_map[c['id']] = new_id
        c_copy = dict(c)
        c_copy['id'] = new_id
        c_copy['trainer_id'] = TEST_ID
        c_copy['default_workout_type_id'] = wt_map.get(c['default_workout_type_id'])
        c_copy['default_plan_id'] = tp_map.get(c['default_plan_id'])
        new_clients.append(c_copy)
    if new_clients:
        for i in range(0, len(new_clients), 100):
            supabase.table("clients").insert(new_clients[i:i+100]).execute()

    # 4. Clone Calendar Events
    event_map = {}
    events = supabase.table("calendar_events").select("*").eq("trainer_id", DAREK_ID).order('event_date').execute().data
    new_events = []
    for ev in events:
        new_id = str(uuid.uuid4())
        event_map[ev['id']] = new_id
        ev_copy = dict(ev)
        ev_copy['id'] = new_id
        ev_copy['trainer_id'] = TEST_ID
        ev_copy['client_id'] = client_map.get(ev['client_id'])
        ev_copy['workout_type_id'] = wt_map.get(ev['workout_type_id'])
        ev_copy['plan_id'] = tp_map.get(ev['plan_id'])
        ev_copy['replaced_client_id'] = client_map.get(ev['replaced_client_id'])
        new_events.append(ev_copy)
    
    if new_events:
        for i in range(0, len(new_events), 100):
            supabase.table("calendar_events").insert(new_events[i:i+100]).execute()
            
    # 5. Create Client Packages (MIGRATION - Opcja 2)
    print("Generating SSOT Packages (Migration Opcja 2)...")
    packages_to_insert = []
    
    for c in clients:
        if c.get('billing_type') == 'package' and c.get('package_current_count', 0) > 0:
            current_count = c['package_current_count']
            size = c.get('package_size', 10)
            
            # Find ANY event for this client to anchor
            c_events = [ev for ev in new_events if ev['client_id'] == client_map[c['id']]]
            if c_events:
                # Prioritize settled events, else active events
                settled_events = [ev for ev in c_events if ev['is_settled']]
                if settled_events:
                    start_ev = settled_events[-1]['id']
                else:
                    start_ev = c_events[0]['id'] # Just take the first one available
                
                packages_to_insert.append({
                    "client_id": client_map[c['id']],
                    "size": size,
                    "start_training_id": start_ev,
                    "end_training_id": None,
                    "offset": current_count - 1, 
                    "trainer_id": TEST_ID
                })
    
    if packages_to_insert:
        supabase.table("client_packages").insert(packages_to_insert).execute()
        print(f"Created {len(packages_to_insert)} packages with computed offsets.")

    print("Data cloning complete! Ready for Faza 2.")

if __name__ == "__main__":
    clone_data()
