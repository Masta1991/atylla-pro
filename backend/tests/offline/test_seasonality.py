import unittest
from datetime import datetime
from unittest.mock import patch, Mock
from offline_support import MemoryDB, UID, CID, TestClient, app
from routers import trainer
from billing import WARSAW
from seasonality import seasonality_report

NOW = datetime(2026, 10, 2, 12, tzinfo=WARSAW)
def event(i, day, status='active', paid=False):
    return {'id':str(i),'trainer_id':UID,'event_date':day,'event_hour':9,'status':status,'is_settled':paid}
def manual(year, month, count):
    return {'trainer_id':UID,'year':year,'month':month,'training_count':count,'updated_at':'2026-09-01T12:00:00Z'}
def cell(report, year, month):
    return next(c for c in report['cells'] if (c['year'],c['month'])==(year,month))

class SeasonalityTests(unittest.TestCase):
    def test_unique_sessions_paid_only_and_future_not_ranked(self):
        rows=[event(1,'2025-02-01'),event(1,'2025-02-01'),event(2,'2025-02-02','cancelled',True),event(3,'2025-02-03','cancelled'),event(4,'2025-02-04','deleted'),event(5,'2026-11-01','cancelled',True)]
        report=seasonality_report(rows,[],2025,2026,'2024-01-01',NOW)
        self.assertEqual(cell(report,2025,2)['count'],2)
        self.assertIsNone(cell(report,2026,11)['count'])
        self.assertEqual(len(report['best']),1)

    def test_manual_replaces_not_adds_and_zero_is_not_missing(self):
        rows=[event(1,'2025-01-10')]
        report=seasonality_report(rows,[manual(2025,1,10),manual(2025,2,0)],2025,2025,'2025-01-10',NOW)
        self.assertEqual(cell(report,2025,1)['count'],10)
        self.assertEqual(cell(report,2025,1)['app_count'],1)
        self.assertEqual(cell(report,2025,2)['count'],0)
        self.assertIsNone(cell(report,2025,3)['count'])
        restored=seasonality_report(rows,[],2025,2025,'2024-01-10',NOW)
        self.assertEqual(cell(restored,2025,1)['count'],1)
        self.assertEqual(cell(restored,2025,2)['source'],'missing')

    def test_first_observed_and_current_month_excluded(self):
        report=seasonality_report([event(1,'2025-01-15'),event(2,'2026-10-01')],[],2025,2026,'2025-01-15',NOW)
        self.assertTrue(cell(report,2025,1)['partial'])
        self.assertTrue(cell(report,2026,10)['partial'])
        self.assertEqual(report['best'],[])

    def test_seasonality_normalized_within_year_and_requires_complete_years(self):
        history=[manual(y,m,(m if m!=10 else 20)*scale) for y,scale in [(2023,1),(2024,10)] for m in range(1,13)]
        report=seasonality_report([],history,2023,2025,now=NOW)
        self.assertEqual(report['comparable_years'],[2023,2024])
        self.assertTrue(report['seasonal'][0]['recurring_quiet'])
        self.assertTrue(report['seasonal'][9]['recurring_busy'])
        self.assertEqual(report['seasonal'][0]['samples'],2)
        incomplete=seasonality_report([],history[:-1],2023,2025,now=NOW)
        self.assertFalse(any(m['recurring_quiet'] for m in incomplete['seasonal']))

    def test_flat_or_zero_year_does_not_invent_pattern(self):
        history=[manual(y,m,0 if y==2023 else 10) for y in [2023,2024] for m in range(1,13)]
        report=seasonality_report([],history,2023,2024,now=NOW)
        self.assertEqual(report['comparable_years'],[])
        self.assertFalse(any(m['recurring_busy'] for m in report['seasonal']))

    def test_api_actor_scope_pagination_and_global_history_boundary(self):
        rows=[event(i,'2025-02-02') for i in range(1100)]+[event('old','2020-01-01'),{**event('foreign','2025-02-02'),'trainer_id':'other'}]
        db=MemoryDB({'calendar_events':rows,'trainer_monthly_history':[manual(2025,3,0),{**manual(2025,4,900),'trainer_id':'other'}]})
        with patch.object(trainer,'get_user_supabase',return_value=(db,UID)):
            res=TestClient(app).get('/trainer/seasonality?start_year=2025&end_year=2025')
        self.assertEqual(res.status_code,200,res.text)
        self.assertEqual(cell(res.json(),2025,2)['count'],1100)
        self.assertFalse(cell(res.json(),2025,2)['partial'])
        self.assertIsNone(cell(res.json(),2025,4)['count'])

    def test_missing_migration_is_unavailable_not_empty(self):
        db=MemoryDB({},fail=lambda q:q.name=='trainer_monthly_history')
        with patch.object(trainer,'get_user_supabase',return_value=(db,UID)):
            res=TestClient(app).get('/trainer/seasonality?start_year=2025&end_year=2025')
        self.assertEqual(res.status_code,503)

    def test_write_validation_strict_int_past_month_and_single_rpc(self):
        client=TestClient(app)
        with patch.object(trainer,'get_user_supabase',return_value=(object(),UID)),patch.object(trainer,'atomic_rpc',return_value={'ok':True}) as rpc:
            for value in [-1,10001,1.5,True,'12']:
                self.assertEqual(client.put('/trainer/history/2020/1',json={'training_count':value}).status_code,422)
            self.assertEqual(client.put('/trainer/history/2100/1',json={'training_count':1}).status_code,422)
            self.assertEqual(client.put('/trainer/history/2020/13',json={'training_count':1}).status_code,422)
            rpc.assert_not_called()
            self.assertEqual(client.put('/trainer/history/2020/1',json={'training_count':0}).status_code,200)
            self.assertEqual(rpc.call_count,1)
            self.assertEqual(rpc.call_args.args[2],{'p_year':2020,'p_month':1,'p_count':0,'p_expected':None})
            self.assertEqual(client.delete('/trainer/history/2020/1').status_code,422)
            res=client.request('DELETE','/trainer/history/2020/1',json={'expected_updated_at':'2026-01-01T00:00:00Z'})
            self.assertEqual(res.status_code,200)
            self.assertEqual(rpc.call_args.args[1],'delete_trainer_month_v1')

    def test_invalid_year_range_does_not_read(self):
        with patch.object(trainer,'get_user_supabase') as get_db:
            client=TestClient(app)
            for query in ['start_year=2026&end_year=2020','start_year=2000&end_year=2026','start_year=1999&end_year=2000']:
                self.assertEqual(client.get('/trainer/seasonality?'+query).status_code,422)
            get_db.assert_not_called()

if __name__=='__main__': unittest.main()
