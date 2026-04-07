import { Path } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Scarf — wraps around neck, one tail hanging */
export function Scarf({ primaryColor }: AvatarTemplateProps) {
  return (
    <>
      <Path
        d="M80 58 Q80 52 100 52 Q120 52 120 58 L122 68 L78 68 Z"
        fill={primaryColor}
      />
      <Path d="M94 64 Q100 72 106 64" fill={primaryColor} opacity={0.8} />
      <Path d="M104 66 Q108 86 102 100 Q98 110 104 118" fill="none" stroke={primaryColor} strokeWidth="8" strokeLinecap="round" opacity={0.7} />
    </>
  );
}
