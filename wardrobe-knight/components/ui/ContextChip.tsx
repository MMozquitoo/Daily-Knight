import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface ContextChipProps {
  label: string;
}

export function ContextChip({ label }: ContextChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

interface ContextChipRowProps {
  chips: string[];
}

export function ContextChipRow({ chips }: ContextChipRowProps) {
  return (
    <View style={styles.row}>
      {chips.map((label) => (
        <ContextChip key={label} label={label} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  chip: {
    backgroundColor: THEME.surfaceMute,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME.textSecondary,
  },
});
