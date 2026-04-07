import { Line, Path, Rect } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Slim-fit jeans — tapered legs, stitch details */
export function JeansSlim({ primaryColor, secondaryColor }: AvatarTemplateProps) {
  return (
    <>
      <Rect x="66" y="126" width="68" height="10" rx="2" fill={primaryColor} opacity={0.9} />
      <Path d="M68 136 L66 208 L80 208 L84 136 Z" fill={primaryColor} />
      <Path d="M116 136 L120 208 L134 208 L132 136 Z" fill={primaryColor} />
      <Path d="M84 136 L84 158 Q100 166 116 158 L116 136 Z" fill={primaryColor} opacity={0.85} />
      <Line x1="74" y1="140" x2="73" y2="206" stroke={secondaryColor} strokeWidth="0.8" opacity={0.4} />
      <Line x1="126" y1="140" x2="127" y2="206" stroke={secondaryColor} strokeWidth="0.8" opacity={0.4} />
    </>
  );
}
