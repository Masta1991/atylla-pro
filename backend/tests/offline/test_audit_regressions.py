"""Regression tests for the 2026-09-13 audit, using real routes and synthetic data."""
import copy
import json
import socket
import types
import unittest
from unittest.mock import Mock, patch

from offline_support import (
    ROOT, UID, CID, EID, EID2, PID, EXID, MemoryDB, event, deny_network,
    app, calendar, clients, workouts, TestClient, HTTPException,
    CalendarEventUpdate, CalendarSwapRequest, WorkoutLogBatch, ReplaceWeekRequest,
)
import database
from session_policy import issue_lease
import httpx
from routers import auth
from supabase_auth.errors import AuthApiError
from postgrest.exceptions import APIError


class AuditRegressions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api_context = TestClient(app)
        cls.api = cls.api_context.__enter__()
        cls.network_guard = patch.object(socket.socket, "connect", side_effect=deny_network)
        cls.network_guard.start()

    @classmethod
    def tearDownClass(cls):
        cls.api_context.__exit__(None, None, None)
        cls.network_guard.stop()

    def test_email_routes_removed(self):
        for path in ("/email/send-plan", "/email/send-report"):
            self.assertIn(self.api.post(path, json={}).status_code, (404, 405))
        self.assertFalse(any(r.path.startswith('/email/') for r in app.routes))

    def test_missing_bearer_cannot_read_clients(self):
        self.assertEqual(self.api.get('/clients/').status_code, 401)

    def test_invalid_or_expired_token_cannot_read_clients(self):
        fake = Mock()
        fake.auth.get_user.side_effect = AuthApiError("invalid token", 401, None)
        with patch.object(database, "create_client", return_value=fake):
            res = self.api.get('/clients/', headers={'Authorization': 'Bearer forged', 'X-Atylla-Session': issue_lease(UID)['idle_token']})
        self.assertEqual(res.status_code, 401)
        fake.table.assert_not_called()

    def test_valid_verified_user_can_read_clients(self):
        fake = Mock()
        fake.auth.get_user.return_value = types.SimpleNamespace(user=types.SimpleNamespace(id=UID))
        fake.table.side_effect = MemoryDB().table
        with patch.object(database, "create_client", return_value=fake):
            res = self.api.get('/clients/',
                headers={"Authorization": "Bearer verified-by-auth", "X-Atylla-Session": issue_lease(UID)["idle_token"]})
        self.assertEqual(res.status_code, 200)
        fake.auth.get_user.assert_called_once_with("verified-by-auth")
        fake.postgrest.auth.assert_called_once_with("verified-by-auth")

    def test_auth_outage_returns_503_without_side_effect(self):
        fake = Mock()
        fake.auth.get_user.side_effect = httpx.ConnectTimeout("offline failure")
        with patch.object(database, "create_client", return_value=fake):
            res = self.api.get('/clients/',
                headers={"Authorization": "Bearer unavailable", "X-Atylla-Session": issue_lease(UID)["idle_token"]})
        self.assertEqual(res.status_code, 503)
        fake.table.assert_not_called()

    def test_refresh_requires_body(self):
        with patch.object(auth, "create_client") as factory:
            res = self.api.post("/auth/refresh?refresh_token=synthetic")
        self.assertEqual(res.status_code, 422)
        factory.assert_not_called()

    def test_refresh_json_contract(self):
        fake = Mock()
        fake.auth.refresh_session.return_value = types.SimpleNamespace(
            session=types.SimpleNamespace(access_token="new", refresh_token="new-refresh"),
            user=types.SimpleNamespace(id=UID))
        with patch.object(auth, "create_client", return_value=fake):
            res = self.api.post("/auth/refresh", json={"refresh_token": "synthetic", "idle_token": issue_lease(UID)["idle_token"]})
        self.assertEqual(res.status_code, 200)
        fake.auth.refresh_session.assert_called_once_with("synthetic")

    def test_closed_cycle_flag_survives_http_serialization(self):
        db = MemoryDB({"calendar_events": [event(in_closed_cycle=True)]})
        with patch.object(calendar, "get_user_supabase", return_value=(db, UID)), \
             patch.object(calendar, "assign_chronological_numbers", side_effect=lambda rows, db: rows):
            res = self.api.get("/calendar/week/2026-08-31")
        self.assertEqual(res.status_code, 200)
        self.assertIs(res.json()[0]["in_closed_cycle"], True)

    def test_monthly_final_day_and_cancellations(self):
        c = {"name": "Audit", "billing_type": "single", "package_purchase_date": None,
             "payment_history": [{"action": "end", "purchase_date": "2026-09-01", "end_date": "2026-09-02"}]}
        for status, paid, expected in [("active", False, True), ("cancelled", True, True),
                                       ("cancelled", False, False), ("deleted", False, False)]:
            evs = [event(clients=copy.deepcopy(c)), event(EID2, "2026-09-02", clients=copy.deepcopy(c))]
            evs[1].update(status=status, is_settled=paid)
            with self.subTest(status=status, paid=paid):
                out = calendar.assign_chronological_numbers(copy.deepcopy(evs), MemoryDB({"calendar_events": evs}))
                self.assertEqual(out[1]["in_closed_cycle"], expected)
                self.assertEqual(out[1].get("tile_number"), 2 if expected else None)

    def test_explicit_null_clears_partner_and_plan(self):
        db = MemoryDB({"calendar_events": [event(partner_client_id=EID2, plan_id=PID)]})
        with patch.object(calendar, "get_user_supabase", return_value=(db, UID)):
            out = calendar.update_event("2026-09-01", 10, CalendarEventUpdate(partner_client_id=None, plan_id=None), None)
        self.assertIsNone(out["partner_client_id"])
        self.assertIsNone(out["plan_id"])

    def test_omitted_partner_is_preserved(self):
        db = MemoryDB({"calendar_events": [event(partner_client_id=EID2)]})
        with patch.object(calendar, "get_user_supabase", return_value=(db, UID)):
            out = calendar.update_event("2026-09-01", 10, CalendarEventUpdate(note="updated"), None)
        self.assertEqual(out["partner_client_id"], EID2)

    def test_upsert_explicit_null_preserved_in_payload(self):
        from models import CalendarEventCreate
        db = MemoryDB()
        with patch.object(calendar, "get_user_supabase", return_value=(db, UID)):
            calendar.create_or_update_event(CalendarEventCreate(
                event_date="2026-09-01", event_hour=10, client_id=CID, partner_client_id=None), None)
        payload = db.operations[0][2]
        self.assertIn("partner_client_id", payload)
        self.assertIsNone(payload["partner_client_id"])

    def test_null_status_rejected_before_db_write(self):
        db = MemoryDB()
        with patch.object(calendar, "get_user_supabase", return_value=(db, UID)), self.assertRaises(HTTPException):
            calendar.update_event("2026-09-01", 10, CalendarEventUpdate(status=None), None)
        self.assertEqual(db.operations, [])

    def test_active_anchor_detected_even_outside_membership(self):
        db = MemoryDB({"client_packages": [{"id": PID, "start_training_id": EID, "end_training_id": None}]})
        self.assertTrue(calendar._any_active_anchor(db, event()))

    def test_anchor_query_failure_blocks_operation(self):
        db = MemoryDB(fail=lambda q: True)
        with self.assertRaises(HTTPException) as ctx:
            calendar._any_active_anchor(db, event())
        self.assertEqual(ctx.exception.status_code, 503)

    def batch(self):
        return WorkoutLogBatch(client_id=CID, session_date="2026-09-01", week_number=1, logs=[{
            "client_id": CID, "session_date": "2026-09-01", "week_number": 1, "exercise_id": EXID}])

    def test_workout_uses_only_versioned_rpc(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = [{"id": EID}]
        with patch.object(workouts, "get_user_supabase", return_value=(db, UID)):
            self.assertEqual(workouts.save_workout_batch(self.batch(), None), [{"id": EID}])
        self.assertEqual(db.rpc.call_args.args[0], "save_workout_batch_v2")
        db.table.assert_not_called()

    def test_failed_rpc_never_falls_back_to_delete(self):
        for error, code in [
            (APIError({"code": "PGRST202", "message": "missing", "details": "", "hint": ""}), 503),
            (httpx.ReadTimeout("unknown commit result"), 502),
            (APIError({"code": "42501", "message": "denied", "details": "", "hint": ""}), 403),
        ]:
            db = Mock()
            db.rpc.return_value.execute.side_effect = error
            with self.subTest(code=code), patch.object(workouts, "get_user_supabase", return_value=(db, UID)), \
                 self.assertRaises(HTTPException) as ctx:
                workouts.save_workout_batch(self.batch(), None)
            self.assertEqual(ctx.exception.status_code, code)
            db.table.assert_not_called()
            db.rpc.assert_called_once()

    def test_empty_batch_rejected_without_rpc(self):
        db = Mock()
        data = WorkoutLogBatch(client_id=CID, session_date="2026-09-01", week_number=1, logs=[])
        with patch.object(workouts, "get_user_supabase", return_value=(db, UID)), self.assertRaises(HTTPException):
            workouts.save_workout_batch(data, None)
        db.rpc.assert_not_called()
        db.table.assert_not_called()

    def test_swap_and_replace_failure_do_not_issue_rest_writes(self):
        calls = [
            lambda: calendar.swap_events(CalendarSwapRequest(date1="2026-09-01", hour1=10, date2="2026-09-02", hour2=10), None),
            lambda: calendar.replace_week(ReplaceWeekRequest(monday_date="2026-08-31", events=[]), None),
            lambda: calendar.clear_week("2026-08-31", None),
            lambda: calendar._hard_delete(db, UID, event(), "2026-09-01", 10),
            lambda: calendar.delete_package_start("2026-09-01", 10, calendar.DeleteStartRequest(mode="cancel"), None),
        ]
        for action in calls:
            db = Mock()
            db.rpc.return_value.execute.side_effect = httpx.ReadTimeout("unknown commit result")
            with patch.object(calendar, "get_user_supabase", return_value=(db, UID)), self.assertRaises(HTTPException):
                action()
            db.table.assert_not_called()
            self.assertEqual(db.rpc.call_args.args[0], "calendar_mutation_v2")

    def test_legacy_delete_alias_cannot_bypass_guard(self):
        with patch.object(calendar, "delete_event", side_effect=HTTPException(400, "anchor")) as guarded:
            with self.assertRaises(HTTPException):
                calendar.hard_delete_event("2026-09-01", 10, None)
        guarded.assert_called_once()

    def test_closed_anchor_sql_contract(self):
        # Static contract only; PostgreSQL execution is a separate integration gate.
        sql = (ROOT / "database/migrations/007_audit_atomic_writes.sql").read_text(encoding="utf-8")
        self.assertIn("BEFORE DELETE OR UPDATE", sql)
        self.assertNotIn("end_training_id = NULL", sql)
        self.assertIn("SECURITY INVOKER", sql)
        self.assertIn("actor IS DISTINCT FROM p_trainer_id", sql)
        self.assertIn("FROM PUBLIC, anon", sql)
        self.assertNotIn("WHEN OTHERS", sql)

    def test_version_metadata_consistent(self):
        package = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8-sig"))
        lock = json.loads((ROOT / "frontend/package-lock.json").read_text(encoding="utf-8-sig"))
        expo = json.loads((ROOT / "frontend/app.json").read_text(encoding="utf-8-sig"))
        expected = package["version"]
        self.assertEqual(app.version, expected)
        self.assertEqual(expo["expo"]["version"], expected)
        self.assertEqual(lock["version"], expected)
        self.assertEqual(lock["packages"][""]["version"], expected)
        self.assertIn(expected, (ROOT / "frontend/src/version.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
