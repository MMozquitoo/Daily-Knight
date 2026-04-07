import { Ellipse, Path } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Loafers — low profile, rounded, no laces */
export function Loafers({ primaryColor, strokeColor }: AvatarTemplateProps) {
  return (
    <>
      <Path d="M62 210 L58 220 Q56 226 64 226 L86 226 Q90 226 88 220 L84 212 Z" fill={primaryColor} />
      <Ellipse cx="73" cy="212" rx="9" ry="3" fill={strokeColor} opacity={0.12} />
      <Path d="M58 224 Q72 228 88 224" fill="none" stroke={strokeColor} strokeWidth="1" opacity={0.15} />
      <Path d="M116 210 L112 220 Q110 226 118 226 L140 226 Q144 226 142 220 L138 212 Z" fill={primaryColor} />
      <Ellipse cx="127" cy="212" rx="9" ry="3" fill={strokeColor} opacity={0.12} />
      <Path d="M112 224 Q126 228 142 224" fill="none" stroke={strokeColor} strokeWidth="1" opacity={0.15} />
    </>
  );
}
