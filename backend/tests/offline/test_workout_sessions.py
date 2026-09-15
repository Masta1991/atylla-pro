"""Event scoped editor reads and write confirmation; synthetic API only."""
import types
import unittest
from unittest.mock import patch
from offline_support import app, calendar, workouts, TestClient, MemoryDB, UID, CID, EID, EID2, EXID, NOW
from postgrest.exceptions import APIError

class SessionApiTests(unittest.TestCase):
    def test_editor_reads_only_requested_event_and_date_history_still_aggregates(self):
        logs=[dict(id=EID,client_id=CID,exercise_id=EXID,session_date='2020-02-01',
            week_number=1,created_at=NOW,updated_at=NOW,calendar_event_id=EID,weight_kg=10),
            dict(id=EID2,client_id=CID,exercise_id=EXID,session_date='2020-02-01',
            week_number=1,created_at=NOW,updated_at=NOW,calendar_event_id=EID2,weight_kg=20)]
        db=MemoryDB({'workout_logs':logs})
        with TestClient(app) as api, patch.object(workouts,'get_user_supabase',return_value=(db,UID)):
            one=api.get(f'/workouts/client/{CID}?session_date=2020-02-01&calendar_event_id={EID}')
            self.assertEqual(one.status_code,200)
            self.assertEqual([x['weight_kg'] for x in one.json()],[10])
            both=api.get(f'/workouts/client/{CID}?session_date=2020-02-01')
            self.assertEqual(len(both.json()),2)

    def test_save_uses_v4_and_passes_explicit_confirmation(self):
        db=types.SimpleNamespace()
        with TestClient(app) as api, patch.object(calendar,'get_user_supabase',return_value=(db,UID)), patch.object(calendar,'atomic_rpc',return_value={'event':{},'logs':[]}) as rpc:
            result=api.post('/calendar/save-workout',json={'client_id':CID,'event_date':'2020-02-01','event_hour':12,'confirm_duplicate':True,'exercises':[]})
            self.assertEqual(result.status_code,200)
            self.assertEqual(rpc.call_args.args[1],'save_calendar_workout_v4')
            self.assertTrue(rpc.call_args.args[2]['p_payload']['confirm_duplicate'])

    def test_duplicate_is_machine_readable_and_does_not_retry(self):
        from database import atomic_rpc
        from unittest.mock import Mock
        from fastapi import HTTPException
        db=Mock()
        db.rpc.return_value.execute.side_effect=APIError({'code':'P0001','message':'DUPLICATE_SESSION_CONFIRMATION_REQUIRED','details':None,'hint':None})
        with self.assertRaises(HTTPException) as cm: atomic_rpc(db,'save_calendar_workout_v4',{})
        self.assertEqual(cm.exception.status_code,409)
        self.assertEqual(cm.exception.detail['code'],'duplicate_session')
        self.assertEqual(db.rpc.call_count,1)
