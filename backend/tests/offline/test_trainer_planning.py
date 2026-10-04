"""Synthetic planning tests: no production settings, data or writes."""
import unittest
from datetime import datetime
from unittest.mock import patch
from fastapi import FastAPI
from pydantic import ValidationError
from offline_support import MemoryDB, UID, CID, PID, TestClient
from billing import WARSAW
from trainer_planning import PlanningPreferences, analyze, default_preferences, history_context, periods
from routers import planning

NOW = datetime(2026, 10, 4, 12, tzinfo=WARSAW)
APP = FastAPI()
APP.include_router(planning.router)
CLIENTS = [{'id': CID, 'name': 'Ala'}, {'id': PID, 'name': 'Bartek'}]


def event(identifier, day, hour, **kwargs):
    return {'id': str(identifier), 'event_date': day, 'event_hour': hour, 'status': 'active',
            'client_id': CID, 'trainer_id': UID, **kwargs}


def rows():
    return [event('h1', '2026-09-07', 8), event('h2', '2026-09-07', 11),
            event('h3', '2026-09-14', 8), event('h4', '2026-09-14', 11),
            event('f1', '2026-10-05', 8), event('f2', '2026-10-05', 11)]


def run(events=None, prefs=None, answers=None, now=NOW):
    return analyze(rows() if events is None else events, CLIENTS, 3,
                   {**default_preferences(), **(prefs or {})}, {'gap:0:9:11': 'optimize'} if answers is None else answers, now)[0]


