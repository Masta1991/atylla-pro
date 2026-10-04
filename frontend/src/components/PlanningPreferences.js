import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import DropdownPicker from './DropdownPicker';
import TrainerSection from './TrainerSection';
import { PanelButton, usePanelTheme } from './TrainerPanels';

export const DAYS=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
export const GOALS={balance:'Równowaga',time:'Więcej czasu',income:'Większy przychód'};
export const hour=h=>`${String(h).padStart(2,'0')}:00`;
const hours=(a,b)=>Array.from({length:b-a+1},(_,i)=>({label:hour(a+i),value:a+i}));

export default function PlanningPreferences({value,onChange,clients=[],disabled=false}) {
  const {s,T}=usePanelTheme(); const [mode,setMode]=useState('week'),[day,setDay]=useState(0),[date,setDate]=useState('');
  const [from,setFrom]=useState(12),[to,setTo]=useState(13),[error,setError]=useState('');
  const [price,setPrice]=useState(value.session_price==null?'':String(value.session_price));
  const set=(key,v)=>{if(!disabled)onChange({...value,[key]:v});};
  const input={borderWidth:1,borderColor:T.border,borderRadius:10,padding:12,color:T.text,backgroundColor:T.background,fontSize:16,minHeight:44};
  const addWindow=()=>{
    if(from>=to){setError('Koniec przerwy musi być późniejszy niż początek.');return;}
    if(mode==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)){setError('Wpisz poprawną datę w formacie RRRR-MM-DD.');return;}
    const next={...(mode==='date'?{date}:{weekday:day}),start_hour:from,end_hour:to};
    if(value.protected_windows.some(w=>(w.date||null)===(next.date||null)&&(w.weekday??null)===(next.weekday??null)&&w.start_hour===from&&w.end_hour===to)){setError('Ta przerwa jest już zapisana.');return;}
    set('protected_windows',[...value.protected_windows,next]);setError('');
  };
  return <View style={{gap:14}}>
    <View style={s.card}>
      <Text style={s.title}>Co jest teraz najważniejsze?</Text>
      <View style={s.row}>{Object.entries(GOALS).map(([key,label])=><PanelButton key={key} disabled={disabled} selected={value.goal===key} onPress={()=>set('goal',key)}>{label}</PanelButton>)}</View>
      <Text style={s.muted}>Propozycje mają respektować Twoje przerwy i nie przesuwają treningów automatycznie.</Text>
    </View>
    <TrainerSection title="Reguły pracy i obciążenie">
      <Text style={s.text}>Najwcześniejszy początek pracy</Text>
      <DropdownPicker placeholder="Początek pracy" disabled={disabled} selectedValue={value.start_hour} onValueChange={v=>set('start_hour',Number(v))} items={hours(6,21)}/>
      <Text style={s.muted}>Każdy trening trwa 60 minut i zaczyna się oraz kończy o pełnej godzinie. Wyjątki pozostają poza regułą. Początek dnia nie oznacza, że każda późniejsza godzina ma być zajęta.</Text>
      <Text style={s.text}>Najpóźniejszy koniec dnia</Text>
      <DropdownPicker placeholder="Koniec dnia" disabled={disabled} selectedValue={value.end_hour??''} onValueChange={v=>set('end_hour',v===''?null:Number(v))} items={[{label:'Bez stałej godziny końca',value:''},...hours(7,22)]}/>
      <Text style={s.text}>Maksymalnie treningów z rzędu</Text>
      <DropdownPicker placeholder="Treningi z rzędu" disabled={disabled} selectedValue={value.max_consecutive??''} onValueChange={v=>set('max_consecutive',v===''?null:Number(v))} items={[{label:'Bez określonego limitu',value:''},...Array.from({length:16},(_,i)=>({label:String(i+1),value:i+1}))]}/>
      <Text style={s.text}>Dni, w których rozważasz propozycje</Text>
      <Text style={s.muted}>Obecny kalendarz obsługuje poniedziałek–sobotę. Niedzielne dane mogą być widoczne w historii, ale nie proponujemy na nie zmian.</Text>
      <PanelButton disabled={disabled} selected={value.allowed_weekdays==null} onPress={()=>set('allowed_weekdays',null)}>Zmienny grafik — bez stałych dni</PanelButton>
      <View style={s.row}>{DAYS.slice(0,6).map((name,i)=><PanelButton key={name} disabled={disabled} selected={value.allowed_weekdays?.includes(i)||false} onPress={()=>set('allowed_weekdays',value.allowed_weekdays?.includes(i)?value.allowed_weekdays.filter(d=>d!==i):[...(value.allowed_weekdays||[]),i].sort())}>{name}</PanelButton>)}</View>
      {value.allowed_weekdays?.length===0&&<Text style={s.muted}>Nie wybrano żadnego dnia. Analiza nie zaproponuje nowych terminów.</Text>}
    </TrainerSection>
    <TrainerSection title={`Przerwy do zachowania · ${value.protected_windows.length}`}>
      <Text style={s.muted}>Te godziny są dla Ciebie. Nie proponujemy w nich treningów. Powtarzalna przerwa obowiązuje we wskazanym dniu tygodnia; możesz też chronić jedną datę.</Text>
      {value.protected_windows.map((w,i)=><View key={i} style={s.line}>
        <Text style={s.text}>{w.date||DAYS[w.weekday]} · {hour(w.start_hour)}–{hour(w.end_hour)}</Text>
        <PanelButton disabled={disabled} label={`Usuń przerwę ${i+1}`} onPress={()=>set('protected_windows',value.protected_windows.filter((_,n)=>n!==i))}>Usuń tę przerwę</PanelButton>
      </View>)}
      <View style={s.row}><PanelButton disabled={disabled} selected={mode==='week'} onPress={()=>setMode('week')}>Co tydzień</PanelButton><PanelButton disabled={disabled} selected={mode==='date'} onPress={()=>setMode('date')}>Jedna data</PanelButton></View>
      {mode==='week'?<DropdownPicker placeholder="Dzień chronionej przerwy" disabled={disabled} selectedValue={day} onValueChange={setDay} items={DAYS.map((label,value)=>({label,value}))}/>:<TextInput accessibilityLabel="Data chronionej przerwy" placeholder="RRRR-MM-DD" placeholderTextColor={T.textSecondary} editable={!disabled} value={date} onChangeText={setDate} style={input}/>}
      <View style={[s.row,{alignItems:'stretch'}]}>
        <View style={{flex:1,minWidth:100}}><Text style={s.text}>Od godziny</Text><DropdownPicker placeholder="Początek przerwy" disabled={disabled} selectedValue={from} onValueChange={setFrom} items={hours(6,21)}/></View>
        <View style={{flex:1,minWidth:100}}><Text style={s.text}>Do godziny</Text><DropdownPicker placeholder="Koniec przerwy" disabled={disabled} selectedValue={to} onValueChange={setTo} items={hours(7,22)}/></View>
      </View>
      {!!error&&<Text role="alert" style={s.error}>{error}</Text>}
      <PanelButton disabled={disabled||value.protected_windows.length>=50} onPress={addWindow}>Dodaj chronioną przerwę</PanelButton>
    </TrainerSection>
    <TrainerSection title={`Klienci ze stałą godziną · ${value.locked_client_ids.length}`}>
      <Text style={s.muted}>Dla wskazanych osób nie proponujemy przesunięć. Wspólny trening jest chroniony, jeśli zaznaczysz choć jednego uczestnika.</Text>
      {value.locked_client_ids.map(id=><View key={id} style={s.line}><Text style={s.text}>{clients.find(c=>c.id===id)?.name||'Klient niedostępny'}</Text><PanelButton disabled={disabled} onPress={()=>set('locked_client_ids',value.locked_client_ids.filter(c=>c!==id))} label={`Odblokuj termin: ${clients.find(c=>c.id===id)?.name||'klient'}`}>Dopuść propozycje</PanelButton></View>)}
      <DropdownPicker placeholder="Dodaj klienta ze stałą godziną" disabled={disabled} selectedValue="" onValueChange={id=>set('locked_client_ids',[...value.locked_client_ids,id])} items={clients.filter(c=>!value.locked_client_ids.includes(c.id)).map(c=>({label:c.name,value:c.id}))}/>
    </TrainerSection>
    <TrainerSection title="Stawka do symulacji przychodu">
      <Text style={s.text}>Cena dodatkowego treningu (zł)</Text>
      <TextInput accessibilityLabel="Stawka dodatkowej sesji" editable={!disabled} style={input} keyboardType="decimal-pad" value={price} onChangeText={v=>{if(/^\d{0,5}([,.]\d{0,2})?$/.test(v)){setPrice(v);set('session_price',v===''?null:Number(v.replace(',','.')));}}}/>
      {value.session_price>10000&&<Text style={s.error}>Maksymalna stawka to 10 000 zł.</Text>}
      <Text style={s.muted}>Zostaw puste, jeśli nie chcesz podawać kwoty. Liczymy przychód przed kosztami pod warunkiem pozyskania nowej rezerwacji, bez gwarancji popytu.</Text>
    </TrainerSection>
  </View>;
}
