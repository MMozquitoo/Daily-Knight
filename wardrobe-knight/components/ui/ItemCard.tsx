import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ITEM_COLORS, THEME } from '@/constants/palette';
import type { WardrobeItem } from '@/types/wardrobe';

interface ItemCardProps {
  item: WardrobeItem;
  onPress?: (id: string) => void;
}

export function ItemCard({ item, onPress }: ItemCardProps) {
  return (
    <Pressable
      style={[styles.card, item.availability === 'unavailable' && styles.cardMuted]}
      onPress={() => onPress?.(item.id)}
    >
      <View style={[styles.swatch, { backgroundColor: ITEM_COLORS[item.color].hex }]} />
      <View style={styles.body}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.category} · {item.formality}
        </Text>
      </View>
      <Text style={styles.status}>{item.availability === 'available' ? 'Ready' : 'Off'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: THEME.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
    gap: 12,
  },
  cardMuted: {
    opacity: 0.6,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.border,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  meta: {
    marginTop: 2,
    fontSize: 13,
    color: THEME.textSecondary,
    textTransform: 'capitalize',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textTertiary,
  },
});
