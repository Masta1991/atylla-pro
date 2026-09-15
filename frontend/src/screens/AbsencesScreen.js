import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AppLayout from '../components/AppLayout';
import DropdownPicker from '../components/DropdownPicker';
import { MonthPicker, useOverview, usePanelTheme, LoadState, SessionList, PanelButton } from '../components/TrainerPanels';

export default function AbsencesScreen({navigation}) {
  const now=new Date();
  const [period,setPeriod]=useState({year:now.getFullYear(),month:now.getMonth()+1});
  const [client,setClient]=useState(''),[filter,setFilter]=useState('all');
  const {s,palette,T}=usePanelTheme();
  const {data,loading,error,load}=useOverview(period.year,period.month,client);
  const rows=(data?.rows||[]).filter(r=>['paid','free','unknown'].includes(r.state));
  const filtered=filter==='all'?rows:rows.filter(r=>r.state===filter);
  return <AppLayout navigation={navigation} title="Absencje" showBack>
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.heading}>Podgląd absencji</Text>
      <Text style={s.muted}>Odwołane treningi i zgłoszenia w wybranym miesiącu. Zmiany wykonasz przy terminie w kalendarzu.</Text>
      <MonthPicker {...period} onChange={(year,month)=>setPeriod({year,month})}/>
      <DropdownPicker placeholder="Filtr klienta" selectedValue={client} onValueChange={setClient}
        items={[{label:'Wszyscy klienci',value:''},...(data?.clients||[]).map(c=>({label:c.name,value:c.id}))]}/>
      <LoadState loading={loading} error={error} retry={load}/>
      {!loading&&data&&<>
        <View style={s.grid}>
          {[['all','Odwołane treningi',(data.totals.paid||0)+(data.totals.free||0)],['paid','Opłacone',data.totals.paid],['free','Nieopłacone',data.totals.free]].map(([key,label,value])=>
            <PanelButton key={key} selected={filter===key} onPress={()=>setFilter(key)} style={[s.card,s.metric]} label={`${label}: ${value}`}>
              <Text style={[s.number,{color:palette[key]||T.text}]}>{value}</Text><Text style={s.text}>{label}</Text>
            </PanelButton>)}
        </View>
        {data.totals.unknown>0&&<PanelButton selected={filter==='unknown'} onPress={()=>setFilter('unknown')}>
          <Text style={s.title}>Brak danych o rozliczeniu · {data.totals.unknown}</Text>
          <Text style={s.muted}>Zgłoszenia bez powiązanego odwołanego treningu. Nie są doliczane do liczby odwołanych sesji.</Text>
        </PanelButton>}
        <SessionList rows={filtered} navigation={navigation} title="Lista absencji"/>
        <Text style={s.muted}>Aktualizacja: {new Date(data.updated_at).toLocaleTimeString('pl-PL')}. Zgłoszenie całodniowe może obejmować kilka treningów.</Text>
        <PanelButton onPress={load}>Odśwież dane</PanelButton>
      </>}
    </ScrollView>
  </AppLayout>;
}
