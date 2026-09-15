"""API regressions using synthetic storage; no remote database or network."""
import unittest
from unittest.mock import patch
from offline_support import app, TestClient, MemoryDB, UID, EID, PID, EXID
from routers import config_router


class PlanLibraryTests(unittest.TestCase):
    def test_explicit_null_unlinks_superset_without_erasing_sets(self):
        db = MemoryDB({'plan_exercises': [dict(id=EID, superset_id=PID, sets_data=[{'reps': 4, 'weight': 30}], sort_order=3)]})
        with TestClient(app) as client, patch.object(config_router, 'get_user_supabase', return_value=(db, UID)):
            response = client.put(f'/config/plan-exercises/{EID}', json={'superset_id': None})
            self.assertEqual(response.status_code, 200)
            self.assertIsNone(response.json()['superset_id'])
            self.assertEqual(response.json()['sets_data'], [{'reps': 4, 'weight': 30}])
            self.assertEqual(response.json()['sort_order'], 3)

    def test_omitted_superset_survives_sets_and_order_update(self):
        db = MemoryDB({'plan_exercises': [dict(id=EID, superset_id=PID, sets_data=[], sort_order=0)]})
        with TestClient(app) as client, patch.object(config_router, 'get_user_supabase', return_value=(db, UID)):
            response = client.put(f'/config/plan-exercises/{EID}', json={'sets_data': [{'weight': '1.5', 'reps': '2'}], 'sort_order': 1})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['superset_id'], PID)
            self.assertEqual(response.json()['sets_data'][0]['weight'], '1.5')

    def test_grouped_library_retains_group_id_order_and_unit(self):
        db = MemoryDB({'muscle_groups': [dict(id=PID, name='Cardio')], 'exercises': [dict(id=EXID, name='Bieg', muscle_group_id=PID, sort_order=2, unit='KM')]})
        with TestClient(app) as client, patch.object(config_router, 'get_user_supabase', return_value=(db, UID)):
            response = client.get('/config/exercises/by-group')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['Cardio'][0], dict(id=EXID, name='Bieg', muscle_group_id=PID, sort_order=2, unit='KM'))
