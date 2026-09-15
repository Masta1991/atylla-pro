import sys,json
from pathlib import Path
from datetime import datetime,timedelta
root=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(root/'backend'))
from trainer_insights import overview
from billing import WARSAW
actual_now=datetime.now(WARSAW)
now=actual_now.replace(day=15,hour=12,minute=0)
past=(now-timedelta(days=1)).date().isoformat()
future=(now+timedelta(days=1)).date().isoformat()
id=lambda n:'00000000-0000-4000-8000-'+str(n).zfill(12)
clients=[{'id':id(i+1),'name':name,'billing_type':'package','package_size':10,'package_current_count':9,
          'active_package_id':id(i+10),'package_purchase_date':past,'shared_with':[],'training_schedule':[]} for i,name in enumerate(['Adam QA','Beata QA','Celina QA'])]
events=[{'id':id(20+i),'client_id':clients[i%3]['id'],'partner_client_id':id(2) if i==0 else None,
         'event_date':future if i==1 else past,'event_hour':9+i,'status':status,'is_settled':i==2,
         'clients':{'name':clients[i%3]['name']}} for i,status in enumerate(['active','active','cancelled','deleted','deleted'])]
absences=[{'id':id(40),'client_id':id(1),'absence_date':past,'absence_hour':12},
          {'id':id(41),'client_id':id(3),'absence_date':past,'absence_hour':15}]
results={}
for month in range(1,13):
    for client in ['',*[c['id'] for c in clients]]:
        results[f'{now.year}|{month}|{client}']=overview(events,absences,clients,now.year,month,client or None,now)
monday=(actual_now-timedelta(days=actual_now.weekday())).date().isoformat()
items=[{'key':f'item-{i}','kind':'schedule' if i<2 else 'other','client_id':c['id'],'name':c['name'],
        'source_date':monday,'event_hour':9+i,'main_group':'Plecy','added_groups':['Nogi'],
        'partner_client_id':id(2) if i==0 else None} for i,c in enumerate(clients)]
items[2]['original_client_id']=id(1)
(root/'.tmp/trainer-panels-20260915').mkdir(parents=True,exist_ok=True)
(root/'.tmp/trainer-panels-20260915/fixture.json').write_text(json.dumps({'clients':clients,'events':events,'overview':results,'manager':{'source':monday,'items':items,'clients':clients}},ensure_ascii=False),encoding='utf-8')
