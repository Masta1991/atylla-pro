from database import get_supabase
import sys

def main():
    supabase = get_supabase()
    
    # 1. Znalezienie ID trenera dla staws22-1@gmail.com
    res = supabase.auth.admin.list_users()
    trainer_id = None
    for u in res.users:
        if u.email == "staws22-1@gmail.com":
            trainer_id = u.id
            break
            
    if not trainer_id:
        print("Nie znaleziono konta staws22-1@gmail.com!")
        sys.exit(1)

    print(f"Czyszczenie historii dla trenera {trainer_id} (staws22-1@gmail.com)...")
    
    # 2. Skasowanie wszystkich paczek z client_packages
    # Klienci tego trenera
    clients_res = supabase.table("clients").select("id").eq("trainer_id", trainer_id).execute()
    client_ids = [c["id"] for c in clients_res.data]
    
    if client_ids:
        print(f"Znaleziono {len(client_ids)} klientów. Kasowanie ich pakietów...")
        supabase.table("client_packages").delete().in_("client_id", client_ids).execute()
        
        # 3. Wyzerowanie w starych tabelach payment_history i package_current_count
        print("Resetowanie wpisów historycznych w profilach klientów...")
        for cid in client_ids:
            supabase.table("clients").update({
                "payment_history": [],
                "package_purchase_date": None,
                "package_current_count": 0
            }).eq("id", cid).execute()
            
    print("GOTOWE! Baza dla staws22-1 jest czysta jak łza. Mozna zaczynać Dzień 0!")

if __name__ == "__main__":
    main()
