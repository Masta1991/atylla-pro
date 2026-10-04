import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { PanelButton, LoadState, usePanelTheme } from './TrainerPanels';
import TrainerSection from './TrainerSection';
import DropdownPicker from './DropdownPicker';
import PlanningPreferences, { DAYS, GOALS, hour } from './PlanningPreferences';

// A random operation identifier is for retry deduplication, never authorization.
const requestId=()=>globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16);});
const validPrefs=p=>p.end_hour!=null&&p.end_hour<=p.start_hour?'Koniec dnia musi być późniejszy niż początek.':p.session_price!=null&&(!Number.isFinite(p.session_price)||p.session_price<0||p.session_price>10000)?'Stawka musi być liczbą od 0 do 10 000 zł.':'';

export default function TrainerPlanning({navigation,settingsOnly=false}) {
  const {s}=usePanelTheme();
  const [months,setMonths]=useState(3),[context,setContext]=useState(null),[prefs,setPrefs]=useState(null);
  const [answers,setAnswers]=useState({}),[saveDefaults,setSaveDefaults]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[actionError,setActionError]=useState('');
  const [message,setMessage]=useState(''),[report,setReport]=useState(null),[history,setHistory]=useState([]),[historyError,setHistoryError]=useState('');
  const seq=useRef(0),lock=useRef(false),pending=useRef(null),heading=useRef(null);
  const loadHistory=useCallback(async()=>{try{const res=await api.getPlanningAnalyses();setHistory(res.items);setHistoryError('');}catch(e){setHistoryError(e.message);}},[]);
  const load=useCallback(async()=>{
    const n=++seq.current;setLoading(true);setError('');setMessage('');setActionError('');
    try{const data=await api.getPlanningContext(months);if(n!==seq.current)return;setContext(data);setPrefs(data.preferences);setAnswers(data.last_answers||{});pending.current=null;}
    catch(e){if(n===seq.current){setContext(null);setPrefs(null);setError(e.message);}}
    finally{if(n===seq.current)setLoading(false);}
  },[months]);
  useFocusEffect(useCallback(()=>{load();if(!settingsOnly)loadHistory();return()=>{seq.current++;};},[load,loadHistory,settingsOnly]));
  useEffect(()=>{if(report)requestAnimationFrame(()=>heading.current?.focus());},[report]);
  const changePrefs=p=>{setPrefs(p);setMessage('');setActionError('');};
  async function submit(){
    if(lock.current||!context||!prefs)return;
    const invalid=validPrefs(prefs);if(invalid){setActionError(invalid);return;}
    lock.current=true;setBusy(true);setActionError('');setMessage('');
    try{
      if(settingsOnly){
        const res=await api.savePlanningPreferences({preferences:prefs,expected_revision:context.revision});
        setContext({...context,revision:res.revision,preferences:res.preferences});setPrefs(res.preferences);setMessage('Zapisano ustawienia tego profilu.');
      }else{
        if(!pending.current)pending.current={request_id:requestId(),months,preferences:prefs,answers,save_preferences:saveDefaults,expected_revision:context.revision};
        const result=await api.createPlanningAnalysis(pending.current);pending.current=null;setReport(result);loadHistory();
      }
    }catch(e){
      const rejected=[400,403,404,409,422].includes(e.status);
      if(rejected)pending.current=null;
      setActionError((e.status===422?'Sprawdź poprawność odpowiedzi i ograniczeń.':e.message)+(settingsOnly||rejected?' Odśwież ustawienia przed ponownym zapisem.':' Ponowienie użyje tego samego identyfikatora, aby nie dodać drugiej analizy.'));
    }
    finally{lock.current=false;setBusy(false);}
  }
  async function checkPending(){
    if(!pending.current||lock.current)return;lock.current=true;setBusy(true);setActionError('');
    try{const saved=await api.getPlanningAnalysis(pending.current.request_id);pending.current=null;setReport(saved);loadHistory();}
    catch(e){setActionError('Nie potwierdzono zapisu. Możesz bezpiecznie ponowić tę samą analizę. '+e.message);}
    finally{lock.current=false;setBusy(false);}
  }
  async function openSaved(id){
    if(lock.current)return;lock.current=true;setBusy(true);setHistoryError('');
    try{setReport(await api.getPlanningAnalysis(id));}catch(e){setHistoryError(e.message);}finally{lock.current=false;setBusy(false);}
  }
  const frozen=busy||!!pending.current;
  return <View style={{gap:16}} testID={settingsOnly?'planning-settings':'trainer-planning'}>
    {!settingsOnly&&<Text style={s.kicker}>Organizacja pracy</Text>}
    <Text style={s.heading}>{settingsOnly?'Praca i preferencje trenera':'Mniej okienek.\nWięcej dla Ciebie.'}</Text>
    {!settingsOnly&&<Text style={s.muted}>Powtarzające się przerwy między sesjami.</Text>}
    {settingsOnly&&<Text style={s.muted}>Domyślnie dla każdego profilu: od 06:00, trening 60 minut, pełne godziny. Zapisane zmiany dotyczą wyłącznie Twojego profilu i będą punktem wyjścia kolejnych analiz.</Text>}
    {!report&&<>
      {!settingsOnly&&<View style={{gap:6}}><Text style={s.muted}>Analizowany okres</Text><DropdownPicker placeholder="Analizowany okres" disabled={frozen} selectedValue={months} onValueChange={v=>setMonths(Number(v))} style={s.button} items={[{label:'3 pełne miesiące',value:3},{label:'6 pełnych miesięcy',value:6}]}/></View>}
      <LoadState loading={loading} error={error} retry={load}/>
      {!loading&&!error&&prefs&&context&&<>
        {!settingsOnly&&<View style={s.note}>
          <Text style={s.title}>Najpierw historia, potem Twoje decyzje</Text>
          <Text style={s.text}>{context.range.from} – {context.range.to}</Text>
          <Text style={s.text}>{context.stats.sessions} zapisanych godzin treningów · {context.stats.days} dni z treningami</Text>
          <Text style={s.muted}>Puste godziny nie muszą być problemem. Potwierdź lub zmień ostatnie odpowiedzi przed nową analizą.</Text>
        </View>}
        {!settingsOnly&&context.patterns.length>0&&<View style={{gap:8}} testID="planning-patterns">
          {context.patterns.slice(0,3).map(p=><View key={p.id} style={[s.card,{padding:12,gap:4}]}>
            <Text style={s.title}>{DAYS[p.weekday]} · {hour(p.start_hour)}–{hour(p.end_hour)}</Text>
            <Text style={s.muted}>{p.hits} z {p.observed_days} takich dni z zapisanymi treningami</Text>
          </View>)}
          <Text style={s.muted}>Okna z historii. W pytaniach poniżej określisz, które przerwy chcesz zachować.</Text>
        </View>}
        <PlanningPreferences key={`${months}-${context.revision}`} value={prefs} onChange={changePrefs} clients={context.clients} disabled={frozen}/>
        {!settingsOnly&&<>
          <TrainerSection title={`Pytania z Twojej historii · ${context.questions.length}`} initialOpen>
            <Text style={s.muted}>Poprzednie odpowiedzi są podpowiedzią. Nierozstrzygnięte powtarzalne okna pozostają chronione. Każda analiza zachowa własne odpowiedzi.</Text>
            {context.questions.length===0&&<Text style={s.text}>Na razie brak powtarzalnych okien wymagających dodatkowych pytań.</Text>}
            {context.questions.slice(0,3).map((q,i)=><Question key={q.id} question={q} pattern={context.patterns.find(p=>p.id===q.id)} index={i} value={answers[q.id]||'unknown'} disabled={frozen} onChange={v=>{setAnswers({...answers,[q.id]:v});setActionError('');}}/>)}
            {context.questions.length>3&&<TrainerSection title={`Pozostałe pytania · ${context.questions.length-3}`}>
              {context.questions.slice(3).map((q,i)=><Question key={q.id} question={q} pattern={context.patterns.find(p=>p.id===q.id)} index={i+3} value={answers[q.id]||'unknown'} disabled={frozen} onChange={v=>{setAnswers({...answers,[q.id]:v});setActionError('');}}/>)}
            </TrainerSection>}
          </TrainerSection>
          <PanelButton disabled={frozen} selected={saveDefaults} onPress={()=>setSaveDefaults(v=>!v)}>Zapisz również jako moje ustawienia: {saveDefaults?'tak':'nie'}</PanelButton>
          <Text style={s.muted}>{saveDefaults?'Preferencje i wskazane przerwy do zachowania będą użyte w kolejnych analizach.':'Preferencje dotyczą tylko tej analizy. Raport i odpowiedzi zostaną zapisane w historii.'}</Text>
        </>}
        {!!actionError&&<Text role="alert" style={s.error}>{actionError}</Text>}
        <PanelButton disabled={busy} onPress={submit}>{busy?'Zapisywanie…':settingsOnly?'Zapisz ustawienia pracy':pending.current?'Ponów zapis tej samej analizy':'Przeanalizuj i zapisz raport'}</PanelButton>
        {!!pending.current&&<PanelButton disabled={busy} onPress={checkPending}>Sprawdź, czy raport został zapisany</PanelButton>}
        {!pending.current&&<PanelButton disabled={busy} onPress={load}>Odśwież zapisane ustawienia i odpowiedzi</PanelButton>}
        {!!message&&<Text role="status" accessibilityLiveRegion="polite" style={s.text}>{message}</Text>}
      </>}
    </>}
    {report&&<>
      <Text ref={heading} tabIndex={-1} accessibilityRole="header" style={s.title}>Zapisany raport · {new Date(report.created_at).toLocaleString('pl-PL')}</Text>
      <Text style={s.muted}>Stan na moment analizy. Nowe wpisy i zmiany kalendarza wymagają ponownego sprawdzenia propozycji.</Text>
      <Report report={report} navigation={navigation}/>
      <PanelButton disabled={busy} onPress={()=>{setReport(null);load();}}>Nowa analiza — potwierdź preferencje</PanelButton>
    </>}
    {!settingsOnly&&<TrainerSection title="Historia analiz">
      <Text style={s.muted}>Ostatnie 50 zapisanych analiz. Wcześniejsze odpowiedzi pozostają częścią swoich raportów.</Text>
      {!!historyError&&<Text role="alert" style={s.error}>{historyError}</Text>}
      {!history.length&&!historyError&&<Text style={s.muted}>Nie masz jeszcze zapisanych analiz.</Text>}
      {history.map(row=><PanelButton key={row.id} disabled={busy||!!pending.current} onPress={()=>openSaved(row.id)}>{new Date(row.created_at).toLocaleString('pl-PL')} · {row.months} mies. · {GOALS[row.goal]||row.goal}</PanelButton>)}
      <PanelButton disabled={busy} onPress={loadHistory}>Odśwież historię analiz</PanelButton>
    </TrainerSection>}
  </View>;
}

