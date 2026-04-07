import { View, Text, Pressable, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_ICONS: Record<string, string> = {
  weather: '\u2600',   // sun
  index: '\u2666',     // diamond (home)
  wardrobe: '\u2630',  // trigram (wardrobe)
};

const TAB_LABELS: Record<string, string> = {
  weather: 'Weather',
  index: 'Home',
  wardrobe: 'Wardrobe',
};

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.bar}>
      {state.routes.map((route, i) => {
        const active = state.index === i;
        return (
          <Pressable
            key={route.key}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            hitSlop={4}
          >
            <Text style={[styles.icon, active && styles.activeIcon]}>
              {TAB_ICONS[route.name] ?? '\u25CB'}
            </Text>
            <Text style={[styles.label, active && styles.activeLabel]}>
              {TAB_LABELS[route.name] ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.border,
    paddingBottom: 28,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  icon: {
    fontSize: 20,
    color: THEME.textTertiary,
  },
  activeIcon: {
    color: THEME.accent,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: THEME.textTertiary,
  },
  activeLabel: {
    color: THEME.accent,
    fontWeight: '600',
  },
});
