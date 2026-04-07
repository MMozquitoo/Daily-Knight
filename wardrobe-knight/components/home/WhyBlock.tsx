import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface WhyBlockProps {
  message: string;
}

export function WhyBlock({ message }: WhyBlockProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Why</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.textSecondary,
  },
});