function Question({question:q,pattern,index,value,onChange,disabled}) {
  const {s}=usePanelTheme();
  return <View style={[s.line,{gap:10}]} testID={`planning-question-${index}`}>
    <Text style={s.title}>{q.text}</Text>
    {!!pattern&&<Text style={s.muted}>Wystąpiło w {pattern.hits} z {pattern.observed_days} takich dni tygodnia z zapisanymi treningami.</Text>}
    <View style={s.row}>{q.options.map(option=><PanelButton key={option.value} disabled={disabled} selected={value===option.value} label={`${q.text} ${option.label}`} onPress={()=>onChange(option.value)}>{option.label}</PanelButton>)}</View>
  </View>;
}

function Report({report,navigation}) {
  const {s,T}=usePanelTheme(),r=report.result;
  if(!r?.range||!r?.target_range||!r?.stats||!Array.isArray(r.proposals)||!Array.isArray(r.warnings)||!Array.isArray(report.questions)||!report.preferences||!report.answers){
    return <View style={s.card}><Text role="alert" style={s.error}>Ten raport jest niekompletny. Uruchom nową analizę, aby odczytać aktualne dane.</Text></View>;
  }
  return <>
    <View style={s.card}>
      <Text style={s.title}>{GOALS[report.preferences.goal]}</Text>
      <Text style={s.text}>Historia: {r.range.from} – {r.range.to}</Text>
      <Text style={s.text}>Propozycje na: {r.target_range.from} – {r.target_range.to}</Text>
      <Text style={s.muted}>{r.stats.internal_gap_hours} godzin bez wpisów między treningami w analizowanej historii. To nie jest liczba godzin do odzyskania.</Text>
    </View>
    {r.proposals.length===0&&<View style={s.card}><Text style={s.title}>Brak pasujących propozycji</Text><Text style={s.text}>Obecny kalendarz i Twoje ograniczenia nie dają bezpiecznego wariantu. Możesz ponowić analizę po zmianie preferencji lub dodaniu przyszłych terminów.</Text></View>}
    {r.proposals.map(p=><View key={p.id} style={s.card} testID="planning-proposal">
      <Text style={s.kicker}>Propozycja do uzgodnienia · {p.date}</Text>
      <Text style={s.heading}>{p.kind==='income'?'Dodatkowa sesja w oknie':p.clients.map(c=>c.name).join(' + ')}</Text>
      {p.moves.map(m=><Text key={m.event_id} style={s.text}>{m.names.join(' + ')}: {m.from_date} {hour(m.from_hour)} → {m.to_date} {hour(m.to_hour)}</Text>)}
      {p.slot&&<Text style={s.text}>Termin do rozważenia: {p.slot.date}, {hour(p.slot.hour)}–{hour(p.slot.hour+1)}</Text>}
      <View style={[s.row,{borderTopWidth:1,borderBottomWidth:1,borderColor:T.border,paddingVertical:12}]}><View style={{flex:1,minWidth:100}}><Text style={s.muted}>Teraz koniec dnia</Text><Text style={s.heading}>{hour(p.before_end)}</Text></View><View style={{flex:1,minWidth:100}}><Text style={s.muted}>{p.kind==='income'?'Po dodaniu sesji':'Po przesunięciu'}</Text><Text style={s.heading}>{hour(p.after_end)}</Text></View></View>
      <Text style={s.title}>{p.kind==='income'?`Dodatkowo: ${p.additional_sessions} sesja${p.additional_revenue==null?'':` · ${p.additional_revenue.toLocaleString('pl-PL')} zł przychodu`}`:`${p.saved_minutes} minut wcześniej · ta sama liczba sesji`}</Text>
      <Text style={s.text}>{p.reason}</Text>
      <TrainerSection title="Na czym opiera się propozycja?"><Text style={s.muted}>{p.evidence}</Text><Text style={s.muted}>Dotyczy wskazanej daty. Nie zmienia stałego harmonogramu klienta. Potwierdź dostępność wszystkich uczestników.</Text></TrainerSection>
      {!!navigation&&<PanelButton onPress={()=>navigation.navigate('Calendar',{focusDate:p.date,focusHour:p.moves[0]?.from_hour??p.slot?.hour})}>Sprawdź ten dzień w kalendarzu</PanelButton>}
    </View>)}
    <TrainerSection title="Założenia, odpowiedzi i ograniczenia">
      <Text style={s.text}>Od {hour(report.preferences.start_hour)} · sesje 60 minut · {report.preferences.end_hour==null?'bez stałego końca':'koniec do '+hour(report.preferences.end_hour)}</Text>
      <Text style={s.text}>Limit treningów z rzędu: {report.preferences.max_consecutive??'nie określono'}. Dni: {report.preferences.allowed_weekdays==null?'zmienny grafik':report.preferences.allowed_weekdays.map(d=>DAYS[d]).join(', ')||'brak wybranych dni'}.</Text>
      {report.preferences.protected_windows.map((w,i)=><Text key={i} style={s.text}>Chroniona przerwa: {w.date||DAYS[w.weekday]} {hour(w.start_hour)}–{hour(w.end_hour)}</Text>)}
      <Text style={s.text}>Klienci ze stałą godziną: {report.preferences.locked_client_ids.length}. Stawka do symulacji: {report.preferences.session_price==null?'nie podano':report.preferences.session_price+' zł'}.</Text>
      {report.questions.map(q=><View key={q.id} style={s.line}><Text style={s.text}>{q.text}</Text><Text style={s.title}>{q.options.find(o=>o.value===report.answers[q.id])?.label||'Brak odpowiedzi'}</Text></View>)}
      {r.warnings.map((w,i)=><Text key={i} style={s.muted}>{w}</Text>)}
      <Text style={s.muted}>Silnik analizy: {r.engine_version}. Propozycje są alternatywami — ich korzyści nie sumują się automatycznie.</Text>
    </TrainerSection>
  </>;
}
