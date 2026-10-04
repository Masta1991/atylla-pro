import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import AnnualTrainingChart from '../components/AnnualTrainingChart';
import AppLayout from '../components/AppLayout';
import DropdownPicker from '../components/DropdownPicker';
import TrainerSection from '../components/TrainerSection';
import TrainerPlanning from '../components/TrainerPlanning';
import { SeasonalityContent } from './SeasonalityScreen';
import { TrainerDesignProvider, MONTHS, useOverview, usePanelTheme, LoadState, SessionList, PanelButton, STATUS_NAMES, STATES } from '../components/TrainerPanels';

export default function ResultsScreen(props) {
  return <TrainerDesignProvider><TrainerScreen {...props}/></TrainerDesignProvider>;
}
function TrainerScreen({navigation}) {
  const now=new Date(), {s,T}=usePanelTheme();
  const [period,setPeriod]=useState({year:now.getFullYear(),month:now.getMonth()+1});
  const [tab,setTab]=useState('overview');
  return <AppLayout navigation={navigation} title="Strefa Trenera" showBack>
    <ScrollView style={{backgroundColor:T.background}} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View testID="trainer-tabs" style={{flexDirection:'row',gap:3,padding:4,backgroundColor:T.raised,borderRadius:13}} accessibilityLabel="Widoki Strefy Trenera">
        {[['overview','Podsumowanie',1.3],['schedule','Grafik',0.8],['season','Sezonowość',1.1]].map(([key,label,weight])=>
          <PanelButton key={key} label={label} selected={tab===key} onPress={()=>setTab(key)} style={{flex:weight,minWidth:0,alignItems:'center',borderWidth:0,paddingHorizontal:4,backgroundColor:tab===key?T.surface:'transparent'}}>
            <Text style={{fontSize:12,fontWeight:'600',color:tab===key?T.text:T.textSecondary}}>{label}</Text>
          </PanelButton>)}
      </View>
      {tab==='overview'&&<Overview navigation={navigation} period={period} setPeriod={setPeriod} onSeason={()=>setTab('season')}/>}
      {tab==='schedule'&&<TrainerPlanning navigation={navigation}/>}
      {tab==='season'&&<SeasonalityContent onOverview={()=>setTab('overview')}/>}
    </ScrollView>
  </AppLayout>;
}
function CompactPeriod({year,month,onChange}) {
  const {T}=usePanelTheme();
  const shift=n=>{const d=new Date(year,month-1+n,1);onChange(d.getFullYear(),d.getMonth()+1);};
  const field={height:44,borderWidth:1,borderColor:T.border,borderRadius:10,backgroundColor:T.surface,paddingHorizontal:6,minWidth:0};
  return <View testID="trainer-period" style={{flexDirection:'row',gap:6,alignItems:'center'}}>
    <PanelButton label="Poprzedni miesiąc" disabled={year===2000&&month===1} onPress={()=>shift(-1)} style={[field,{width:44,paddingHorizontal:0,alignItems:'center'}]}><Text style={{fontSize:22,color:T.copper}}>‹</Text></PanelButton>
    <DropdownPicker compact placeholder="Wybierz miesiąc" selectedValue={month} onValueChange={m=>onChange(year,Number(m))} style={[field,{flex:1.4}]} items={MONTHS.map((label,i)=>({label,value:i+1}))}/>
    <DropdownPicker compact placeholder="Wybierz rok" selectedValue={year} onValueChange={y=>onChange(Number(y),month)} style={[field,{flex:1,minWidth:70}]} items={Array.from({length:101},(_,i)=>({label:String(2000+i),value:2000+i}))}/>
    <PanelButton label="Następny miesiąc" disabled={year===2100&&month===12} onPress={()=>shift(1)} style={[field,{width:44,paddingHorizontal:0,alignItems:'center'}]}><Text style={{fontSize:22,color:T.copper}}>›</Text></PanelButton>
  </View>;
}
function MonthNote({data,period}) {
  const {s}=usePanelTheme(),month=data.months.find(m=>m.month===period.month),previous=data.months.find(m=>m.month===period.month-1);
  const complete=month?.coverage==='recorded'&&previous?.coverage==='recorded'&&previous.recorded>0;
  const delta=complete?Math.round((data.totals.recorded/previous.recorded-1)*100):null;
  const title=month?.coverage==='future'?'Miesiąc przed Tobą':month?.coverage==='current'?'Bieżący miesiąc trwa':
    delta==null?'Podsumowanie miesiąca':delta===0?'Tyle samo sesji co miesiąc wcześniej':Math.abs(delta)+'% '+(delta>0?'więcej':'mniej')+' sesji niż miesiąc wcześniej';
  const detail=month?.coverage==='future'?data.totals.planned+' zaplanowanych treningów. Wyniki pojawią się wraz z zakończonymi sesjami.':
    month?.coverage==='current'?data.totals.recorded+' odbytych i opłaconych odwołań oraz '+data.totals.planned+' kolejnych treningów w kalendarzu. Wynik jest częściowy.':
    month?.coverage==='missing'?'Brak zapisanych odbytych treningów i opłaconych odwołań. Brak historii nie potwierdza zera.':
    'Łącznie '+data.totals.recorded+' odbytych treningów i opłaconych odwołań.'+(complete?' Poprzedni miesiąc: '+previous.recorded+'.':'')+(month?.coverage==='partial'?' Pierwszy miesiąc historii może być niepełny.':'');
  return <View style={s.note} testID="trainer-month-note"><Text style={s.title}>{title}</Text><Text style={s.muted}>{detail}</Text></View>;
}
function Overview({navigation,period,setPeriod,onSeason}) {
  const [filter,setFilter]=useState('all'),[week,setWeek]=useState(null),[sessions,setSessions]=useState(false);
  const {s,T}=usePanelTheme();
  const {data,loading,error,load}=useOverview(period.year,period.month);
  const change=(year,month)=>{setPeriod({year,month});setWeek(null);setFilter('all');};
  const rows=(data?.rows||[]).filter(r=>(filter==='all'||r.state===filter)&&(!week||(r.date>=week.from&&r.date<=week.to)));
  const unknown=['missing','future'].includes(data?.months.find(m=>m.month===period.month)?.coverage);
  return <>
    <CompactPeriod {...period} onChange={change}/>
    <LoadState loading={loading} error={error} retry={load}/>
    {!loading&&!error&&data&&<>
      <View testID="trainer-stats" style={{flexDirection:'row',gap:9}}>{STATES.map(key=><PanelButton key={key} selected={filter===key}
        onPress={()=>{setFilter(filter===key?'all':key);setWeek(null);setSessions(true);}} label={STATUS_NAMES[key]+': '+(unknown&&key!=='planned'?'brak danych':data.totals[key])}
        style={{flex:1,minWidth:0,borderRadius:12,paddingVertical:12,paddingHorizontal:5,alignItems:'center',backgroundColor:T.surface}}>
        <Text style={{fontSize:26,fontWeight:'700',letterSpacing:-1,color:T.text}}>{unknown&&key!=='planned'?'—':data.totals[key]}</Text>
        <Text style={[s.muted,{textAlign:'center',marginTop:4}]}>{key==='paid'?'Odwołane\nopłacone':STATUS_NAMES[key]}</Text>
      </PanelButton>)}</View>
      <MonthNote data={data} period={period}/>
      <AnnualTrainingChart year={period.year} month={period.month} months={data.months} annual={data.annual} onSelect={change}/>
      <TrainerSection title="Tygodnie w miesiącu" testID="trainer-weeks">
        {data.weeks.map(w=><PanelButton key={w.from} selected={week?.from===w.from} onPress={()=>{setWeek(week?.from===w.from?null:w);setFilter('all');setSessions(true);}}
          style={{borderWidth:0,borderBottomWidth:1,borderRadius:0,paddingHorizontal:0}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',gap:10}}>
            <View style={{flex:1}}><Text style={s.title}>{w.from.slice(8)}–{w.to.slice(8)}.{w.to.slice(5,7)}</Text><Text style={s.muted}>Odbyte: {w.done} · Opłacone odwołania: {w.paid}</Text></View>
            <Text style={s.muted}>{w.done+w.paid} sesji</Text>
          </View>
        </PanelButton>)}
      </TrainerSection>
      <TrainerSection title="Lista treningów" open={sessions} onToggle={setSessions} testID="trainer-sessions">
        <Text style={s.muted}>{MONTHS[period.month-1]} {period.year} · {rows.length} wpisów</Text>
        {data.totals.unknown>0&&<PanelButton onPress={()=>{setFilter('unknown');setWeek(null);}}>Zgłoszenia bez danych o rozliczeniu: {data.totals.unknown}</PanelButton>}
        {(filter!=='all'||week)&&<PanelButton onPress={()=>{setFilter('all');setWeek(null);}}>Pokaż cały miesiąc</PanelButton>}
        <SessionList compact rows={rows} navigation={navigation}/>
      </TrainerSection>
      <PanelButton style={s.link} onPress={onSeason}><Text style={[s.text,{color:T.copper}]}>Raport sezonowości i wnioski →</Text></PanelButton>
    </>}
  </>;
}
