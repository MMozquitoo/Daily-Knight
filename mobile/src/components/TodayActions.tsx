import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TodayStatus } from '../types';

interface Props {
  status: TodayStatus;
  onAccept: () => void;
  onSwap: () => void;
  onRegenerate: () => void;
}

// Changer une pièce | Autre tenue quedan ambas visibles — antes "Autre
// tenue" (regenerar todo el outfit) faltaba por completo del wireframe
// original, escondida implícitamente detrás de una elipsis.
export function TodayActions({ status, onAccept, onSwap, onRegenerate }: Props) {
  if (status === 'accepted') {
    return (
      <View style={styles.stack} testID="today-actions-accepted">
        <Text style={styles.confirmed}>Tenue confirmée pour aujourd'hui.</Text>
      </View>
    );
  }

  return (
    <View style={styles.stack} testID="today-actions">
      <Pressable
        onPress={onAccept}
        accessibilityRole="button"
        testID="action-accept"
        style={[styles.button, styles.primary]}
      >
        <Text style={styles.primaryLabel}>Je la porte</Text>
      </Pressable>
      <View style={styles.secondaryRow}>
        <Pressable onPress={onSwap} accessibilityRole="button" testID="action-swap" style={[styles.button, styles.secondary]}>
          <Text style={styles.secondaryLabel}>Changer une pièce</Text>
        </Pressable>
        <Pressable onPress={onRegenerate} accessibilityRole="button" testID="action-regenerate" style={[styles.button, styles.secondary]}>
          <Text style={styles.secondaryLabel}>Autre tenue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8, marginTop: 4 },
  button: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#314a35' },
  primaryLabel: { color: '#ffffff', fontWeight: '500' },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  secondary: { flex: 1, backgroundColor: '#e8ece2' },
  secondaryLabel: { color: '#1e241d', fontWeight: '500', fontSize: 13 },
  confirmed: { fontSize: 13, color: '#3F6B4C', textAlign: 'center', paddingVertical: 12 },
});
