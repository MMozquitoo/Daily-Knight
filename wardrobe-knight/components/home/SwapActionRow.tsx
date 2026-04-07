import { View, Text, Pressable, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface SwapAction {
  label: string;
  onPress: () => void;
}

interface SwapActionRowProps {
  actions: SwapAction[];
}

export function SwapActionRow({ actions }: SwapActionRowProps) {
  return (
    <View style={styles.container}>
      {actions.map((action, i) => (
        <View key={action.label} style={styles.wrapper}>
          {i > 0 && <Text style={styles.separator}>·</Text>}
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.link}>{action.label}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '500',
    color: THEME.accent,
  },
  separator: {
    fontSize: 14,
    color: THEME.textTertiary,
    marginHorizontal: 12,
  },
});
