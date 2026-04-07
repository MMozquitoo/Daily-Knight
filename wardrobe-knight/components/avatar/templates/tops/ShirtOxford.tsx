import { Line, Path, Rect } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Oxford button-down — collared, structured, long sleeves */
export function ShirtOxford({ primaryColor, strokeColor, secondaryColor }: AvatarTemplateProps) {
  return (
    <>
      <Path
        d="M70 70 L130 70 Q136 70 138 76 L142 118 Q142 126 134 126 L66 126 Q58 126 58 118 L62 76 Q64 70 70 70 Z"
        fill={primaryColor}
      />
      <Path d="M88 64 L78 70 L88 76 Z" fill={primaryColor} opacity={0.85} />
      <Path d="M112 64 L122 70 L112 76 Z" fill={primaryColor} opacity={0.85} />
      <Line x1="100" y1="70" x2="100" y2="126" stroke={secondaryColor} strokeWidth="1.5" opacity={0.45} />
      <Path d="M62 74 L40 126 L52 130 L70 82 Z" fill={primaryColor} />
      <Path d="M138 74 L160 126 L148 130 L130 82 Z" fill={primaryColor} />
      <Rect x="38" y="124" width="16" height="6" rx="2" fill={primaryColor} opacity={0.7} />
      <Rect x="146" y="124" width="16" height="6" rx="2" fill={primaryColor} opacity={0.7} />
      <Line x1="88" y1="76" x2="112" y2="76" stroke={strokeColor} strokeWidth="1" opacity={0.12} />
    </>
  );
}
