// Namespaced keys keep a plan and a muscle group with the same ID distinct.
export function workoutCatalog(plans, groups, grouped) {
  return [
    ...groups.map(g => ({ key: `group:${g.id}`, id: g.id, type: 'group', name: g.name,
      label: `Partia · ${g.name}`, exercises: (grouped[g.name] || []).map(e => ({ exercise_id: e.id, exercises: e, sets_data: [] })) })),
    ...plans.map(p => ({ key: `plan:${p.id}`, id: p.id, type: 'plan', name: p.name, label: `Plan · ${p.name}` })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.type.localeCompare(b.type));
}

const units = { KG: 'kg', KM: 'km', MIN: 'min', SEK: 'sek', POW: 'powt.' };
export function planSetText(set, unit) {
  const value = v => v === '' || v == null ? '—' : v;
  return `${value(set.reps)} × ${value(set.weight)} ${units[(unit || 'KG').toUpperCase()] || unit}`;
}
export function workoutShareText(blocks) {
  return '💪 *Twój Plan Treningowy*\n\n' + blocks.map(block => {
    const rows = block.exercises.map((row, i) => {
      const exercise = row.exercises || {};
      const sets = (row.sets_data || []).map((set, j) => `   - Seria ${j + 1}: ${planSetText(set, exercise.unit)}`).join('\n');
      return `${i + 1}. ${exercise.name || row.exercise_id}${sets ? '\n' + sets : ''}`;
    }).join('\n');
    return `🔥 *${block.name}*\n${rows || 'Brak ćwiczeń w tym zestawie.'}`;
  }).join('\n\n') + '\n\nPowodzenia na treningu!';
}
