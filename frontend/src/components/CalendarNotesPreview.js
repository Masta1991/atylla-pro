import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { openDialog, showError } from '../services/confirm';
import { calendarNotes, workoutNoteText } from '../services/workoutNotes';
import { acknowledgeWorkoutNote } from '../services/api';

const sourceDate = note => `${new Date(note.event_date + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}, ${note.event_hour}:00`;

export default function CalendarNotesPreview({ event, onAcknowledged, onRefresh, onEmptyFocus }) {
  const notes = calendarNotes(event);
  const noteRefs = useRef({}), focusAfterRead = useRef(false);
  useEffect(() => {
    if (!focusAfterRead.current) return;
    focusAfterRead.current = false;
    const next = notes[0] && noteRefs.current[notes[0].id];
    if (next) next.focus(); else onEmptyFocus?.();
  }, [notes, onEmptyFocus]);
  const acknowledged = (note, result) => {
    focusAfterRead.current = true;
    onAcknowledged(note, result);
  };
  if (!notes.length) return null;
  return <ScrollView testID="calendar-note-list" style={{ maxHeight: 210 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
    {notes.map(note => <NotePreview key={note.id} first={note} openRef={node => { noteRefs.current[note.id] = node; }} onAcknowledged={acknowledged} onRefresh={onRefresh} />)}
  </ScrollView>;
}

function NotePreview({ first, openRef, onAcknowledged, onRefresh }) {
  const { colors: C, themeColors: T } = useTheme();
  const [busy, setBusy] = useState(false), [focused, setFocused] = useState(null);
  const lock = useRef(false);
  const label = first.own ? 'Notatka z tego treningu' : `Notatka z ${sourceDate(first)}`;

  async function acknowledge(note) {
    setBusy(true);
    try {
      const result = await acknowledgeWorkoutNote(note.id, note.note);
      onAcknowledged(note, result);
      return true;
    } catch (error) {
      await showError(error.message);
      await onRefresh?.();
      return false;
    } finally { setBusy(false); }
  }

  async function markFirstRead() {
    if (lock.current || first.note_acknowledged_at) return;
    lock.current = true;
    try { await acknowledge(first); }
    finally { lock.current = false; }
  }

  async function openNotes() {
    if (lock.current) return;
    lock.current = true;
    try {
      const buttons = [{ text: 'Zamknij', style: 'cancel', value: 'close' },
        { text: 'Oznacz jako przeczytaną', value: 'read' }];
      const action = await openDialog(`Notatka · ${sourceDate(first)}`, workoutNoteText(first.note), buttons);
      if (action === 'read') await acknowledge(first);
    } finally { lock.current = false; }
  }

  const focusStyle = key => Platform.OS === 'web' && focused === key
    ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: C.accent, outlineOffset: -2 } : null;
  return <View style={{ marginTop: 8, padding: 7, borderRadius: 10, borderWidth: 1,
    borderColor: T.border, backgroundColor: T.surfaceLight }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TouchableOpacity ref={openRef} testID="calendar-note-preview" accessibilityRole="button"
        accessibilityLabel="Otwórz notatkę" disabled={busy} accessibilityState={{ disabled: busy }}
        onPress={openNotes} onFocus={() => setFocused('open')} onBlur={() => setFocused(null)}
        style={[{ flex: 1, minHeight: 50, justifyContent: 'center', borderRadius: 7, paddingHorizontal: 2 }, focusStyle('open')]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons testID="calendar-note-preview-icon" name="document-text-outline" size={15} color={C.accent} />
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: T.text }} numberOfLines={1}>{busy ? 'Zapisywanie odczytu…' : label}</Text>
          <Ionicons name="chevron-forward" size={15} color={C.accent} />
        </View>
        <Text style={{ color: T.text, fontSize: 12, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>{workoutNoteText(first.note)}</Text>
      </TouchableOpacity>
      {!first.note_acknowledged_at && <TouchableOpacity testID="calendar-note-mark-read"
        accessibilityRole="button" accessibilityLabel="Oznacz notatkę jako przeczytaną"
        accessibilityHint="Ukrywa przypomnienie przy kolejnych treningach"
        disabled={busy} accessibilityState={{ disabled: busy }} onPress={markFirstRead}
        onFocus={() => setFocused('read')} onBlur={() => setFocused(null)}
        style={[{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, alignItems: 'center',
          justifyContent: 'center', backgroundColor: C.accent }, focusStyle('read')]}>
        <Ionicons name="checkmark" size={22} color={T.background} />
      </TouchableOpacity>}
    </View>
  </View>;
}
