import { Circle, Path, Rect } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Long coat — extends below waist, double-breasted look */
export function Coat({ primaryColor, strokeColor }: AvatarTemplateProps) {
  return (
    <>
      <Path
        d="M58 68 L142 68 Q148 68 150 74 L154 148 Q154 156 144 156 L56 156 Q46 156 46 148 L50 74 Q52 68 58 68 Z"
        fill={primaryColor}
      />
      <Path d="M86 60 L68 68 L82 86 Z" fill={primaryColor} opacity={0.8} />
      <Path d="M114 60 L132 68 L118 86 Z" fill={primaryColor} opacity={0.8} />
      <Circle cx="92" cy="94" r="3" fill={strokeColor} opacity={0.12} />
      <Circle cx="92" cy="112" r="3" fill={strokeColor} opacity={0.12} />
      <Circle cx="92" cy="130" r="3" fill={strokeColor} opacity={0.12} />
      <Path d="M52 74 L28 136 L42 140 L60 82 Z" fill={primaryColor} />
      <Path d="M148 74 L172 136 L158 140 L140 82 Z" fill={primaryColor} />
      <Rect x="48" y="152" width="104" height="5" rx="2" fill={primaryColor} opacity={0.7} />
    </>
  );
}
