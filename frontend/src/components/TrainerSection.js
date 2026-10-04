import React, { useId, useState } from 'react';
import { Text, View } from 'react-native';
import { PanelButton, usePanelTheme } from './TrainerPanels';

export default function TrainerSection({title, children, open, onToggle, initialOpen=false, testID}) {
  const {s,T,design}=usePanelTheme(); const [expanded,setExpanded]=useState(initialOpen);
  const id=useId(); const visible=open ?? expanded;
  return <View style={design?{borderTopWidth:1,borderTopColor:T.border}:s.card} testID={testID}>
    <PanelButton label={title} aria-expanded={visible} aria-controls={id}
      onPress={()=>onToggle?onToggle(!visible):setExpanded(!visible)} style={{borderWidth:0,paddingHorizontal:0,minHeight:48}}>
      <View style={[s.row,{justifyContent:'space-between',flexWrap:'nowrap'}]}>
        {design&&<Text style={s.text} aria-hidden>{visible?'▾':'▸'}</Text>}
        <Text style={[s.title,{flex:1,fontWeight:'600'}]}>{title}</Text>{!design&&<Text style={s.text} aria-hidden>{visible?'−':'+'}</Text>}
      </View>
    </PanelButton>
    {visible&&<View nativeID={id} style={{gap:12,paddingBottom:design?12:0}}>{children}</View>}
  </View>;
}
