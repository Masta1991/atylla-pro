import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

// Measure before rotation: logical width runs along the screen's vertical axis.
export default function DailyFactStrip({ text, width, height, insets, onMeasure }) {
  const { fontScale } = useWindowDimensions();
  const length = Math.max(1, height - insets.top - insets.bottom - 32);
  const measurementKey = `${text}|${length}|${fontScale}`;
  const [measurement, setMeasurement] = useState({ key: '', height: 0 });
  const measuredHeight = measurement.key === measurementKey ? measurement.height : 0;
  const thickness = Math.max(1, width - insets.left - 24);
  const viewportHeight = Math.min(measuredHeight, thickness);
  const scrollable = measuredHeight > thickness;
  const centerY = insets.top + (height - insets.top - insets.bottom) / 2;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Text
        key={`measure:${measurementKey}`}
        testID="daily-fact-measure"
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        aria-hidden pointerEvents="none"
        style={[styles.text, styles.measure, { width: length }]}
        onLayout={event => {
          const next = Math.ceil(event.nativeEvent.layout.height);
          setMeasurement({ key: measurementKey, height: next });
          onMeasure(next + insets.left + 24);
        }}
      >{text}</Text>
      {measuredHeight > 0 && (
        <View
          key={`display:${measurementKey}`}
          testID="daily-fact-rotated"
          style={[styles.rotated, {
            width: length, height: viewportHeight,
            left: insets.left + (width - insets.left - length) / 2,
            top: centerY - viewportHeight / 2,
          }]}
        >
          <ScrollView
            testID="daily-fact-scroll"
            scrollEnabled={scrollable} showsVerticalScrollIndicator={scrollable}
            style={styles.scroll} contentContainerStyle={styles.scrollContent}
            accessibilityLabel={scrollable ? 'Ciekawostka dnia — przewijaj, aby przeczytać całość' : undefined}
            tabIndex={scrollable ? 0 : -1}
          >
            <Text testID="daily-fact-text" style={styles.text}>{text}</Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: '#e6edf3', fontSize: 15, lineHeight: 20, fontWeight: '400', flexShrink: 0 },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0 },
  rotated: { position: 'absolute', transform: [{ rotate: '-90deg' }], overflow: 'hidden' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 0 },
});
