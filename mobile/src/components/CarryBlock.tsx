import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  carry?: string;
}

// Estado vacío como código, no como caso especial de la UI: si no hay
// carry, el componente no renderiza nada — nunca un hueco vacío.
// (Contrato de Pantallas v0.2: "se omite el bloque entero".)
export function CarryBlock({ carry }: Props) {
  if (!carry) return null;
  return (
    <View style={styles.block} testID="carry-block">
      <Text style={styles.text}>À emporter : {carry}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#e8ece2', borderRadius: 14, padding: 12 },
  text: { fontSize: 13 },
});
