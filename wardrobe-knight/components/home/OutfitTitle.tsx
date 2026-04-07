import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface OutfitTitleProps {
  name: string;
}

export function OutfitTitle({ name }: OutfitTitleProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
