// History boundaries include hour; one database event means one training.
export function slotHasEnded(day, hour, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',
  }).formatToParts(now).map(p=>[p.type,p.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`;
  return today>day || (today===day && Number(parts.hour)>=Number(hour)+1);
}

export function packageTrainingRows(item, isPackage, clientEvents, clientAbsences, isSlotPassed) {
  const key=e=>`${e.event_date}|${String(e.event_hour).padStart(2,'0')}`;
  const events=[...(clientEvents||[])].sort((a,b)=>key(a).localeCompare(key(b)));
  let from=item.purchase_date||'0000-00-00', to=item.end_date||null, lower=null, upper=null;
  if(isPackage){
    const start=events.find(e=>e.id===item.start_training_id), end=events.find(e=>e.id===item.end_training_id);
    if(!start||(item.end_training_id&&!end))return {rows:[],done:0,cSettled:0,cFree:0,from:'Brak danych',to:null,incomplete:true};
    from=start.event_date;to=end?.event_date||null;lower=key(start);upper=end?key(end):null;
  }
  const members=isPackage?new Set([item.client_id,...(item.shared_client_ids||[])]):null;
  const inRange=events.filter(e=>(!members||members.has(e.client_id))&&e.event_date>=from&&(!to||e.event_date<=to)
    &&(!lower||key(e)>=lower)&&(!upper||key(e)<=upper));
  const rows=inRange.map(e=>({key:e.id,date:e.event_date,hour:e.event_hour,partner:e.partner_name||null,
    state:e.status==='deleted'?'cancel':e.status==='cancelled'?(e.is_settled?'cancel-settled':'cancel'):
      (isSlotPassed(e.event_date,e.event_hour)?'done':'planned')}));
  const seen=new Set(inRange.map(e=>`${e.client_id}|${key(e)}`));
  for(const a of clientAbsences||[]){
    const k=`${a.absence_date}|${String(a.absence_hour).padStart(2,'0')}`;
    if((members&&!members.has(a.client_id))||a.absence_date<from||(to&&a.absence_date>to))continue;
    if(a.absence_hour!=null&&((lower&&k<lower)||(upper&&k>upper)))continue;
    const id=`${a.client_id}|${k}`;
    if(seen.has(id))continue;
    if(a.absence_hour==null&&inRange.some(e=>e.client_id===a.client_id&&e.event_date===a.absence_date))continue;
    seen.add(id);rows.push({key:`abs-${a.id||id}`,date:a.absence_date,hour:a.absence_hour,state:'cancel-free'});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.hour??0)-(b.hour??0));
  return {rows,done:rows.filter(r=>r.state==='done').length,cSettled:rows.filter(r=>r.state==='cancel-settled').length,
    cFree:rows.filter(r=>r.state==='cancel'||r.state==='cancel-free').length,from,to};
}
