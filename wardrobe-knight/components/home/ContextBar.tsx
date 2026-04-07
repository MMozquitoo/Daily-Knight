import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { THEME } from '@/constants/palette';

interface ContextBarProps {
  temperature: number;
  unit?: string;
  onTempPress?: () => void;
  onCalendarPress?: () => void;
  onScanPress?: () => void;
}

/** Thermometer icon */
function TempIcon() {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24">
      <Path
        d="M12 2 C10 2 8.5 3.5 8.5 5.5 L8.5 14 C7 15.2 6 17 6 19 C6 22.3 8.7 25 12 25 C15.3 25 18 22.3 18 19 C18 17 17 15.2 15.5 14 L15.5 5.5 C15.5 3.5 14 2 12 2 Z"
        fill="none" stroke={THEME.text} strokeWidth="1.8"
      />
      <Circle cx="12" cy="19" r="3" fill={THEME.text} />
      <Line x1="12" y1="19" x2="12" y2="8" stroke={THEME.text} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

/** Calendar icon */
function CalendarIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24">
      <Rect x="3" y="4" width="18" height="18" rx="3" fill="none" stroke={THEME.text} strokeWidth="1.8" />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={THEME.text} strokeWidth="1.8" />
      <Line x1="8" y1="2" x2="8" y2="6" stroke={THEME.text} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="16" y1="2" x2="16" y2="6" stroke={THEME.text} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/** Camera/scan icon */
function ScanIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24">
      {/* Camera body */}
      <Rect x="2" y="6" width="20" height="14" rx="3" fill="none" stroke={THEME.text} strokeWidth="1.8" />
      {/* Lens */}
      <Circle cx="12" cy="13" r="4" fill="none" stroke={THEME.text} strokeWidth="1.8" />
      {/* Flash bump */}
      <Path d="M8 6 L9 3 L15 3 L16 6" fill="none" stroke={THEME.text} strokeWidth="1.8" />
    </Svg>
  );
}

function ContextButton({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      {children}
      {label ? <Text style={styles.buttonLabel}>{label}</Text> : null}
    </Pressable>
  );
}

export function ContextBar({
  temperature,
  unit = '°',
  onTempPress,
  onCalendarPress,
  onScanPress,
}: ContextBarProps) {
  return (
    <View style={styles.container}>
      <ContextButton label={`${temperature}${unit}`} onPress={onTempPress}>
        <TempIcon />
      </ContextButton>
      <ContextButton onPress={onCalendarPress}>
        <CalendarIcon />
      </ContextButton>
      <ContextButton onPress={onScanPress}>
        <ScanIcon />
      </ContextButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 60,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
});
