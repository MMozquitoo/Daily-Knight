import { Ellipse, Path, Rect } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Sneakers — rounded toe, thick sole, casual */
export function Sneakers({ primaryColor, secondaryColor, strokeColor }: AvatarTemplateProps) {
  return (
    <>
      <Path d="M60 208 L56 218 Q54 224 62 224 L86 224 Q92 224 90 218 L86 210 Z" fill={primaryColor} />
      <Rect x="54" y="222" width="38" height="6" rx="3" fill={strokeColor} opacity={0.6} />
      <Ellipse cx="62" cy="220" rx="8" ry="4" fill={secondaryColor} opacity={0.5} />
      <Path d="M114 208 L112 218 Q110 224 118 224 L142 224 Q148 224 146 218 L138 210 Z" fill={primaryColor} />
      <Rect x="108" y="222" width="38" height="6" rx="3" fill={strokeColor} opacity={0.6} />
      <Ellipse cx="138" cy="220" rx="8" ry="4" fill={secondaryColor} opacity={0.5} />
    </>
  );
}
