import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import DropdownPicker from './DropdownPicker';
import * as api from '../services/api';

export const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
export const STATUS_NAMES = {done:'Odbyte', planned:'Zaplanowane', paid:'Odwołane, opłacone', free:'Odwołane, nieopłacone', unknown:'Brak danych o rozliczeniu'};
export const STATES = ['done','planned','paid','free'];
export const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const mondayOf = d => {const n = new Date(d); n.setDate(n.getDate() - (n.getDay()+6)%7); return n;};
export const addDays = (day, n) => {const d = new Date(day+'T12:00:00'); d.setDate(d.getDate()+n); return iso(d);};

export function usePanelTheme() {
  const {colors: C, themeColors: T, mode} = useTheme();
  const {width} = useWindowDimensions();
  const palette = mode === 'light'
    ? {done:'#087a54', planned:'#825400', paid:'#a04400', free:'#bc2929', unknown:'#586171'}
    : {done:'#39d6ad', planned:'#f5ce55', paid:'#f5a35c', free:'#ff8585', unknown:'#aab3c2'};
  const s = useMemo(() => StyleSheet.create({
    scroll:{padding:16, paddingBottom:140, gap:16,width:'100%',maxWidth:1120,alignSelf:'center'}, card:{backgroundColor:T.surface, borderColor:T.border,borderWidth:1,borderRadius:18,padding:16,gap:10},
    heading:{color:T.text,fontSize:20,fontWeight:'800'}, title:{color:T.text,fontSize:16,fontWeight:'700'}, text:{color:T.text,fontSize:14,lineHeight:21},
    muted:{color:T.textSecondary,fontSize:13,lineHeight:20}, row:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center'},
    button:{borderColor:T.border,borderWidth:1,borderRadius:12,minHeight:44,paddingVertical:11,paddingHorizontal:14,justifyContent:'center'},
    buttonText:{color:T.text,fontSize:14,fontWeight:'600'}, grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
    metric:{flexGrow:1,flexBasis:width>=768?'22%':'45%',minWidth:120}, number:{fontSize:30,fontWeight:'800',color:T.text},
    line:{borderTopColor:T.border,borderTopWidth:1,paddingTop:12,gap:5}, error:{color:T.danger,fontSize:14,lineHeight:21},
  }),[T,width]);
  return {C,T,s,palette};
}

export function PanelButton({children,onPress,disabled,selected,style,label,...rest}) {
  const {s,C} = usePanelTheme(); const [focused,setFocused] = useState(false);
  const textOnly = React.Children.toArray(children).every(child => typeof child === 'string' || typeof child === 'number');
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label || (typeof children === 'string' ? children : undefined)}
    accessibilityState={{disabled:!!disabled,...(Platform.OS!=='web'&&selected!==undefined?{selected:!!selected}:{})}}
    aria-pressed={selected===undefined?undefined:!!selected} disabled={disabled} onPress={onPress}
    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
    style={[s.button,selected&&{borderColor:C.accent,borderWidth:2},disabled&&{opacity:0.5},style,
      focused&&Platform.OS==='web'&&{outlineStyle:'solid',outlineColor:C.accent,outlineWidth:2,outlineOffset:2}]} {...rest}>
    {textOnly?<Text style={s.buttonText}>{children}</Text>:children}
  </TouchableOpacity>;
}

export function MonthPicker({year,month,onChange,outlined=false}) {
  const {s,C,T} = usePanelTheme();
  const fieldStyle=outlined?{borderWidth:1.5,borderColor:C.accent,borderRadius:12,backgroundColor:T.background}:null;
  const shift=n=>{const d=new Date(year,month-1+n,1);if(d.getFullYear()>=2000&&d.getFullYear()<=2100)onChange(d.getFullYear(),d.getMonth()+1);};
  return <View style={s.card}>
    <View style={s.row}>
      <PanelButton label="Poprzedni miesiąc" onPress={()=>shift(-1)}>‹</PanelButton>
      <Text style={[s.title,{flex:1,textAlign:'center'}]}>{MONTHS[month-1]} {year}</Text>
      <PanelButton label="Następny miesiąc" onPress={()=>shift(1)}>›</PanelButton>
    </View>
    <View style={s.row}>
      <DropdownPicker placeholder="Wybierz miesiąc" selectedValue={month} onValueChange={m=>onChange(year,Number(m))}
        style={[{flex:1,minWidth:130},fieldStyle]} items={MONTHS.map((label,i)=>({label,value:i+1}))}/>
      <DropdownPicker placeholder="Wybierz rok" selectedValue={year} onValueChange={y=>onChange(Number(y),month)}
        style={[{flex:1,minWidth:100},fieldStyle]} items={Array.from({length:101},(_,i)=>({label:String(2000+i),value:2000+i}))}/>
    </View>
    <PanelButton onPress={()=>{const d=new Date();onChange(d.getFullYear(),d.getMonth()+1);}}>Bieżący miesiąc</PanelButton>
  </View>;
}

export function useOverview(year,month,clientId='') {
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const sequence=useRef(0);
  const load=useCallback(async()=>{
    const seq=++sequence.current;setLoading(true);setError('');
    try {const value=await api.getTrainerOverview(year,month,clientId);if(seq===sequence.current)setData(value);}
    catch(e){if(seq===sequence.current){setError(e.message);setData(null);}}
    finally{if(seq===sequence.current)setLoading(false);}
  },[year,month,clientId]);
  useFocusEffect(useCallback(()=>{load();return()=>{sequence.current++;};},[load]));
  return {data,loading,error,load};
}

export function LoadState({loading,error,retry}) {
  const {s,C}=usePanelTheme();
  if(loading)return <ActivityIndicator accessibilityLabel="Pobieranie podsumowania" color={C.accent} style={{margin:30}}/>;
  if(error)return <View style={s.card}><Text accessibilityRole="alert" style={s.error}>Nie udało się pobrać kompletnych danych. {error}</Text><PanelButton onPress={retry}>Spróbuj ponownie</PanelButton></View>;
  return null;
}

export function SessionList({rows,navigation,title='Treningi',empty='Brak wpisów w wybranym okresie.'}) {
  const {s,palette}=usePanelTheme();const [limit,setLimit]=useState(30);
  return <View style={s.card}>
    <Text style={s.title}>{title} · {rows.length}</Text>
    {!rows.length&&<Text style={s.muted}>{empty}</Text>}
    {rows.slice(0,limit).map(r=><PanelButton key={r.id} onPress={()=>new Date(r.date+'T12:00:00').getDay()===0
      ? navigation.navigate('WeekSummary',{weekOf:r.date}) : navigation.navigate('Calendar',{focusDate:r.date,focusHour:r.hour})}
      label={`${r.name}, ${r.date}, ${r.hour==null?'cały dzień':r.hour+':00'}, ${STATUS_NAMES[r.state]}. Otwórz kalendarz`}>
      <Text style={s.title}>{r.name}</Text>
      <Text style={s.muted}>{r.date} · {r.hour==null?'cały dzień':`${r.hour}:00`}</Text>
      <Text style={[s.text,{color:palette[r.state]}]}>{STATUS_NAMES[r.state]}</Text>
      {!!r.detail&&<Text style={s.muted}>{r.detail}</Text>}
    </PanelButton>)}
    {rows.length>limit&&<PanelButton onPress={()=>setLimit(n=>n+30)}>Pokaż kolejne wpisy</PanelButton>}
  </View>;
}
