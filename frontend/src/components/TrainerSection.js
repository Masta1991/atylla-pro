import React, { useId, useState } from 'react';
import { Text, View } from 'react-native';
import { PanelButton, usePanelTheme } from './TrainerPanels';

export default function TrainerSection({title, children, open, onToggle, initialOpen=false, testID}) {
  const {s}=usePanelTheme(); const [expanded,setExpanded]=useState(initialOpen);
  const id=useId(); const visible=open ?? expanded;
  return <View style={s.card} testID={testID}>
    <PanelButton label={title} aria-expanded={visible} aria-controls={id}
      onPress={()=>onToggle?onToggle(!visible):setExpanded(!visible)} style={{borderWidth:0,paddingHorizontal:0}}>
      <View style={[s.row,{justifyContent:'space-between',flexWrap:'nowrap'}]}>
        <Text style={[s.title,{flex:1}]}>{title}</Text><Text style={s.text} aria-hidden>{visible?'−':'+'}</Text>
      </View>
    </PanelButton>
    {visible&&<View nativeID={id} style={{gap:12}}>{children}</View>}
  </View>;
}
