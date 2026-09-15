"""Independent oracles + real route projections on synthetic histories."""
import copy
import random
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch, Mock
from offline_support import CID, UID, EID, EID2, PID, MemoryDB, event, calendar, clients, HTTPException
from billing import project_package, slot_done, WARSAW
from models import AbsenceCreate, ClientResponse


def pkg(**extra):
    return dict(id=PID, client_id=CID, start_training_id=EID,
                end_training_id=None, size=10, offset=0, **extra)


def client(cid=CID):
    return {'id': cid, 'name': 'Synthetic', 'billing_type': 'package',
            'created_at': '2026-09-01T00:00:00Z', 'updated_at': '2026-09-01T00:00:00Z'}


class BillingSequences(unittest.TestCase):
    def project(self, rows, package=None):
        p = package or pkg()
        enriched = [{**e, 'clients': client()} for e in rows]
        db = MemoryDB({'calendar_events': enriched, 'client_packages': [p]})
        with patch.object(calendar, '_slot_done', side_effect=lambda d,h: d <= '2026-09-10'), \
             patch.object(clients, '_slot_done', side_effect=lambda d,h: d <= '2026-09-10'):
            tiles = calendar.assign_chronological_numbers(copy.deepcopy(enriched), db)
            count = clients.assign_client_packages_status([client()], db)[0]
        return count, tiles

    def test_late_paid_absence_counts_once_and_keeps_start(self):
        first = {**event(day='2026-09-10'), 'status': 'cancelled', 'is_settled': True}
        for _ in range(3):
            count, tiles = self.project([first, event(EID2, '2026-09-11')])
            self.assertEqual(count['package_current_count'], 1)
            self.assertTrue(tiles[0]['is_start_of_package'])
            self.assertEqual(tiles[0]['tile_number'], 1)

    def test_free_absence_moves_start_to_next_future_session(self):
        first = {**event(day='2026-09-10'), 'status': 'deleted', 'is_settled': False}
        count, tiles = self.project([first, event(EID2, '2026-09-11')])
        self.assertEqual(count['package_current_count'], 0)
        self.assertEqual(count['effective_start_training_id'], EID2)
        self.assertEqual(count['package_purchase_date'], '2026-09-11')
        self.assertFalse(tiles[0]['is_start_of_package'])
        self.assertTrue(tiles[1]['is_start_of_package'])
        self.assertEqual(tiles[1]['tile_number'], 1)

    def test_waiting_package_survives_reload_and_new_booking(self):
        first = {**event(day='2026-09-10'), 'status': 'deleted'}
        count, _ = self.project([first])
        self.assertTrue(count['package_pending_start'])
        self.assertEqual(count['active_package_id'], PID)
        self.assertEqual(count['package_size'], 10)
        self.assertEqual(count['package_current_count'], 0)
        self.assertIsNone(count['package_purchase_date'])
        self.assertTrue(ClientResponse(**count).package_pending_start)
        count, tiles = self.project([first, event(EID2, '2026-10-01')])
        self.assertFalse(count['package_pending_start'])
        self.assertEqual(count['active_package_id'], PID)
        self.assertTrue(tiles[1]['is_start_of_package'])

    def test_multiple_free_absences_and_paid_free_paid_correction(self):
        a = event(day='2026-09-10')
        b = {**event(EID2, '2026-09-11'), 'status': 'cancelled', 'is_settled': False}
        for status, paid, expected in [('cancelled', True, 1), ('deleted', False, 0), ('cancelled', True, 1)]:
            a.update(status=status, is_settled=paid)
            count, _ = self.project([a, b])
            self.assertEqual(count['package_current_count'], expected)

    def test_exact_slot_end_warsaw_in_summer_and_winter(self):
        for day in ['2026-09-10', '2026-12-10', '2026-03-29', '2026-10-25']:
            end = datetime.fromisoformat(day+'T12:00:00').replace(tzinfo=WARSAW)
            self.assertFalse(slot_done(day, 11, end-timedelta(microseconds=1)))
            self.assertTrue(slot_done(day, 11, end))
            self.assertTrue(slot_done(day, 11, end.astimezone(__import__('datetime').timezone.utc)))

    def test_offset_affects_both_count_and_tile(self):
        p = pkg(); p['offset'] = 3
        count, tiles = self.project([event()], p)
        self.assertEqual(count['package_current_count'], 4)
        self.assertEqual(tiles[0]['tile_number'], 4)

    def test_missing_anchor_fails_instead_of_showing_zero(self):
        with self.assertRaises(HTTPException):
            self.project([event(EID2)])

    def test_reassigned_anchor_is_boundary_not_a_counted_training(self):
        other='00000000-0000-4000-8000-000000000022'
        rows=[{**event(), 'client_id':other, 'clients':client(other)},
              {**event(EID2,'2026-09-02'), 'clients':client()}]
        db=MemoryDB({'clients':[client(),client(other)],'client_packages':[pkg()],
                     'calendar_events':rows})
        with patch.object(clients,'get_user_supabase',return_value=(db,UID)):
            count=clients.get_client(CID,None)
        self.assertEqual(count['package_current_count'],1)
        self.assertEqual(count['effective_start_training_id'],EID2)
        tiles=calendar.assign_chronological_numbers([copy.deepcopy(rows[1])],db)
        self.assertEqual(tiles[0]['tile_number'],1)
        self.assertTrue(tiles[0]['is_start_of_package'])
        self.assertTrue(all(action=='select' for _,action,_ in db.operations))

    def test_reassigned_only_anchor_leaves_existing_package_pending(self):
        row={**event(), 'client_id':None}
        db=MemoryDB({'client_packages':[pkg()], 'calendar_events':[row]})
        out=clients.assign_client_packages_status([client()],db)[0]
        self.assertTrue(out['package_pending_start'])
        self.assertEqual(out['active_package_id'],PID)
        self.assertEqual(out['package_current_count'],0)

    def test_missing_or_inaccessible_anchor_still_blocks_client_counter(self):
        db=MemoryDB({'client_packages':[pkg()], 'calendar_events':[event(EID2)]})
        with self.assertRaises(HTTPException) as exc:
            clients.assign_client_packages_status([client()],db)
        self.assertEqual(exc.exception.status_code,409)
        self.assertTrue(all(action=='select' for _,action,_ in db.operations))

    def test_boundary_read_failure_does_not_become_pending_or_zero(self):
        db=MemoryDB({'client_packages':[pkg()], 'calendar_events':[{**event(),'client_id':None}]},
                    fail=lambda q:q.name=='calendar_events' and q.columns=='id,client_id,event_date,event_hour,status,is_settled')
        with self.assertRaises(RuntimeError):
            clients.assign_client_packages_status([client()],db)

    def test_closed_reassigned_end_limits_history_without_counting_other_client(self):
        other='00000000-0000-4000-8000-000000000022'
        package={**pkg(),'end_training_id':EID2}
        last='00000000-0000-4000-8000-000000000023'
        rows=[{**event(), 'clients':client()},
              {**event(EID2,'2026-09-02'),'client_id':other,'clients':client(other)},
              {**event(last,'2026-09-03'), 'clients':client()}]
        db=MemoryDB({'client_packages':[package], 'calendar_events':rows})
        tiles=calendar.assign_chronological_numbers([copy.deepcopy(rows[0]),copy.deepcopy(rows[2])],db)
        self.assertEqual(tiles[0]['tile_number'],1)
        self.assertIsNone(tiles[1].get('tile_number'))

    def test_randomized_histories_match_independent_oracle(self):
        rng = random.Random(20260913)
        for case in range(200):
            rows = []
            for i in range(30):
                e = event(EID if i == 0 else f'r{case}-{i}', f'2026-09-{i+1:02}')
                e.update(status=rng.choice(['active', 'deleted', 'cancelled']), is_settled=rng.choice([True, False]))
                rows.append(e)
            expected = sum((e['status'] == 'active' and e['event_date'] <= '2026-09-10') or
                           (e['status'] == 'cancelled' and e['is_settled']) for e in rows)
            count, tiles = self.project(rows)
            self.assertEqual(count['package_current_count'], expected)
            positions = [t['tile_number'] for t in tiles if t.get('tile_number') is not None]
            self.assertEqual(positions, list(range(1, len(positions)+1)))

    def test_absence_uses_one_rpc_with_explicit_payment(self):
        db = Mock()
        db.rpc.return_value.execute.return_value.data = {'id': EID}
        with patch.object(calendar, 'get_user_supabase', return_value=(db,UID)):
            calendar.create_absence(AbsenceCreate(client_id=CID, absence_date='2026-09-10', absence_hour=11, paid=False), None)
        db.table.assert_not_called()
        args = db.rpc.call_args.args
        self.assertEqual(args[0], 'record_absence_v3')
        self.assertIs(args[1]['p_payload']['paid'], False)

    def test_long_history_is_not_truncated_at_1000(self):
        rows = [event(EID if i==0 else f'row-{i}', '2026-09-01') for i in range(1050)]
        count, tiles = self.project(rows)
        self.assertEqual(count['package_current_count'], 1050)
        self.assertEqual(max(t['tile_number'] for t in tiles), 1050)

    def test_shared_member_only_week_includes_owner_anchor(self):
        member='00000000-0000-4000-8000-000000000021'
        p=pkg(shared_client_ids=[member])
        rows=[{**event(), 'clients':client()}, {**event(EID2,'2026-09-02'), 'client_id':member,'clients':client(member)}]
        db=MemoryDB({'clients':[client(),client(member)],'client_packages':[p],'calendar_events':rows})
        tiles=calendar.assign_chronological_numbers([copy.deepcopy(rows[1])],db)
        self.assertEqual(tiles[0]['tile_number'],2)
        with patch.object(clients,'get_user_supabase',return_value=(db,UID)):
            self.assertEqual(clients.get_client(member,None)['package_current_count'],2)

    def test_duplicate_open_packages_rejected(self):
        p2={**pkg(),'id':'another'}
        db=MemoryDB({'client_packages':[pkg(),p2],'calendar_events':[event()]})
        with self.assertRaises(HTTPException) as exc:
            clients.assign_client_packages_status([client()],db)
        self.assertEqual(exc.exception.status_code,409)

    def test_dictionary_failure_never_becomes_fake_zero(self):
        db=MemoryDB({'client_packages':[pkg()],'calendar_events':[event()]},fail=lambda q:q.name=='absences')
        with self.assertRaises(RuntimeError):
            clients.assign_client_packages_status([client()],db)

    def test_light_calendar_read_skips_billing_queries(self):
        db=MemoryDB({'calendar_events':[event()]})
        with patch.object(calendar,'get_user_supabase',return_value=(db,UID)),patch.object(calendar,'assign_chronological_numbers') as billing:
            rows=calendar.list_events(None,None,CID,False,False,None)
        self.assertEqual(len(rows),1)
        billing.assert_not_called()
        self.assertEqual({o[0] for o in db.operations},{'calendar_events'})

    def test_empty_slot_returns_404_not_database_single_error(self):
        with patch.object(calendar,'get_user_supabase',return_value=(MemoryDB(),UID)):
            with self.assertRaises(HTTPException) as exc:
                calendar.get_event('2026-09-10',11,None)
        self.assertEqual(exc.exception.status_code,404)

    def test_deleted_slot_available_only_when_explicitly_requested(self):
        row={**event(),'status':'deleted'}
        db=MemoryDB({'calendar_events':[row]})
        with patch.object(calendar,'get_user_supabase',return_value=(db,UID)):
            with self.assertRaises(HTTPException):
                calendar.get_event('2026-09-01',10,None)
            self.assertEqual(calendar.get_event('2026-09-01',10,None,True)['id'],EID)
