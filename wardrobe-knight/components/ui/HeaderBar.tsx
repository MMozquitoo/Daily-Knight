import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { THEME } from '@/constants/palette';

interface HeaderBarProps {
  onMenuPress: () => void;
  onProfilePress: () => void;
}

/** Grid icon — 4 rounded squares */
function MenuIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      <Rect x="2" y="2" width="9" height="9" rx="2" fill={THEME.text} />
      <Rect x="13" y="2" width="9" height="9" rx="2" fill={THEME.text} />
      <Rect x="2" y="13" width="9" height="9" rx="2" fill={THEME.text} />
      <Rect x="13" y="13" width="9" height="9" rx="2" fill={THEME.text} />
    </Svg>
  );
}

/** Profile icon — simple face circle */
function ProfileIcon() {
  return (
    <Svg width="28" height="28" viewBox="0 0 28 28">
      <Circle cx="14" cy="14" r="13" fill="none" stroke={THEME.text} strokeWidth="1.8" />
      <Circle cx="14" cy="11" r="4.5" fill={THEME.text} />
      <Path
        d="M6 24 Q6 18 14 18 Q22 18 22 24"
        fill={THEME.text}
      />
    </Svg>
  );
}

export function HeaderBar({ onMenuPress, onProfilePress }: HeaderBarProps) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onMenuPress} hitSlop={12} style={styles.iconWrap}>
        <MenuIcon />
      </Pressable>
      <View style={styles.spacer} />
      <Pressable onPress={onProfilePress} hitSlop={12} style={styles.iconWrap}>
        <ProfileIcon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconWrap: {
    padding: 4,
  },
  spacer: {
    flex: 1,
  },
});
