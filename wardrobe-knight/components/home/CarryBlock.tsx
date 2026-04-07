import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';
import type { CarryItem } from '@/types/outfit';

const CARRY_LABELS: Record<CarryItem, string> = {
  umbrella: 'Umbrella',
  'light-layer': 'Light layer',
  bag: 'Bag',
  sunglasses: 'Sunglasses',
};

const CARRY_SYMBOLS: Record<CarryItem, string> = {
  umbrella: '\u2602',     // umbrella symbol
  'light-layer': '\u2728', // sparkles (layers)
  bag: '\u25A1',           // square (bag)
  sunglasses: '\u25CB',    // circle (sunglasses)
};

interface CarryBlockProps {
  items: CarryItem[];
}

export function CarryBlock({ items }: CarryBlockProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Carry</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <View key={item} style={styles.pill}>
            <Text style={styles.symbol}>{CARRY_SYMBOLS[item]}</Text>
            <Text style={styles.label}>{CARRY_LABELS[item]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceMute,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  symbol: {
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.text,
  },
});
