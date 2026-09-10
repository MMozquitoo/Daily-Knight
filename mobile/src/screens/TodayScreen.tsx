import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TodayOutfit, TodayStatus } from '../types';
import type { TodayEvents } from '../events';
import { OutfitHero } from '../components/OutfitHero';
import { WhyBlock } from '../components/WhyBlock';
import { CarryBlock } from '../components/CarryBlock';
import { TodayActions } from '../components/TodayActions';
import { formatDateLabel } from '../dates';

interface Props {
  outfit: TodayOutfit | null;
  status: TodayStatus;
  events: TodayEvents;
  userName: string;
  onRegenerate?: () => void;
  onAccept?: () => void;
}

// Estados: loading, ready, accepted, error — Contrato de Pantallas v0.2.
// "Sin fila de Planificación para hoy" -> error, con opción de
// regenerar en vivo, no un error genérico.
export function TodayScreen({ outfit, status: initialStatus, events, userName, onRegenerate, onAccept }: Props) {
  const [status, setStatus] = useState<TodayStatus>(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (status === 'ready' && outfit) {
      events.viewed(outfit.date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, outfit?.date]);

  if (status === 'loading') {
    return (
      <View style={styles.centered} testID="today-loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'error' || !outfit) {
    return (
      <View style={styles.centered} testID="today-error">
        <Text style={styles.errorTitle}>Génération en cours…</Text>
        <Text style={styles.errorBody}>La tenue du jour n'est pas encore prête.</Text>
        {onRegenerate ? (
          <Pressable onPress={onRegenerate} accessibilityRole="button" testID="action-retry" style={styles.retryButton}>
            <Text style={styles.retryLabel}>Générer maintenant</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="today-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{formatDateLabel(outfit.date)}</Text>
        <Text style={styles.greeting}>Bonjour {userName}</Text>
      </View>

      <OutfitHero outfit={outfit} events={events} />
      <WhyBlock why={outfit.why} weather={outfit.weather} agenda={outfit.agenda} />
      <CarryBlock carry={outfit.carry} />

      <TodayActions
        status={status}
        onAccept={() => {
          events.accepted(outfit.date);
          setStatus('accepted');
          onAccept?.();
        }}
        onSwap={() => events.swapped(outfit.date, 'top')}
        onRegenerate={() => {
          events.rejected(outfit.date);
          onRegenerate?.();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, gap: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  header: { marginBottom: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#687164' },
  greeting: { fontSize: 24, fontWeight: '600' },
  errorTitle: { fontSize: 16, fontWeight: '600' },
  errorBody: { fontSize: 13, color: '#687164', textAlign: 'center' },
  retryButton: { marginTop: 8, backgroundColor: '#314a35', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  retryLabel: { color: '#fff', fontWeight: '500' },
});
