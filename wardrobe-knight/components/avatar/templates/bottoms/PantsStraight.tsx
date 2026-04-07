import { Path, Rect } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Straight-cut pants / chinos — classic silhouette */
export function PantsStraight({ primaryColor }: AvatarTemplateProps) {
  return (
    <>
      <Rect x="64" y="126" width="72" height="10" rx="2" fill={primaryColor} opacity={0.9} />
      <Path d="M66 136 L62 208 L82 208 L84 136 Z" fill={primaryColor} />
      <Path d="M116 136 L118 208 L138 208 L134 136 Z" fill={primaryColor} />
      <Path d="M84 136 L84 160 Q100 170 116 160 L116 136 Z" fill={primaryColor} opacity={0.85} />
    </>
  );
}
