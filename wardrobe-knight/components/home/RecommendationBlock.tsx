import { View, Text, StyleSheet } from 'react-native';
import { THEME, ITEM_COLORS } from '@/constants/palette';
import type { PaletteColor } from '@/types/wardrobe';

interface WearItem {
  layer: string;
  name: string;
  color: PaletteColor;
}

interface RecommendationBlockProps {
  items: WearItem[];
}

function ColorDot({ color }: { color: PaletteColor }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: ITEM_COLORS[color]?.hex ?? THEME.textTertiary },
      ]}
    />
  );
}

export function RecommendationBlock({ items }: RecommendationBlockProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wear</Text>
      {items.map((item) => (
        <View key={item.layer} style={styles.row}>
          <ColorDot color={item.color} />
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.layer}>{item.layer}</Text>
        </View>
      ))}
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
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: THEME.text,
  },
  layer: {
    fontSize: 12,
    color: THEME.textTertiary,
    textTransform: 'capitalize',
  },
});
