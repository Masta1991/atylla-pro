import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AnnualTrainingChart from '../components/AnnualTrainingChart';
import AppLayout from '../components/AppLayout';
import * as api from '../services/api';
import { MonthPicker, useOverview, usePanelTheme, LoadState, SessionList, PanelButton, STATUS_NAMES, STATES, MONTHS } from '../components/TrainerPanels';

export default function ResultsScreen({navigation}) {
  const now=new Date();
  const [period,setPeriod]=useState({year:now.getFullYear(),month:now.getMonth()+1});
  const [filter,setFilter]=useState('all'),[week,setWeek]=useState(null);
  const [clients,setClients]=useState([]),[clientsError,setClientsError]=useState('');
  const {s,palette,T}=usePanelTheme();
  const {data,loading,error,load}=useOverview(period.year,period.month);
  useFocusEffect(useCallback(()=>{let active=true;setClientsError('');
    api.getClients(true).then(value=>{if(active)setClients(value||[]);}).catch(e=>{if(active)setClientsError(e.message);});
    return()=>{active=false;};},[]));
  const change=(year,month)=>{setPeriod({year,month});setWeek(null);};
  const rows=(data?.rows||[]).filter(r=>(filter==='all'||r.state===filter)&&(!week||(r.date>=week.from&&r.date<=week.to)));
  const attention=clients.filter(c=>!c.active_package_id&&!c.package_purchase_date || c.billing_type==='package'&&c.package_size>0&&c.package_current_count>=c.package_size-2);
  return <AppLayout navigation={navigation} title="Strefa Trenera" showBack>
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.heading}>Twój miesiąc pracy</Text>
      <MonthPicker {...period} onChange={change} outlined/>
      <LoadState loading={loading} error={error} retry={load}/>
      {!loading&&data&&<>
        <View style={s.grid}>{STATES.map(key=><PanelButton key={key} selected={filter===key} onPress={()=>{setFilter(filter===key?'all':key);setWeek(null);}}
          label={`${STATUS_NAMES[key]}: ${data.totals[key]}`} style={[s.card,s.metric]}>
          <Text style={[s.number,{color:palette[key]}]}>{data.totals[key]}</Text><Text style={s.text}>{STATUS_NAMES[key]}</Text>
        </PanelButton>)}</View>
        <Text style={s.muted}>Odbyte według zakończonych godzin kalendarza. Wspólny trening dwóch osób to jedna sesja trenera. Opłacone odwołanie nie jest odbytym treningiem.</Text>
        <View style={s.card}>
          <Text style={s.title}>Klienci i frekwencja</Text>
          <Text style={s.text}>Klienci z odbytymi sesjami: {data.totals.clients_done}</Text>
          <Text style={s.text}>Klienci z zaplanowanymi sesjami: {data.totals.clients_planned}</Text>
          <Text style={s.text}>Odwołania w minionych terminach: {data.totals.cancellation_rate==null?'—':data.totals.cancellation_rate+'%'}</Text>
          <Text style={s.muted}>Odbyte w porównywalnym okresie poprzedniego miesiąca: {data.previous_done} ({data.previous_label}).</Text>
        </View>
        <AnnualTrainingChart year={period.year} month={period.month} months={data.months} onSelect={change}/>
        <View style={s.card}>
          <Text style={s.title}>Tygodnie w miesiącu</Text>
          {data.weeks.map(w=><PanelButton key={w.from} selected={week?.from===w.from} onPress={()=>{setWeek(week?.from===w.from?null:w);setFilter('all');}}>
            <Text style={s.title}>{w.from.slice(5)} – {w.to.slice(5)}</Text>
            <View style={s.row}>{STATES.map(k=><Text key={k} style={[s.muted,{color:palette[k]}]}>{STATUS_NAMES[k]}: {w[k]}</Text>)}</View>
          </PanelButton>)}
        </View>
        {data.totals.unknown>0&&<PanelButton onPress={()=>{setFilter('unknown');setWeek(null);}}>Zgłoszenia bez danych o rozliczeniu: {data.totals.unknown}</PanelButton>}
        {(filter!=='all'||week)&&<PanelButton onPress={()=>{setFilter('all');setWeek(null);}}>Pokaż cały miesiąc</PanelButton>}
        <SessionList rows={rows} navigation={navigation} title={filter==='all'?'Sesje i zgłoszenia':STATUS_NAMES[filter]}/>
        <Text style={s.muted}>Aktualizacja: {new Date(data.updated_at).toLocaleTimeString('pl-PL')}.</Text>
        <PanelButton onPress={load}>Odśwież podsumowanie</PanelButton>
      </>}
      <View style={s.card}>
        <Text style={s.title}>Do sprawdzenia teraz</Text>
        <Text style={s.muted}>Bieżące pakiety, niezależnie od miesiąca wybranego powyżej.</Text>
        {!!clientsError?<Text style={s.error}>Nie udało się odczytać pakietów. {clientsError}</Text>:attention.length===0?<Text style={s.muted}>Brak pakietów wymagających uwagi.</Text>:
          attention.map(c=><PanelButton key={c.id} onPress={()=>navigation.push('ClientPayments',{clientId:c.id})}>
            <Text style={s.title}>{c.name}</Text><Text style={s.muted}>{!c.active_package_id&&!c.package_purchase_date?'Brak rozpoczętego rozliczenia':`Wykorzystano ${c.package_current_count} z ${c.package_size} treningów`}</Text>
          </PanelButton>)}
      </View>
    </ScrollView>
  </AppLayout>;
}
