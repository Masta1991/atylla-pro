import os
import sys
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from main import app
from database import get_supabase
import routers.clients

load_dotenv()
sys.stdout.reconfigure(encoding='utf-8')

# Mock the actual function in the module
def mock_get_user_supabase(request):
    supabase = get_supabase()
    TEST_ID = "520504a4-1a24-4534-aac6-56237ff84f15"
    return supabase, TEST_ID

routers.clients.get_user_supabase = mock_get_user_supabase

client = TestClient(app)
TEST_TRAINER_ID = "520504a4-1a24-4534-aac6-56237ff84f15"

def test_phase2():
    print("--- RAPORT TESTOWY FAZY 2 (API) ---")
    supabase = get_supabase()
    clients = supabase.table("clients").select("id").eq("trainer_id", TEST_TRAINER_ID).limit(1).execute()
    if not clients.data:
        print("Brak klientów!")
        return
    client_id = clients.data[0]['id']
    events = supabase.table("calendar_events").select("id").eq("client_id", client_id).limit(2).execute()
    start_ev = events.data[0]['id']
    end_ev = events.data[1]['id']
    
    print("\n--- [START] Tworzenie pakietu ---")
    payload = {"size": 10, "start_training_id": start_ev, "offset": 0}
    resp = client.post(f"/clients/{client_id}/packages", json=payload)
    if resp.status_code == 201:
        pkg_id = resp.json()['id']
        print(f"SUKCES: Pakiet utworzony. ID: {pkg_id}")
    else:
        print(f"BŁĄD przy tworzeniu: {resp.status_code} {resp.text}")
        return
        
    print("\n--- [START] Pobieranie pakietów ---")
    resp = client.get(f"/clients/{client_id}/packages")
    if resp.status_code == 200:
        pkgs = resp.json()
        print(f"SUKCES: Pobrano pakiety. Liczba: {len(pkgs)}")
    else:
        print(f"BŁĄD przy pobieraniu: {resp.status_code} {resp.text}")
        return
        
    print("\n--- [START] Zamykanie pakietu ---")
    resp = client.put(f"/clients/packages/{pkg_id}", json={"end_training_id": end_ev})
    if resp.status_code == 200:
        print(f"SUKCES: Pakiet zamknięty.")
    else:
        print(f"BŁĄD przy zamykaniu: {resp.status_code} {resp.text}")
        return
        
    print("\n--- [START] Twarde kasowanie (Dzień 0) ---")
    resp = client.delete(f"/clients/packages/{pkg_id}")
    if resp.status_code == 200:
        print("SUKCES: Pakiet usunięty.")
    else:
        print(f"BŁĄD przy kasowaniu: {resp.status_code} {resp.text}")
        return
    print("\nWSZYSTKIE TESTY ZAKOŃCZONE POZYTYWNIE!")

if __name__ == "__main__":
    test_phase2()
