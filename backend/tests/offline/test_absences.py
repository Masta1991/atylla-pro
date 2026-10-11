"""Absence API regression on synthetic data; no external service or credentials."""
import unittest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import httpx
from postgrest.exceptions import APIError
from offline_support import app, calendar, MemoryDB, TestClient, UID, CID, NOW, EID
from absence_options import build_absence_options
from billing import WARSAW


class AbsenceReadTests(unittest.TestCase):
    def setUp(self):
        self.api = TestClient(app)

    def row(self, n, **extra):
        return dict(id=f'00000000-0000-4000-8000-{n:012}', client_id=CID,
                    trainer_id=UID, absence_date='2026-10-14', absence_hour=9,
                    created_at=NOW, **extra)

    def test_complete_history_over_postgrest_page_limit(self):
        db = MemoryDB({'absences': [self.row(n) for n in range(1, 1051)]})
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            result = self.api.get('/calendar/absences')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.json()), 1050)
        self.assertEqual(len({r['id'] for r in result.json()}), 1050)

    def test_date_range_and_trainer_isolation(self):
        rows = [self.row(1), dict(self.row(2), absence_date='2026-09-01'),
                dict(self.row(3), trainer_id=CID)]
        db = MemoryDB({'absences': rows})
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            result = self.api.get('/calendar/absences?date_from=2026-10-01&date_to=2026-10-31')
        self.assertEqual(result.status_code, 200)
        self.assertEqual([r['id'] for r in result.json()], [rows[0]['id']])

    def test_invalid_range_is_rejected_before_read(self):
        with patch.object(calendar, 'get_user_supabase') as auth:
            for query in ['date_from=bad', 'date_to=2026-02-30',
                          'date_from=2026-11-01&date_to=2026-10-01']:
                self.assertEqual(self.api.get('/calendar/absences?' + query).status_code, 422)
            auth.assert_not_called()

    def test_later_page_failure_returns_no_partial_history(self):
        db = MemoryDB({'absences': [self.row(n) for n in range(1, 1002)]},
                      fail=lambda q: q.bounds and q.bounds[0] == 1000)
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            result = self.api.get('/calendar/absences')
        self.assertEqual(result.status_code, 503)
        self.assertNotIn('Injected', result.text)

    def test_batch_is_one_atomic_rpc_with_reviewed_slot_version(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = [self.row(1)]
        item = dict(client_id=CID, absence_date='2026-10-14', absence_hour=9,
                    paid=True, expected_event_id=EID, expected_updated_at=NOW)
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            response = self.api.post('/calendar/absences/batch', json={'items': [item]})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(db.rpc.call_args.args[0], 'record_absences_v1')
        self.assertEqual(db.rpc.call_args.args[1]['p_items'][0]['expected_event_id'], EID)
        db.table.assert_not_called()

    def test_future_schedule_absence_is_explicitly_unpaid_and_reviewed_empty_slot(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = [self.row(1)]
        item = dict(client_id=CID, absence_date='2026-10-14', absence_hour=9,
                    mode='schedule', paid=False, expected_event_id=None, expected_updated_at=None)
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            result = self.api.post('/calendar/absences/batch', json={'items': [item]})
        self.assertEqual(result.status_code, 201, result.text)
        db.rpc.assert_called_once_with('record_absences_v1', {'p_items': [item]})
        db.table.assert_not_called()

    def test_options_include_real_partner_session_but_no_foreign_trainer_data(self):
        day = (datetime.now(WARSAW).date() + timedelta(days=2)).isoformat()
        rows = [{'id': EID, 'trainer_id': UID, 'client_id': UID, 'partner_client_id': CID,
                 'event_date': day, 'event_hour': 9, 'status': 'active', 'updated_at': NOW},
                {'id': CID, 'trainer_id': CID, 'client_id': CID, 'event_date': day,
                 'event_hour': 10, 'status': 'active'}]
        db = MemoryDB({'clients': [{'id': CID, 'trainer_id': UID, 'training_schedule': []}],
                       'calendar_events': rows})
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            response = self.api.get('/calendar/absence-options/' + CID)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertTrue(response.json()[0]['paired'])
        self.assertEqual(response.json()[0]['event_id'], EID)

    def test_options_foreign_client_missing_client_and_read_failure(self):
        for db, expected in [(MemoryDB(), 404),
                             (MemoryDB({'clients': [{'id': CID, 'trainer_id': CID}]}), 404),
                             (MemoryDB(fail=lambda q: True), 503)]:
            with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
                self.assertEqual(self.api.get('/calendar/absence-options/' + CID).status_code, expected)
        with patch.object(calendar, 'get_user_supabase') as auth:
            self.assertEqual(self.api.get('/calendar/absence-options/invalid').status_code, 422)
            auth.assert_not_called()


class AbsenceOptionTests(unittest.TestCase):
    now = datetime(2026, 10, 11, 12, tzinfo=WARSAW)
    client = {'id': CID, 'training_schedule': [{'day': 0, 'hour': 9}]}

    def event(self, hour=9, **extra):
        return {'id': EID, 'client_id': CID, 'event_date': '2026-10-12',
                'event_hour': hour, 'status': 'active', 'updated_at': NOW, **extra}

    def test_scheduled_dates_and_actual_moved_sessions_are_distinguished(self):
        rows = build_absence_options(self.client, [self.event(14)], [], self.now)
        self.assertEqual(rows[0]['kind'], 'scheduled')
        self.assertIsNone(rows[0]['event_id'])
        self.assertEqual(rows[1]['kind'], 'event')
        self.assertEqual(rows[1]['hour'], 14)
        self.assertEqual(rows[1]['event_id'], EID)

    def test_partner_and_client_without_regular_hours_can_report_existing_session(self):
        e = dict(self.event(), client_id=UID, partner_client_id=CID)
        rows = build_absence_options({'id': CID}, [e], [], self.now)
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]['paired'])

    def test_occupied_deleted_cancelled_and_already_absent_slots_are_not_offered(self):
        for ev in [dict(self.event(), client_id=UID), dict(self.event(), status='deleted'),
                   dict(self.event(), status='cancelled')]:
            rows = build_absence_options(self.client, [ev], [], self.now)
            self.assertNotIn('2026-10-12', [row['date'] for row in rows])
        for hour in [9, None]:
            rows = build_absence_options(self.client, [], [
                {'client_id': CID, 'absence_date': '2026-10-12', 'absence_hour': hour}], self.now)
            self.assertNotIn('2026-10-12', [row['date'] for row in rows])

    def test_active_session_takes_priority_over_stale_absence_markers(self):
        for hour in (None, 9):
            rows = build_absence_options(self.client, [self.event()], [
                {'client_id': CID, 'absence_date': '2026-10-12', 'absence_hour': hour}], self.now)
            self.assertEqual(rows[0]['kind'], 'event')
            self.assertEqual(rows[0]['event_id'], EID)

    def test_schedule_duplicates_and_invalid_entries_do_not_duplicate_or_crash(self):
        schedule = [self.client['training_schedule'][0]] * 3 + [None, {}, {'day': 'x', 'hour': 9}, {'day': 0, 'hour': 99}]
        rows = build_absence_options(dict(self.client, training_schedule=schedule), [], [], self.now)
        self.assertEqual(len(rows), 9)
        self.assertEqual(len({(row['date'], row['hour']) for row in rows}), len(rows))

    def test_warsaw_today_excludes_started_slots_and_includes_next_hour(self):
        now = datetime(2026, 10, 12, 9, 30, tzinfo=WARSAW)
        rows = build_absence_options(self.client, [self.event(), self.event(10)], [], now)
        self.assertEqual(rows[0]['hour'], 10)
        self.assertEqual(rows[0]['date'], '2026-10-12')

    def test_dst_does_not_shift_calendar_date_or_regular_hour(self):
        now = datetime(2026, 10, 24, 22, tzinfo=WARSAW)
        rows = build_absence_options(self.client, [], [], now)
        self.assertEqual((rows[0]['date'], rows[0]['hour']), ('2026-10-26', 9))

