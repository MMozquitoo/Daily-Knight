import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Garment } from '../types';
import { resolveGarmentImage } from '../types';
import type { TodayEvents } from '../events';

interface Props {
  garment: Garment;
  size: 'lg' | 'sm';
  events: TodayEvents;
  testID?: string;
}

// Intencional: no hay ninguna rama visual por tier. clean, product y raw
// se renderizan exactamente igual — el fallback es invisible al usuario
// (Contrato de Pantallas v0.2, sección Hoy > Fallback de imagen).
// El tier solo se reporta como telemetría.
export function GarmentVisual({ garment, size, events, testID }: Props) {
  const { uri, tier } = resolveGarmentImage(garment.assets);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (tier !== 'clean' && !reportedRef.current) {
      reportedRef.current = true;
      events.imageFallbackUsed(garment.id, tier);
    }
  }, [garment.id, tier, events]);

  return (
    <View
      testID={testID}
      style={[styles.shape, size === 'lg' ? styles.shapeLg : styles.shapeSm]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`${garment.category} ${garment.color}`} />
      ) : (
        // única rama visible distinta: falta TODA foto (raw y product también ausentes).
        <Text style={styles.placeholderLabel}>{garment.category}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shape: {
    borderRadius: 18,
    backgroundColor: '#e8ece2',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeLg: { minHeight: 224 },
  shapeSm: { minHeight: 94 },
  placeholderLabel: { fontSize: 11, color: '#687164', textTransform: 'uppercase' },
});
