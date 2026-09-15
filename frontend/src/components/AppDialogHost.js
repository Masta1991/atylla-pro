import React, {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '../context/ThemeContext';
import {subscribeDialogs, getDialog, closeDialog} from '../services/confirm';

function buttonTextColor(hex) {
  const rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255);
  const linear=rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  const luminance=linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
  return (luminance+0.05)/0.055 > 1.05/(luminance+0.05) ? '#0d1117' : '#ffffff';
}

export default function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeDialogs, getDialog, getDialog);
  const {colors:C, themeColors:T} = useTheme();
  const modalRef=useRef(null), firstRef=useRef(null);
  const [focused,setFocused]=useState(null);
  const cancel = () => closeDialog(dialog?.buttons.find(b=>b.style==='cancel'));
  useEffect(()=>{
    if(!dialog || Platform.OS!=='web')return;
    const trigger=document.activeElement;
    const root=modalRef.current;
    if(!root)return;
    const background=Array.from(document.body.children).filter(n=>!n.contains(root));
    const previous=background.map(n=>[n,n.inert]);
    previous.forEach(([n])=>{n.inert=true;});
    firstRef.current?.focus();
    return ()=>{
      previous.forEach(([n,value])=>{n.inert=value;});
      if(trigger?.isConnected && !trigger.closest('[inert],[aria-hidden="true"]'))trigger.focus();
    };
  },[dialog]);
  if(!dialog)return null;
  const tone=dialog.title==='Sukces' ? T.success : C.accent;
  return <Modal ref={modalRef} visible transparent animationType="none"
    accessibilityLabel={dialog.title} onRequestClose={cancel}>
    <View style={styles.overlay}>
      <View style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={()=>true} onResponderRelease={cancel}
        {...(Platform.OS==='web'?{onClick:cancel}:{})} />
      <View style={[styles.card,{backgroundColor:T.surface,borderColor:T.border}]}>
        <View style={[styles.badge,{backgroundColor:C.accent+'18'}]}>
          <Ionicons name={dialog.title==='Sukces'?'checkmark-circle-outline':'information-circle-outline'}
            size={28} color={tone||C.accent}/>
        </View>
        <Text accessibilityRole="header" style={[styles.title,{color:T.text}]}>{dialog.title}</Text>
        <ScrollView style={styles.body}>
          <Text style={[styles.message,{color:T.textSecondary}]}>{dialog.message}</Text>
        </ScrollView>
        <View style={styles.actions}>
          {dialog.buttons.map((button,index)=>{
            const secondary=button.style==='cancel';
            const color=button.style==='destructive'?T.danger:C.accent;
            return <TouchableOpacity key={index} ref={index===0?firstRef:undefined}
              accessibilityRole="button" accessibilityLabel={button.text}
              onFocus={()=>setFocused(index)} onBlur={()=>setFocused(null)}
              onPress={()=>closeDialog(button)}
              style={[styles.button,{backgroundColor:secondary?T.surfaceLight:color,
                borderColor:secondary?T.border:color},
                Platform.OS==='web'&&focused===index?{outlineStyle:'solid',outlineWidth:3,outlineColor:T.text,outlineOffset:2}:null]}>
              <Text style={[styles.buttonText,{color:secondary?T.text:buttonTextColor(color)}]}>{button.text}</Text>
            </TouchableOpacity>;
          })}
        </View>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  overlay:{flex:1,justifyContent:'center',alignItems:'center',padding:20,backgroundColor:'rgba(0,0,0,0.58)'},
  card:{width:'100%',maxWidth:440,maxHeight:'90%',padding:24,borderWidth:1,borderRadius:22,
    shadowColor:'#000',shadowOpacity:0.25,shadowRadius:24,shadowOffset:{width:0,height:10},elevation:12},
  badge:{width:48,height:48,borderRadius:15,alignItems:'center',justifyContent:'center',marginBottom:16},
  title:{fontSize:21,fontWeight:'700',marginBottom:10},
  body:{flexGrow:0,flexShrink:1},
  message:{fontSize:15,lineHeight:23},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:24},
  button:{flexGrow:1,flexBasis:110,minHeight:46,alignItems:'center',justifyContent:'center',padding:12,borderRadius:12,borderWidth:1},
  buttonText:{fontSize:15,fontWeight:'700',textAlign:'center'}
});
