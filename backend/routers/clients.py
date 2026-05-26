from fastapi import APIRouter, HTTPException
from typing import List
from database import get_supabase
from models import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/", response_model=List[ClientResponse])
def list_clients():
    supabase = get_supabase()
    res = supabase.table("clients").select("*").order("name").execute()
    return res.data or []


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: str):
    supabase = get_supabase()
    res = supabase.table("clients").select("*").eq("id", client_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return res.data


@router.post("/", response_model=ClientResponse, status_code=201)
def create_client(data: ClientCreate):
    supabase = get_supabase()
    # Check for duplicate name
    existing = supabase.table("clients").select("id").eq("name", data.name).execute()
    if existing.data:
        raise HTTPException(400, f"Client '{data.name}' already exists")

    payload = data.model_dump(exclude_none=True, mode='json')
    res = supabase.table("clients").insert(payload).execute()
    return res.data[0]


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: str, data: ClientUpdate):
    supabase = get_supabase()
    payload = {k: v for k, v in data.model_dump(exclude_none=True, mode='json').items() if v is not None}
    payload["updated_at"] = "now()"

    res = supabase.table("clients").update(payload).eq("id", client_id).execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return res.data[0]


@router.delete("/{client_id}")
def delete_client(client_id: str):
    supabase = get_supabase()
    res = supabase.table("clients").delete().eq("id", client_id).execute()
    if not res.data:
        raise HTTPException(404, "Client not found")
    return {"status": "deleted", "name": res.data[0]["name"]}
