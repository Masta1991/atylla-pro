import React, { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { MONTHS, STATES, STATUS_NAMES, PanelButton, usePanelTheme } from './TrainerPanels';

const HEIGHT = 280, COLUMN = 82;
export default function AnnualTrainingChart({ year, month, months, onSelect }) {
  const { s, T, C, palette } = usePanelTheme();
  const scroll = useRef(null);
  const [table, setTable] = useState(false);
  const max = Math.max(4, ...months.map(m => m.total));
  const ceiling = Math.ceil(max / 4) * 4;
  const selected = months.find(m => m.month === month);
  return <View style={s.card} testID="annual-chart">
    <Text style={s.title}>Treningi w roku {year}</Text>
    <Text style={s.muted}>Wysokość słupka pokazuje liczbę sesji. Wybierz miesiąc, aby odczytać dokładne wartości każdego statusu.</Text>
    <Text style={s.muted}>Łączna liczba treningów w każdym miesiącu</Text>
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 38, height: HEIGHT, marginTop: 43 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {[4, 3, 2, 1, 0].map(t => <Text key={t} style={[s.muted, { position: 'absolute', top: HEIGHT * (1 - t / 4) - 10, fontSize: 11 }]}>{ceiling * t / 4}</Text>)}
      </View>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}
        onContentSizeChange={() => scroll.current?.scrollTo({ x: Math.max(0, (month - 2) * COLUMN), animated: false })}>
        <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
          {months.map(m => <PanelButton key={m.month} selected={m.month === month} onPress={() => onSelect(year, m.month)}
            label={`${MONTHS[m.month - 1]} ${year}: ${STATES.map(k => STATUS_NAMES[k] + ' ' + m[k]).join(', ')}`}
            style={{ width: COLUMN - 6, marginRight: 6, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={[s.title, { height: 26 }]}>{m.total}</Text>
            <View style={{ height: HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }} testID={`month-bars-${m.month}`}>
              {[0, 1, 2, 3, 4].map(t => <View key={'grid' + t} style={{ position: 'absolute', bottom: HEIGHT * t / 4, width: '100%', height: 1, backgroundColor: T.border }} />)}
              <View testID={`month-${m.month}-total`} style={{ height: HEIGHT * m.total / ceiling, width: 34, backgroundColor: C.accent }} />
            </View>
            <Text style={[s.text, { marginTop: 12, fontWeight: m.month === month ? '800' : '400' }]}>{MONTHS[m.month - 1].slice(0, 3)}</Text>
          </PanelButton>)}
        </View>
      </ScrollView>
    </View>
    {selected && <View style={[s.card, { backgroundColor: T.background, borderColor: C.accent }]} testID="month-exact-values">
      <Text style={s.title}>{MONTHS[month - 1]} {year} · {selected.total} sesji</Text>
      <Text style={s.muted}>Szczegóły miesiąca — skala dopasowana do jego wyników.</Text>
      {STATES.map(k => <View key={k} style={{ gap: 6 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={[s.text, { flex: 1 }]}>{STATUS_NAMES[k]}</Text><Text style={[s.title, { color: palette[k] }]}>{selected[k]}</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: T.border, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${100 * selected[k] / Math.max(1, ...STATES.map(key => selected[key]))}%`, backgroundColor: palette[k] }} />
        </View>
      </View>)}
      {selected.unknown > 0 && <Text style={s.muted}>Dodatkowo: {selected.unknown} zgłoszeń bez danych o rozliczeniu.</Text>}
    </View>}
    <PanelButton selected={table} onPress={() => setTable(v => !v)}>{table ? 'Ukryj liczby całego roku' : 'Pokaż liczby całego roku'}</PanelButton>
    {table && months.map(m => <View key={m.month} style={s.line}>
      <Text style={s.title}>{MONTHS[m.month - 1]} · {m.total} sesji</Text>
      <View style={s.row}>{STATES.map(k => <Text key={k} style={s.text}>{STATUS_NAMES[k]}: {m[k]}</Text>)}</View>
    </View>)}
  </View>;
}
