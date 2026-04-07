import { Line, Path } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Blazer — structured, lapels, open front */
export function Blazer({ primaryColor, strokeColor }: AvatarTemplateProps) {
  return (
    <>
      <Path
        d="M62 68 L138 68 Q144 68 146 74 L150 120 Q150 130 140 130 L60 130 Q50 130 50 120 L54 74 Q56 68 62 68 Z"
        fill={primaryColor}
      />
      <Path d="M90 66 L72 68 L80 92 L96 84 Z" fill={primaryColor} opacity={0.8} />
      <Path d="M110 66 L128 68 L120 92 L104 84 Z" fill={primaryColor} opacity={0.8} />
      <Path
        d="M96 84 L100 130 L104 84"
        fill="none" stroke={strokeColor} strokeWidth="1" opacity={0.08}
      />
      <Path d="M56 74 L32 130 L46 134 L64 82 Z" fill={primaryColor} />
      <Path d="M144 74 L168 130 L154 134 L136 82 Z" fill={primaryColor} />
      <Line x1="66" y1="104" x2="84" y2="104" stroke={strokeColor} strokeWidth="1" opacity={0.1} />
      <Line x1="116" y1="104" x2="134" y2="104" stroke={strokeColor} strokeWidth="1" opacity={0.1} />
    </>
  );
}
