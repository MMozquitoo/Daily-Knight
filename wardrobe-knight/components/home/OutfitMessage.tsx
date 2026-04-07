import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface OutfitMessageProps {
  message: string;
}

export function OutfitMessage({ message }: OutfitMessageProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 40,
    paddingTop: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
});
