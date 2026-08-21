import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AgendaSummary, WeatherSummary } from '../types';

interface Props {
  why: string;
  weather: WeatherSummary;
  agenda: AgendaSummary;
}

// Bloque único "Pourquoi ?" — explicación + clima + agenda juntos.
// Corrección de wireframes rev. 2: antes el clima vivía separado, arriba
// del outfit, y la explicación abajo — quedaban partidos.
export function WhyBlock({ why, weather, agenda }: Props) {
  return (
    <View style={styles.block} testID="why-block">
      <Text style={styles.eyebrow}>Pourquoi ?</Text>
      <Text style={styles.why}>{why}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaLine}>
          {weather.range} · {weather.condition} · pluie {weather.rainChancePct}%
        </Text>
        <Text style={styles.metaLine}>
          {agenda.eventCount} événement{agenda.eventCount > 1 ? 's' : ''} · journée {agenda.formality}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#fafbf7', borderRadius: 20, padding: 16, gap: 10 },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#687164' },
  why: { fontSize: 14, lineHeight: 20 },
  meta: { gap: 4 },
  metaLine: { fontSize: 11.5, color: '#687164' },
});