class PlanningEngineTests(unittest.TestCase):
    def test_defaults_and_periods_include_leap_year(self):
        prefs = default_preferences()
        self.assertEqual((prefs['start_hour'], prefs['session_minutes'], prefs['start_on_hour']), (6, 60, True))
        self.assertIsNone(prefs['allowed_weekdays'])
        self.assertIsNone(prefs['end_hour'])
        self.assertEqual(tuple(str(d) for d in periods(3, datetime(2024, 3, 1, tzinfo=WARSAW))),
                         ('2023-12-01', '2024-02-29', '2024-03-01', '2024-03-28'))
        self.assertEqual(str(periods(6, NOW)[0]), '2026-04-01')

    def test_strict_preference_validation(self):
        bad = [{'start_hour': 5}, {'session_minutes': 45}, {'start_on_hour': False}, {'start_on_hour': 1},
               {'end_hour': 6}, {'max_consecutive': 0}, {'allowed_weekdays': [True]}, {'allowed_weekdays': [0, 0]},
               {'allowed_weekdays': [7]}, {'session_price': float('nan')}, {'session_price': -1},
               {'locked_client_ids': [CID, CID]}, {'extra': 1},
               {'protected_windows': [{'weekday': 0, 'date': '2026-10-05', 'start_hour': 8, 'end_hour': 9}]},
               {'protected_windows': [{'weekday': 0, 'start_hour': 10, 'end_hour': 9}]}]
        for values in bad:
            with self.subTest(values=values), self.assertRaises(ValidationError):
                PlanningPreferences.model_validate(values)

    def test_counts_shared_once_cancelled_not_work_and_sparse_questions(self):
        data = rows()[:4] + [event('pair', '2026-09-15', 9, partner_client_id=PID),
                event('paid', '2026-09-15', 11, status='cancelled', is_settled=True),
                event('removed', '2026-09-15', 12, status='deleted'), event('block', '2026-09-15', 13, client_id=None)]
        context = history_context(data + [data[0]], 3, NOW)
        self.assertEqual(context['stats'], {'sessions': 5, 'days': 3, 'internal_gap_hours': 4})
        self.assertEqual(context['patterns'][0]['hits'], 2)
        self.assertEqual(context['patterns'][0]['observed_days'], 2)
        self.assertTrue(any(q['id'] == 'month:2026-07' for q in context['questions']))

    def test_time_move_and_income_are_independent_concrete_variants(self):
        result = run(prefs={'session_price': 150})
        self.assertEqual(len(result['proposals']), 2)
        move, income = result['proposals']
        self.assertEqual((move['before_end'], move['after_end'], move['saved_minutes']), (12, 10, 120))
        self.assertEqual(move['moves'][0]['to_hour'], 9)
        self.assertEqual(move['clients'], [{'id': CID, 'name': 'Ala'}])
        self.assertEqual(income['slot'], {'date': '2026-10-05', 'hour': 9})
        self.assertEqual(income['additional_revenue'], 150)
        self.assertEqual(income['clients'], [])
        self.assertTrue(all(p['status'] == 'do_uzgodnienia' for p in result['proposals']))

    def test_unknown_and_preserved_patterns_never_suggested(self):
        for answers in ({}, {'gap:0:9:11': 'unknown'}, {'gap:0:9:11': 'preserve'}):
            self.assertEqual(run(answers=answers)['proposals'], [])
        with self.assertRaises(ValueError):
            run(answers={'gap:0:9:11': 'yes'})
        with self.assertRaises(ValueError):
            run(answers={'stale': 'unknown'})

    def test_two_session_chain_only_when_more_time_saved_and_respects_locks(self):
        data=[event('first','2026-10-05',6),event('penultimate','2026-10-05',16,client_id=PID),event('last','2026-10-05',17)]
        result=run(data,prefs={'goal':'time'},answers={})
        proposal=result['proposals'][0]
        self.assertEqual(len(proposal['moves']),2)
        self.assertEqual(proposal['saved_minutes'],540)
        self.assertEqual([m['to_hour'] for m in proposal['moves']],[7,8])
        limited=run(data,prefs={'goal':'time','max_consecutive':2},answers={})['proposals'][0]
        self.assertEqual([m['to_hour'] for m in limited['moves']],[7,9])
        locked=run(data,prefs={'goal':'time','locked_client_ids':[PID]},answers={})['proposals'][0]
        self.assertEqual(len(locked['moves']),1)
        self.assertEqual(locked['saved_minutes'],60)

    def test_protected_date_and_weekday_windows(self):
        for window in ({'weekday': 0}, {'date': '2026-10-05'}):
            result = run(prefs={'protected_windows': [{**window, 'start_hour': 9, 'end_hour': 11}]})
            self.assertEqual(result['proposals'], [])

    def test_locked_pair_participant_prevents_move_not_new_session(self):
        data = rows()
        data[-1]['partner_client_id'] = PID
        result = run(data, {'locked_client_ids': [PID]})
        self.assertEqual([p['kind'] for p in result['proposals']], ['income'])
        move = run(data, {'goal': 'time'})['proposals'][0]
        self.assertEqual(move['moves'][0]['client_ids'], sorted([CID, PID]))

    def test_complete_day_limits_and_earliest_feasible_slot(self):
        self.assertEqual(run(prefs={'end_hour': 9})['proposals'], [])
        self.assertEqual(run(prefs={'allowed_weekdays': [1]})['proposals'], [])
        self.assertEqual(run(prefs={'allowed_weekdays': []})['proposals'], [])
        # A 9:00 insertion would create consecutive sessions. 10:00 move leaves two isolated slots.
        result = run(prefs={'max_consecutive': 1, 'goal': 'time'})
        self.assertEqual(result['proposals'][0]['moves'][0]['to_hour'], 10)
        self.assertEqual(run(prefs={'max_consecutive': 1, 'goal': 'income'})['proposals'], [])

    def test_blocks_unknown_status_and_collisions_are_conservative(self):
        for value in ({'client_id': None}, {'status': 'unknown'}):
            data = rows() + [event('b1', '2026-10-05', 9, **value), event('b2', '2026-10-05', 10, **value)]
            self.assertEqual(run(data)['proposals'], [])
        data = rows() + [event('collision', '2026-10-05', 8)]
        self.assertEqual(run(data)['proposals'], [])
        self.assertTrue(any('nakładającymi' in w for w in run(data)['warnings']))

    def test_busy_non_session_does_not_increment_consecutive_sessions(self):
        data=[event('early','2026-10-05',8),event('block','2026-10-05',9,client_id=None),event('last','2026-10-05',11)]
        report=run(data,prefs={'goal':'time','max_consecutive':2},answers={})
        move=report['proposals'][0]
        self.assertEqual(move['moves'][0]['to_hour'],10)
        self.assertEqual(move['saved_minutes'],60)

    def test_busy_non_session_inside_protected_window_is_not_training(self):
        data=[event('early','2026-10-05',8),event('block','2026-10-05',9,client_id=None),event('last','2026-10-05',11)]
        report=run(data,prefs={'goal':'time','protected_windows':[{'weekday':0,'start_hour':9,'end_hour':10}]},answers={})
        self.assertEqual(report['proposals'][0]['moves'][0]['to_hour'],10)

    def test_current_and_ended_slots_never_targets(self):
        now = datetime(2026, 10, 5, 9, tzinfo=WARSAW)
        result = run(now=now)
        self.assertTrue(all((p.get('slot') or {'hour': p['moves'][0]['to_hour']})['hour'] > 9 for p in result['proposals']))
        self.assertEqual(run(now=datetime(2026, 10, 5, 12, tzinfo=WARSAW))['proposals'], [])

    def test_no_history_is_not_availability_and_no_outer_slots(self):
        empty = run([], answers={})
        self.assertEqual(empty['proposals'], [])
        self.assertEqual(empty['stats']['sessions'], 0)
        single = run([event('single', '2026-10-05', 8)], answers={})
        self.assertEqual(single['proposals'], [])
        adjacent = run([event('1', '2026-10-05', 20), event('2', '2026-10-05', 21)], answers={})
        self.assertEqual(adjacent['proposals'], [])

    def test_sparse_month_answers_change_patterns_and_preserve_becomes_preference(self):
        result = run(answers={'gap:0:9:11': 'optimize', 'month:2026-09': 'incomplete'})
        self.assertEqual(result['patterns'], [])
        self.assertEqual(result['excluded_months'], ['2026-09'])
        self.assertEqual(result['stats']['sessions'], 4)
        self.assertTrue(any(q['id'] == 'gap:0:9:11' for q in result['questions']))
        preserved = run(answers={'gap:0:9:11': 'preserve'})
        windows = preserved['effective_preferences']['protected_windows']
        self.assertEqual(windows, [{'weekday': 0, 'date': None, 'start_hour': 9, 'end_hour': 11}])
        self.assertEqual(run(prefs={'protected_windows': windows})['proposals'], [])

    def test_sparse_month_compared_with_typical_session_volume(self):
        data = [event(f'{m}-{d}-{h}', f'2026-{m:02}-{d:02}', h)
                for m, days, hours in [(7, 7, [8, 9, 10]), (8, 20, list(range(8, 15))), (9, 20, list(range(8, 15)))]
                for d in range(1, days+1) for h in hours]
        report = history_context(data, 3, NOW)
        self.assertTrue(any(q['id'] == 'month:2026-07' for q in report['questions']))

    def test_unknown_history_patterns_beyond_question_limit_stay_protected(self):
        # Different length gaps on the same weekday generate more than24 recurring patterns.
        data = []
        from datetime import date, timedelta
        monday = date(2026, 7, 6)
        for index, (begin, finish) in enumerate((s,e) for s in range(7,14) for e in range(s+1,16)):
            if index >= 25:
                break
            # Use all seven weekdays to keep enough unique historical days in the period.
            day = monday + timedelta(days=index)
            for repetition in [0, 35]:
                stamp = str(day + timedelta(days=repetition))
                data += [event(f'{index}-{repetition}-a', stamp, begin-1), event(f'{index}-{repetition}-b', stamp, finish)]
        context = history_context(data, 3, NOW)
        self.assertEqual(len(context['patterns']),24)
        all_patterns=history_context(data,3,NOW,pattern_limit=None)['patterns']
        hidden=next(p for p in all_patterns if p['id'] not in {v['id'] for v in context['patterns']})
        target=str(date(2026,10,5)+timedelta(days=hidden['weekday']))
        data += [event('target-a',target,hidden['start_hour']-1),event('target-b',target,hidden['end_hour'])]
        report=run(data,answers={p['id']:'optimize' for p in context['patterns']})
        self.assertEqual(report['proposals'],[])

    def test_unsupported_sunday_and_unchanged_protected_session_block_proposals(self):
        data = [event('a', '2026-10-11', 8), event('b', '2026-10-11', 11)]
        self.assertEqual(run(data, answers={})['proposals'], [])
        data = rows() + [event('earlier', '2026-10-05', 6)]
        self.assertEqual(run(data, prefs={'protected_windows':[{'weekday':0,'start_hour':6,'end_hour':7}]})['proposals'], [])


class PlanningApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(APP)
        self.db = MemoryDB({'clients': [{**c, 'trainer_id': UID} for c in CLIENTS], 'calendar_events': rows()})
        self.admin=object()
        admin_patch=patch.object(planning,'get_supabase',return_value=self.admin)
        self.get_admin=admin_patch.start()
        self.addCleanup(admin_patch.stop)

    def payload(self, **extra):
        return {'request_id': '00000000-0000-4000-8000-000000000099', 'months': 3,
                'preferences': default_preferences(), 'answers': {}, 'save_preferences': False, 'expected_revision': 0, **extra}

    def test_defaults_and_missing_table_failure(self):
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)):
            self.assertEqual(self.client.get('/trainer/planning/preferences').json(), {'preferences': default_preferences(), 'revision': 0})
        self.db.fail = lambda q: q.name == 'trainer_planning_preferences'
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)):
            self.assertEqual(self.client.get('/trainer/planning/preferences').status_code, 503)

    def test_actor_scope_pagination_and_failure_no_partial_result(self):
        # Historical facts exceed the PostgREST page size; foreign facts never contribute.
        self.db.tables['calendar_events'] = [event(str(i), '2026-09-07', 8) for i in range(1001)] + [event('foreign', '2026-09-08', 9, trainer_id='other')]
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)), patch.object(planning, 'datetime') as clock:
            clock.now.return_value = NOW
            response = self.client.get('/trainer/planning/context?months=3')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['stats']['days'], 1)
        self.assertGreaterEqual(sum(op[0] == 'calendar_events' for op in self.db.operations), 2)
        self.db.fail = lambda q: q.name == 'calendar_events'
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)):
            self.assertEqual(self.client.get('/trainer/planning/context').status_code, 503)

    def test_invalid_months_and_foreign_locked_client(self):
        with patch.object(planning, 'get_user_supabase') as db:
            self.assertEqual(self.client.get('/trainer/planning/context?months=4').status_code, 422)
            db.assert_not_called()
        body = {'preferences': {**default_preferences(), 'locked_client_ids': [UID]}, 'expected_revision': 0}
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)), patch.object(planning, 'atomic_rpc') as rpc:
            self.assertEqual(self.client.put('/trainer/planning/preferences', json=body).status_code, 404)
            rpc.assert_not_called()

    def test_stale_revision_never_writes_and_single_atomic_save(self):
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)), patch.object(planning, 'atomic_rpc', return_value={'id': 'saved'}) as rpc, patch.object(planning, 'datetime') as clock:
            clock.now.return_value = NOW
            response = self.client.post('/trainer/planning/analyses', json=self.payload(expected_revision=1))
            self.assertEqual(response.status_code, 409)
            rpc.assert_not_called()
            response = self.client.post('/trainer/planning/analyses', json=self.payload())
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(rpc.call_count, 1)
            self.assertEqual(rpc.call_args.args[1], 'save_trainer_planning_analysis_v1')
            self.assertIs(rpc.call_args.args[0],self.admin)
            self.assertEqual(rpc.call_args.args[2]['p_actor'],UID)
            self.assertIn('questions', rpc.call_args.args[2]['p_snapshot'])

    def test_api_preserve_effective_preferences_are_sent_to_atomic_snapshot(self):
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)), patch.object(planning, 'atomic_rpc', return_value={'id': 'saved'}) as rpc, patch.object(planning, 'datetime') as clock:
            clock.now.return_value=NOW
            response=self.client.post('/trainer/planning/analyses',json=self.payload(answers={'gap:0:9:11':'preserve'},save_preferences=True))
            self.assertEqual(response.status_code,200,response.text)
            args=rpc.call_args.args[2]
            self.assertEqual(args['p_request']['preferences']['protected_windows'],[])
            self.assertEqual(args['p_snapshot']['preferences']['protected_windows'],[{'weekday':0,'date':None,'start_hour':9,'end_hour':11}])

    def test_replay_returns_exact_snapshot_before_recompute_and_collision(self):
        payload = self.payload()
        saved = {'id': payload['request_id'], 'trainer_id': UID, 'request_payload': payload,
                 'created_at': '2026-10-04T12:00:00Z', 'result': {'proposals': []}}
        self.db.tables['trainer_planning_analyses'] = [saved]
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)), patch.object(planning, 'atomic_rpc') as rpc:
            response = self.client.post('/trainer/planning/analyses', json=payload)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['created_at'], saved['created_at'])
            self.assertNotIn('request_payload', response.json())
            self.assertEqual(self.client.post('/trainer/planning/analyses', json=self.payload(months=6)).status_code, 409)
            rpc.assert_not_called()

    def test_snapshot_owned_and_missing_auth(self):
        foreign = {'id': CID, 'trainer_id': 'other', 'result': {'secret': True}}
        self.db.tables['trainer_planning_analyses'] = [foreign]
        with patch.object(planning, 'get_user_supabase', return_value=(self.db, UID)):
            self.assertEqual(self.client.get('/trainer/planning/analyses/' + CID).status_code, 404)
            self.assertEqual(self.client.get('/trainer/planning/analyses').json(), {'items': []})
        self.assertEqual(self.client.get('/trainer/planning/preferences').status_code, 401)
        self.assertEqual(self.client.post('/trainer/planning/analyses',json=self.payload()).status_code,401)
        self.get_admin.assert_not_called()

    def test_caller_cannot_supply_actor_or_computed_snapshot(self):
        for extra in ({'p_actor':CID},{'result':{'proposals':[]}},{'snapshot':{'result':{'forged':True}}}):
            with patch.object(planning,'get_user_supabase') as auth:
                response=self.client.post('/trainer/planning/analyses',json=self.payload(**extra))
                self.assertEqual(response.status_code,422)
                auth.assert_not_called()
        self.get_admin.assert_not_called()


if __name__ == '__main__':
    unittest.main()
