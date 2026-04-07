import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface TopBarProps {
  date: string;
  location: string;
}

export function TopBar({ date, location }: TopBarProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.separator}> · </Text>
      <Text style={styles.location}>{location}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  separator: {
    fontSize: 15,
    color: THEME.textTertiary,
  },
  location: {
    fontSize: 15,
    fontWeight: '400',
    color: THEME.textSecondary,
  },
});
