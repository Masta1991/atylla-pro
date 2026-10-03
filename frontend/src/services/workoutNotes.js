export const workoutNoteText = value => String(value || '').replace(/\[BILLING:[^\]]*\]/g, '').trim();

export function calendarNotes(event) {
  if (!event) return [];
  const own = workoutNoteText(event.note) && !event.note_acknowledged_at ? [{ ...event, own: true }] : [];
  const previous = (event.pending_notes || []).filter(n => n.id !== event.id && !n.note_acknowledged_at && workoutNoteText(n.note));
  // Acknowledgement hides the reminder; source text remains in training history.
  return [...previous, ...own];
}

export function applyNoteRead(event, source, result) {
  if (!event) return event;
  return { ...event,
    ...(event.id === source.id && event.note === source.note ? { note_acknowledged_at: result.note_acknowledged_at } : {}),
    pending_notes: (event.pending_notes || []).filter(n => n.id !== source.id || n.note !== source.note),
  };
}
