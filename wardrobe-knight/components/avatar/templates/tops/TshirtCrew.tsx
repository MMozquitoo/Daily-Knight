import { Path } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Crew-neck t-shirt — relaxed fit, short sleeves */
export function TshirtCrew({ primaryColor, strokeColor }: AvatarTemplateProps) {
  return (
    <>
      <Path
        d="M72 70 L128 70 Q134 70 136 76 L140 118 Q140 126 132 126 L68 126 Q60 126 60 118 L64 76 Q66 70 72 70 Z"
        fill={primaryColor}
      />
      <Path
        d="M86 68 Q100 76 114 68"
        fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" opacity={0.2}
      />
      <Path d="M64 74 L46 98 L56 104 L72 82 Z" fill={primaryColor} />
      <Path d="M136 74 L154 98 L144 104 L128 82 Z" fill={primaryColor} />
    </>
  );
}
