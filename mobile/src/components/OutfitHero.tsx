import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TodayOutfit } from '../types';
import type { TodayEvents } from '../events';
import { GarmentVisual } from './GarmentVisual';

interface Props {
  outfit: TodayOutfit;
  events: TodayEvents;
}

function GarmentCard({
  garment,
  size,
  events,
}: {
  garment: TodayOutfit['top'];
  size: 'lg' | 'sm';
  events: TodayEvents;
}) {
  return (
    <View style={styles.card} testID={`garment-card-${garment.id}`}>
      <GarmentVisual garment={garment} size={size} events={events} testID={`garment-visual-${garment.id}`} />
      <Text style={styles.id}>{garment.id}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {garment.category}{garment.brand ? ` ${garment.brand}` : ''}
      </Text>
      <Text style={styles.color} numberOfLines={1}>{garment.color}</Text>
    </View>
  );
}

export function OutfitHero({ outfit, events }: Props) {
  return (
    <View style={styles.stage} accessibilityLabel={`Outfit ${outfit.top.id}, ${outfit.bottom.id} y ${outfit.shoes.id}`}>
      <View style={styles.column}>
        <GarmentCard garment={outfit.top} size="lg" events={events} />
      </View>
      <View style={styles.column}>
        <GarmentCard garment={outfit.bottom} size="sm" events={events} />
        <GarmentCard garment={outfit.shoes} size="sm" events={events} />
      </View>
      {outfit.outerwear ? (
        <View style={styles.outerwearRow}>
          <GarmentCard garment={outfit.outerwear} size="sm" events={events} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', gap: 10, backgroundColor: '#fafbf7', borderRadius: 24, padding: 12 },
  column: { flex: 1, gap: 10 },
  outerwearRow: { width: '100%' },
  card: { gap: 2 },
  id: { fontSize: 9, color: '#687164', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 12, fontWeight: '500' },
  color: { fontSize: 10, color: '#687164' },
});
