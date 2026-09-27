import copy
import unittest
from unittest.mock import patch
from offline_support import MemoryDB, UID, CID, EID, EID2, event, TestClient, app, calendar
from workout_notes import attach_note_reminders, note_text


class WorkoutNotesTests(unittest.TestCase):
    def test_reminder_crosses_week_and_persists_on_every_later_session(self):
        source = event(day='2026-09-18', note='Pamiętaj o barku')
        monday = event(EID2, '2026-09-21')
        friday = event('next', '2026-09-25')
        result = attach_note_reminders([monday, friday], MemoryDB({'calendar_events': [source]}))
        self.assertEqual([[n['id'] for n in e['pending_notes']] for e in result], [[EID], [EID]])

    def test_same_day_order_own_note_and_other_clients_are_not_reminders(self):
        source = event(note='Pierwsza')
        target = event(EID2, event_hour_other=12)
        target['event_hour'] = 12
        foreign = event('foreign', note='Inny klient'); foreign['client_id'] = 'other'
        result = attach_note_reminders([source, target], MemoryDB({'calendar_events': [source, foreign]}))
        self.assertEqual(result[0]['pending_notes'], [])
        self.assertEqual([n['id'] for n in result[1]['pending_notes']], [EID])

    def test_empty_billing_read_cancelled_and_deleted_notes_are_skipped(self):
        rows = [event(str(i), note=note) for i, note in enumerate(['', ' \n ', '[BILLING:KONIEC_PAKIETU]', 'Read', 'Cancelled', 'Deleted'])]
        rows[3]['note_acknowledged_at'] = '2026-09-02T00:00:00Z'
        rows[4]['status'] = 'cancelled'; rows[5]['status'] = 'deleted'
        result = attach_note_reminders([event(EID2, '2026-09-21')], MemoryDB({'calendar_events': rows}))
        self.assertEqual(result[0]['pending_notes'], [])
        self.assertEqual(note_text('[BILLING:KONIEC_PAKIETU]\nWażna notatka'), 'Ważna notatka')

    def test_pairs_are_matched_in_both_directions_without_duplicate_notes(self):
        source = event(note='Wspólna', partner_client_id='partner')
        partner = event(EID2, '2026-09-21'); partner['client_id'] = 'partner'
        both = event('both', '2026-09-22', partner_client_id='partner')
        result = attach_note_reminders([partner, both], MemoryDB({'calendar_events': [source]}))
        self.assertEqual([len(e['pending_notes']) for e in result], [1, 1])

    def test_over_1000_sources_are_complete_and_newest_first(self):
        rows = [event(str(i).zfill(6), note=f'Note {i}') for i in range(1005)]
        rows.append(event('latest', '2026-09-20', note='Nowa'))
        result = attach_note_reminders([event(EID2, '2026-09-21')], MemoryDB({'calendar_events': rows}))
        self.assertEqual(len(result[0]['pending_notes']), 1006)
        self.assertEqual(result[0]['pending_notes'][0]['id'], 'latest')

    def test_read_failure_is_not_silently_presented_as_no_notes(self):
        with self.assertRaises(RuntimeError):
            attach_note_reminders([event()], MemoryDB({'calendar_events': []}, fail=lambda *args: True))

    def test_api_ack_uses_only_authenticated_rpc_and_expected_text(self):
        with TestClient(app) as api, patch.object(calendar, 'get_user_supabase', return_value=(object(), UID)), patch.object(calendar, 'atomic_rpc', return_value={'id': EID}) as rpc:
            response = api.post(f'/calendar/notes/{EID}/read', json={'expected_note': 'Pełna notatka'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(rpc.call_args.args[1:], ('acknowledge_workout_note_v1', {'p_event_id': EID, 'p_expected_note': 'Pełna notatka'}))

    def test_api_ack_rejects_anonymous_and_invalid_input(self):
        with TestClient(app) as api:
            self.assertEqual(api.post(f'/calendar/notes/{EID}/read', json={'expected_note': 'x'}).status_code, 401)
            self.assertEqual(api.post('/calendar/notes/not-an-id/read', json={'expected_note': 'x'}).status_code, 422)

    def test_missing_migration_returns_explicit_unavailable(self):
        from postgrest.exceptions import APIError
        db = MemoryDB()
        with TestClient(app) as api, patch.object(calendar, 'get_user_supabase', return_value=(db, UID)), patch.object(calendar, 'assign_chronological_numbers', side_effect=APIError({'code': '42703', 'message': 'missing column', 'details': None, 'hint': None})):
            response = api.get('/calendar/week/2026-09-21')
            self.assertEqual(response.status_code, 503)
            self.assertIn('aktualizacji bazy', response.json()['detail'])
