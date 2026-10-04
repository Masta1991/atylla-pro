import React, { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { MONTHS, PanelButton, usePanelTheme } from './TrainerPanels';
import TrainerSection from './TrainerSection';
const HEIGHT=240,COLUMN=72;
const format=n=>n==null?'—':n.toLocaleString('pl-PL');
const unknown=m=>['missing','future'].includes(m.coverage);
export default function AnnualTrainingChart({year,month,months,annual,onSelect}) {
  const {s,T,C}=usePanelTheme(),scroll=useRef(null);
  months=months.map(m=>({...m,total:(m.done||0)+(m.paid||0)}));
  const ceiling=Math.ceil(Math.max(4,...months.map(m=>m.total))/4)*4;
  const selected=months.find(m=>m.month===month);
  return <View style={s.card} testID="annual-chart">
    <View><Text style={s.title}>Treningi w roku {year}</Text><Text style={s.muted}>Odbyte + odwołane opłacone</Text></View>
    <View style={{flexDirection:'row',gap:4}}>
      <View style={{width:26,height:HEIGHT,marginTop:30}} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {[4,3,2,1,0].map(t=><Text key={t} style={[s.muted,{position:'absolute',right:4,top:HEIGHT*(1-t/4)-9}]}>{ceiling*t/4}</Text>)}
      </View>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator style={{flex:1}}
        onContentSizeChange={()=>scroll.current?.scrollTo({x:Math.max(0,(month-2)*COLUMN),animated:false})}>
        <View style={{flexDirection:'row',padding:2,paddingBottom:8}}>
          {months.map(m=><PanelButton key={m.month} selected={m.month===month} onPress={()=>onSelect(year,m.month)}
            label={MONTHS[m.month-1]+' '+year+(unknown(m)?': brak danych':': Odbyte '+m.done+', Odwołane opłacone '+m.paid)}
            style={{width:66,marginRight:6,paddingHorizontal:4,paddingVertical:8,alignItems:'center',borderColor:m.month===month?T.copper:'transparent'}}>
            <Text style={[s.title,{height:22}]}>{unknown(m)?'—':m.total}</Text>
            <View style={{height:HEIGHT,width:'100%',justifyContent:'flex-end',alignItems:'center'}} testID={'month-bars-'+m.month}>
              {[0,1,2,3,4].map(t=><View key={t} style={{position:'absolute',bottom:HEIGHT*t/4,width:'100%',height:1,backgroundColor:T.border}}/>)}
              <View testID={'month-'+m.month+'-total'} style={{height:HEIGHT*m.total/ceiling,width:30,backgroundColor:C.accent}}/>
            </View>
            <Text style={[s.text,{marginTop:10}]}>{MONTHS[m.month-1].slice(0,3)}</Text>
          </PanelButton>)}
        </View>
      </ScrollView>
    </View>
    {selected&&<View style={{backgroundColor:T.raised,borderRadius:12,padding:12}} testID="month-exact-values">
      <View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}><Text style={[s.title,{flex:1}]}>{MONTHS[month-1]} {year}</Text><Text style={s.title}>{unknown(selected)?'—':selected.total} sesji</Text></View>
      {[['Odbyte',selected.done],['Odwołane opłacone',selected.paid]].map(([label,count])=><View key={label} style={{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:T.border,paddingVertical:10,gap:8}}><Text style={s.muted}>{label}</Text><Text style={[s.muted,{color:T.text,fontWeight:'700'}]}>{unknown(selected)?'—':count}</Text></View>)}
    </View>}
    <TrainerSection title="Pokaż liczby całego roku">
      <View testID="annual-numbers" role="table" aria-label="Liczby całego roku">
        <AnnualRow header values={['Miesiąc','Odbyte','Odwołane\nopłacone','Odbyte\n/ tydzień']}/>
        {months.map(m=><AnnualRow key={m.month} values={[MONTHS[m.month-1],unknown(m)?'—':m.done,unknown(m)?'—':m.paid,format(m.weekly_average)]}/>)}
        {annual&&<AnnualRow total values={['Pełne m-ce',annual.done,annual.paid,format(annual.weekly_average)]}/>}
      </View>
      <Text style={s.muted}>Średnia: odbyte treningi ÷ (dni kalendarzowe / 7). Obejmuje tygodnie urlopowe. Suma waży miesiące liczbą dni. Pomijamy pierwszy, bieżący, przyszłe i miesiące bez zapisów — brak historii nie potwierdza zera.</Text>
      {annual&&<View style={s.evidence}><Text style={[s.muted,{flex:1}]}>Udział opłaconych odwołań{'\n'}w pełnych miesiącach</Text><Text style={s.title}>{annual.paid_share==null?'—':format(annual.paid_share)+'%'}</Text></View>}
    </TrainerSection>
  </View>;
}
function AnnualRow({values,header=false,total=false}) {
  const {s,T}=usePanelTheme();
  return <View role="row" style={{flexDirection:'row',borderBottomWidth:1,borderBottomColor:T.border,paddingVertical:10,backgroundColor:total?T.raised:'transparent'}}>
    {values.map((v,i)=><Text key={i} role={header?'columnheader':'cell'} style={[s.muted,{flex:i===0?1.5:i===2?1.3:1,minWidth:0,paddingHorizontal:3,textAlign:i?'right':'left',color:header?T.textSecondary:T.text,fontWeight:total?'700':'400'}]}>{v}</Text>)}
  </View>;
}