class AbsenceWriteTests(unittest.TestCase):
    def setUp(self):
        self.api = TestClient(app)

    def test_invalid_batch_or_unpaid_cancellation_never_writes(self):
        with patch.object(calendar, 'get_user_supabase') as auth:
            item = dict(client_id=CID, absence_date='2026-10-14', absence_hour=9)
            for items in [[], [item] * 31, [dict(item, paid=False)], [dict(item, absence_hour=22)]]:
                self.assertEqual(self.api.post('/calendar/absences/batch', json={'items': items}).status_code, 422)
            auth.assert_not_called()

    def test_failed_write_has_no_fallback_or_automatic_retry(self):
        for error, expected in [(httpx.ReadTimeout('uncertain commit'), 502),
                                (APIError({'code': 'PGRST202', 'message': 'missing'}), 503),
                                (APIError({'code': '42501', 'message': 'foreign'}), 403)]:
            for method, url, body in [
                ('POST', '/calendar/absences/batch', {'items': [dict(client_id=CID, absence_date='2026-10-14', absence_hour=9, expected_event_id=EID, expected_updated_at=NOW)]}),
                ('DELETE', '/calendar/absences/' + EID, None)]:
                db = Mock()
                db.rpc.return_value.execute.side_effect = error
                with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
                    response = self.api.request(method, url, json=body)
                self.assertEqual(response.status_code, expected)
                db.rpc.assert_called_once()
                db.table.assert_not_called()

    def test_delete_is_atomic_and_validates_identifier(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = {'status': 'deleted'}
        with patch.object(calendar, 'get_user_supabase', return_value=(db, UID)):
            self.assertEqual(self.api.delete('/calendar/absences/' + EID).status_code, 200)
            self.assertEqual(self.api.delete('/calendar/absences/not-an-id').status_code, 422)
        db.rpc.assert_called_once_with('delete_absence_v1', {'p_absence_id': EID})
        db.table.assert_not_called()

    def test_old_client_cannot_cancel_without_reviewed_slot(self):
        with patch.object(calendar, 'get_user_supabase') as auth:
            item = dict(client_id=CID, absence_date='2026-10-14', absence_hour=9)
            self.assertEqual(self.api.post('/calendar/absences', json=item).status_code, 422)
            self.assertEqual(self.api.post('/calendar/absences/batch', json={'items': [item]}).status_code, 422)
            auth.assert_not_called()

    def test_schedule_mode_cannot_request_a_paid_cancellation(self):
        with patch.object(calendar, 'get_user_supabase') as auth:
            item = dict(client_id=CID, absence_date='2026-10-14', absence_hour=9,
                        mode='schedule', paid=True, expected_event_id=None, expected_updated_at=None)
            self.assertEqual(self.api.post('/calendar/absences', json=item).status_code, 422)
            self.assertEqual(self.api.post('/calendar/absences/batch', json={'items': [item]}).status_code, 422)
            auth.assert_not_called()
