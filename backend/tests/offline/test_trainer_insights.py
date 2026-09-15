import unittest
from datetime import datetime
from unittest.mock import patch, mock_open
from offline_support import MemoryDB, UID, CID, EID, TestClient, app
from routers import trainer
from trainer_insights import overview, session_rows, totals
from billing import WARSAW

NOW = datetime(2026,9,15,10,30,tzinfo=WARSAW)
def event(i, day='2026-09-15', hour=9, status='active', settled=False, **kw):
    return dict(id=str(i),trainer_id=UID,client_id=CID,event_date=day,event_hour=hour,status=status,is_settled=settled,**kw)
def absence(i, day='2026-09-15', hour=9, **kw):
    return dict(id=str(i),trainer_id=UID,client_id=CID,absence_date=day,absence_hour=hour,**kw)

class InsightsTests(unittest.TestCase):
    def test_four_states_and_session_identity(self):
        events=[event(1,partner_client_id='partner'),event(2,hour=10),event(3,hour=12,status='cancelled',settled=True),
                event(4,hour=13,status='cancelled'),event(5,hour=15,status='deleted'),event(6,hour=16,status='deleted')]
        rows=session_rows(events,[absence(1,hour=15)],{CID:'QA','partner':'Partner'},NOW)
        t=totals(rows)
        self.assertEqual([t[k] for k in ('done','planned','paid','free','unknown')],[1,1,1,2,0])
        self.assertEqual(t['clients_done'],2)
        self.assertEqual(t['total'],5) # The pair is one session, deleted template is excluded.

    def test_same_day_multiple_sessions_and_whole_day_dedup(self):
        events=[event(1,hour=9,status='deleted'),event(2,hour=12,status='deleted')]
        rows=session_rows(events,[absence(1,hour=None),absence(2,hour=9),absence(3,hour=9)],{CID:'QA'},NOW)
        self.assertEqual(totals(rows)['free'],2)
        self.assertEqual(totals(rows)['unknown'],0)

    def test_unmatched_absence_is_unknown_not_a_free_training(self):
        rows=session_rows([event(1,client_id_other='unrelated')],[absence(1,hour=None),absence(2,hour=14)],{CID:'QA'},NOW)
        self.assertEqual(totals(rows)['unknown'],2)
        self.assertEqual(totals(rows)['free'],0)
        self.assertTrue(all(not r['is_session'] for r in rows if r['state']=='unknown'))

    def test_selected_year_sunday_month_boundary_and_empty_months(self):
        events=[event(1,'2025-12-31'),event(2,'2026-01-04'),event(3,'2026-12-31')]
        data=overview(events,[],[{'id':CID,'name':'QA'}],2026,1,now=NOW)
        self.assertEqual(len(data['months']),12)
        self.assertEqual(data['months'][0]['done'],1)
        self.assertEqual(data['months'][11]['planned'],1)
        self.assertEqual(data['weeks'][0]['done'],1)
        self.assertEqual(data['previous_done'],1)

    def test_hour_boundary_in_warsaw_and_future_cancellation_denominator(self):
        events=[event(1,hour=9),event(2,hour=10),event(3,hour=13,status='cancelled')]
        t=totals(session_rows(events,[],{CID:'QA'},NOW))
        self.assertEqual(t['cancellation_rate'],0)
        self.assertEqual(t['done'],1)
        at_end=datetime(2026,9,15,11,tzinfo=WARSAW)
        self.assertEqual(totals(session_rows(events,[],{CID:'QA'},at_end))['done'],2)

    def test_api_complete_read_and_trainer_filter(self):
        db=MemoryDB({'calendar_events':[event(i,'2026-09-01') for i in range(1205)]+[{**event(2000),'trainer_id':'foreign'}],
                     'clients':[{'id':CID,'name':'QA','trainer_id':UID}],'absences':[]})
        with patch.object(trainer,'get_user_supabase',return_value=(db,UID)):
            response=TestClient(app).get('/trainer/overview?year=2026&month=9')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['totals']['done'],1205)

    def test_api_failed_page_is_error_not_partial_zero(self):
        db=MemoryDB({'clients':[]},fail=lambda query: query.name=='calendar_events' and query.action=='select')
        with patch.object(trainer,'get_user_supabase',return_value=(db,UID)), patch('builtins.open',mock_open()):
            response=TestClient(app,raise_server_exceptions=False).get('/trainer/overview?year=2026&month=9')
        self.assertEqual(response.status_code,500)

    def test_invalid_range_or_foreign_client_and_target(self):
        db=MemoryDB({'clients':[]})
        with patch.object(trainer,'get_user_supabase',return_value=(db,UID)):
            client=TestClient(app)
            self.assertEqual(client.get('/trainer/overview?year=2026&month=13').status_code,422)
            self.assertEqual(client.get('/trainer/overview?year=2026&month=9&client_id='+CID).status_code,404)
            self.assertEqual(client.get('/trainer/manager?source=2026-09-15').status_code,422)

    def test_copy_is_one_rpc_and_preview_does_not_commit(self):
        body={'target':'2026-09-21','items':[{'key':'qa','event_date':'2026-09-21','event_hour':9,'client_id':CID}]}
        with patch.object(trainer,'get_user_supabase',return_value=(object(),UID)),patch.object(trainer,'atomic_rpc',return_value={'rows':[]}) as rpc:
            client=TestClient(app)
            self.assertEqual(client.post('/trainer/copy-preview',json=body).status_code,200)
            self.assertFalse(rpc.call_args.args[2]['p_commit'])
            self.assertEqual(client.post('/trainer/copy',json=body).status_code,200)
            self.assertTrue(rpc.call_args.args[2]['p_commit'])
            self.assertEqual(rpc.call_count,2)

if __name__=='__main__': unittest.main()
