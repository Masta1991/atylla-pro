import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AnnualTrainingChart from '../components/AnnualTrainingChart';
import AppLayout from '../components/AppLayout';
import TrainerSection from '../components/TrainerSection';
import TrainerPlanning from '../components/TrainerPlanning';
import { SeasonalityContent } from './SeasonalityScreen';
import { MonthPicker, useOverview, usePanelTheme, LoadState, SessionList, PanelButton, STATUS_NAMES, STATES } from '../components/TrainerPanels';

export default function ResultsScreen({navigation}) {
  const now=new Date(), {s}=usePanelTheme();
  const [period,setPeriod]=useState({year:now.getFullYear(),month:now.getMonth()+1});
  const [tab,setTab]=useState('overview');
  return <AppLayout navigation={navigation} title="Strefa Trenera" showBack>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.row} accessibilityLabel="Widoki Strefy Trenera">
        {[['overview','Podsumowanie'],['schedule','Grafik'],['season','Sezonowość']].map(([key,label])=>
          <PanelButton key={key} selected={tab===key} onPress={()=>setTab(key)} style={{flexGrow:1,alignItems:'center'}}>{label}</PanelButton>)}
      </View>
      {tab==='overview'&&<Overview navigation={navigation} period={period} setPeriod={setPeriod} onSeason={()=>setTab('season')}/>}
      {tab==='schedule'&&<TrainerPlanning navigation={navigation}/>}
      {tab==='season'&&<SeasonalityContent/>}
    </ScrollView>
  </AppLayout>;
}

function Overview({navigation,period,setPeriod,onSeason}) {
  const [filter,setFilter]=useState('all'),[week,setWeek]=useState(null),[sessions,setSessions]=useState(false);
  const {s,palette}=usePanelTheme();
  const {data,loading,error,load}=useOverview(period.year,period.month);
  const change=(year,month)=>{setPeriod({year,month});setWeek(null);};
  const rows=(data?.rows||[]).filter(r=>(filter==='all'||r.state===filter)&&(!week||(r.date>=week.from&&r.date<=week.to)));
  return <>
    <Text style={s.heading}>Twój miesiąc pracy</Text>
    <MonthPicker {...period} onChange={change} outlined/>
    <LoadState loading={loading} error={error} retry={load}/>
    {!loading&&!error&&data&&<>
      <View style={s.grid}>{STATES.map(key=><PanelButton key={key} selected={filter===key} onPress={()=>{setFilter(filter===key?'all':key);setWeek(null);setSessions(true);}}
        label={`${STATUS_NAMES[key]}: ${data.totals[key]}`} style={[s.card,s.metric]}>
        <Text style={[s.number,{color:palette[key]}]}>{data.totals[key]}</Text><Text style={s.text}>{STATUS_NAMES[key]}</Text>
      </PanelButton>)}</View>
      <View style={s.card}>
        <Text style={s.title}>Rytm miesiąca</Text>
        <Text style={s.text}>Klienci z odbytymi sesjami: {data.totals.clients_done} · z zaplanowanymi: {data.totals.clients_planned}</Text>
        <Text style={s.text}>Opłacone odwołania w minionych terminach: {data.totals.cancellation_rate==null?'—':data.totals.cancellation_rate+'%'}</Text>
        <Text style={s.muted}>Odbyte w porównywalnym okresie poprzedniego miesiąca: {data.previous_done} ({data.previous_label}).</Text>
      </View>
      <AnnualTrainingChart year={period.year} month={period.month} months={data.months} annual={data.annual} onSelect={change}/>
      <TrainerSection title="Tygodnie w miesiącu" testID="trainer-weeks">
        {data.weeks.map(w=><PanelButton key={w.from} selected={week?.from===w.from} onPress={()=>{setWeek(week?.from===w.from?null:w);setFilter('all');setSessions(true);}}>
          <Text style={s.title}>{w.from.slice(5)} – {w.to.slice(5)}</Text>
          <View style={s.row}>{STATES.map(k=><Text key={k} style={[s.muted,{color:palette[k]}]}>{STATUS_NAMES[k]}: {w[k]}</Text>)}</View>
        </PanelButton>)}
      </TrainerSection>
      <TrainerSection title={`Lista treningów · ${rows.length}`} open={sessions} onToggle={setSessions} testID="trainer-sessions">
        {data.totals.unknown>0&&<PanelButton onPress={()=>{setFilter('unknown');setWeek(null);}}>Zgłoszenia bez danych o rozliczeniu: {data.totals.unknown}</PanelButton>}
        {(filter!=='all'||week)&&<PanelButton onPress={()=>{setFilter('all');setWeek(null);}}>Pokaż cały miesiąc</PanelButton>}
        <SessionList rows={rows} navigation={navigation} title={filter==='all'?'Sesje i zgłoszenia':STATUS_NAMES[filter]}/>
      </TrainerSection>
      <Text style={s.muted}>Wspólny trening dwóch osób to jedna sesja. Opłacone odwołanie nie jest odbytym treningiem. Aktualizacja: {new Date(data.updated_at).toLocaleTimeString('pl-PL')}.</Text>
      <PanelButton onPress={load}>Odśwież podsumowanie</PanelButton>
      <PanelButton onPress={onSeason}>Raport sezonowości i wnioski →</PanelButton>
    </>}
  </>;
}
