import { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { AVATAR_COLORS } from '@/constants/palette';

export function BaseBodyLayer() {
  return (
    <>
      <Rect x="72" y="18" width="56" height="14" rx="4" fill={AVATAR_COLORS.helmetShadow} />
      <Path
        d="M70 32 Q70 4 100 4 Q130 4 130 32 L130 52 Q130 58 124 58 L76 58 Q70 58 70 52 Z"
        fill={AVATAR_COLORS.helmet}
      />
      <Path
        d="M100 4 Q100 -8 110 -8 Q118 -8 118 2 Q118 4 116 6"
        fill="none"
        stroke={AVATAR_COLORS.helmetStroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Ellipse cx="100" cy="44" rx="18" ry="10" fill={AVATAR_COLORS.helmetShadow} opacity={0.5} />
      <Rect x="92" y="58" width="16" height="10" fill={AVATAR_COLORS.helmet} />
      <Path
        d="M68 68 L132 68 Q138 68 140 74 L146 120 Q148 128 140 130 L60 130 Q52 128 54 120 L60 74 Q62 68 68 68 Z"
        fill={AVATAR_COLORS.armor}
      />
      <Rect x="62" y="126" width="76" height="8" rx="2" fill={AVATAR_COLORS.helmet} />
      <Path d="M70 134 L66 210 L82 210 L86 134 Z" fill={AVATAR_COLORS.armor} />
      <Path d="M114 134 L118 210 L134 210 L130 134 Z" fill={AVATAR_COLORS.armor} />
      <Path d="M60 74 L38 130 L50 134 L68 82 Z" fill={AVATAR_COLORS.armor} />
      <Path d="M140 74 L162 130 L150 134 L132 82 Z" fill={AVATAR_COLORS.armor} />
      <Circle cx="44" cy="132" r="8" fill={AVATAR_COLORS.helmet} />
      <Circle cx="156" cy="132" r="8" fill={AVATAR_COLORS.helmet} />
      <Path d="M62 208 L58 222 Q56 228 64 228 L86 228 Q90 228 88 222 L86 210 Z" fill={AVATAR_COLORS.helmetShadow} />
      <Path d="M114 208 L112 222 Q110 228 118 228 L140 228 Q144 228 142 222 L138 210 Z" fill={AVATAR_COLORS.helmetShadow} />
    </>
  );
}
