"""Synthetic fixtures for offline regression tests; never loads backend/.env."""
import ast
import base64
import copy
import json
import socket
import sys
import types
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "backend"))


def deny_network(*args, **kwargs):
    raise AssertionError("Network disabled by offline audit")


socket.create_connection = deny_network
config = types.ModuleType("config")
for key, value in {
    "SUPABASE_URL": "https://offline.invalid",
    "SUPABASE_KEY": "audit-placeholder",
    "SUPABASE_ANON_KEY": "audit-placeholder",
}.items():
    setattr(config, key, value)
sys.modules["config"] = config

from fastapi import HTTPException
from fastapi.testclient import TestClient
from main import app
from models import CalendarEventUpdate, CalendarSwapRequest, ReplaceWeekRequest, WorkoutLogBatch
from routers import calendar, clients, workouts

UID = "00000000-0000-4000-8000-000000000001"
CID = "00000000-0000-4000-8000-000000000002"
EID = "00000000-0000-4000-8000-000000000003"
PID = "00000000-0000-4000-8000-000000000004"
EID2 = "00000000-0000-4000-8000-000000000005"
EXID = "00000000-0000-4000-8000-000000000006"
NOW = "2026-09-13T00:00:00Z"


def event(eid=EID, day="2026-09-01", **extra):
    return dict(id=eid, client_id=CID, event_date=day, event_hour=10,
                trainer_id=UID, status="active", is_settled=False,
                created_at=NOW, updated_at=NOW, **extra)


class MemoryDB:
    """Small query double with projections, filtering and injected failures.

    Does not simulate PostgreSQL permissions, transactions, FKs or RLS.
    """
    def __init__(self, tables=None, fail=None):
        self.tables = copy.deepcopy(tables or {})
        self.fail = fail
        self.operations = []

    def table(self, name):
        return Query(self, name)


class Query:
    def __init__(self, db, name):
        self.db, self.name = db, name
        self.action, self.columns, self.payload = "select", "*", None
        self.predicates, self.bounds, self.sorts = [], None, []
        self.one = False

    def select(self, columns="*"):
        self.columns = columns
        return self

    def eq(self, key, value):
        self.predicates.append(lambda row: str(row.get(key)) == str(value))
        return self

    def in_(self, key, values):
        self.predicates.append(lambda row: str(row.get(key)) in {str(v) for v in values})
        return self

    def neq(self, key, value):
        self.predicates.append(lambda row: str(row.get(key)) != str(value))
        return self

    def is_(self, key, value):
        self.predicates.append(lambda row: row.get(key) is value)
        return self

    def gte(self, key, value):
        self.predicates.append(lambda row: str(row.get(key)) >= str(value))
        return self

    def lte(self, key, value):
        self.predicates.append(lambda row: str(row.get(key)) <= str(value))
        return self

    def filter(self, key, op, value):
        assert op == "ov"
        values = set(value.strip("{}").split(","))
        self.predicates.append(lambda row: bool(set(map(str, row.get(key) or [])) & values))
        return self

    def limit(self, count):
        self.bounds = (0, count)
        return self

    def range(self, start, end):
        self.bounds = (start, end + 1)
        return self

    def order(self, key, **kwargs):
        self.sorts.append(key)
        return self

    def single(self):
        self.one = True
        return self

    def update(self, payload):
        self.action, self.payload = "update", payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def insert(self, payload):
        self.action, self.payload = "insert", payload
        return self

    def upsert(self, payload, **kwargs):
        self.action, self.payload = "upsert", payload
        return self

    def execute(self):
        self.db.operations.append((self.name, self.action, self.payload))
        if self.db.fail and self.db.fail(self):
            raise RuntimeError("Injected audit failure")
        table = self.db.tables.setdefault(self.name, [])
        rows = [r for r in table if all(p(r) for p in self.predicates)]
        if self.action in ("insert", "upsert"):
            rows = copy.deepcopy(self.payload if isinstance(self.payload, list) else [self.payload])
            table.extend(rows)
        elif self.action == "update":
            for row in rows:
                row.update(self.payload)
        elif self.action == "delete":
            self.db.tables[self.name] = [r for r in table if r not in rows]
        else:
            for key in reversed(self.sorts):
                rows.sort(key=lambda r: r.get(key, ""))
            if self.bounds:
                rows = rows[slice(*self.bounds)]
            if "*" not in self.columns and "(" not in self.columns:
                rows = [{k.strip(): r[k.strip()] for k in self.columns.split(",") if k.strip() in r} for r in rows]
        data = copy.deepcopy(rows[0] if self.one and rows else (None if self.one else rows))
        return types.SimpleNamespace(data=data)
