import { Pressable, Text, StyleSheet } from 'react-native';
import { THEME } from '@/constants/palette';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: THEME.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: THEME.surfaceMute,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.white,
    letterSpacing: 0.3,
  },
  labelDisabled: {
    color: THEME.textTertiary,
  },
});
