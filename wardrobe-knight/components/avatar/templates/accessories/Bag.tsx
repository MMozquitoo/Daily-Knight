import { Path, Rect } from 'react-native-svg';
import type { AvatarTemplateProps } from '@/components/avatar/types';

/** Shoulder bag — hangs on right side */
export function Bag({ primaryColor }: AvatarTemplateProps) {
  return (
    <>
      <Path
        d="M126 68 L70 128"
        fill="none" stroke={primaryColor} strokeWidth="4" strokeLinecap="round" opacity={0.6}
      />
      <Rect x="56" y="118" width="24" height="20" rx="4" fill={primaryColor} opacity={0.8} />
      <Rect x="56" y="118" width="24" height="8" rx="3" fill={primaryColor} opacity={0.9} />
    </>
  );
}
