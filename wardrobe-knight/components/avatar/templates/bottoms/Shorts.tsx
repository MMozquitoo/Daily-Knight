import { Path, Rect } from 'react-native-svg';

interface Props { fill: string }

/** Casual shorts — end above knee */
export function Shorts({ fill }: Props) {
  return (
    <>
      {/* Waistband */}
      <Rect x="64" y="126" width="72" height="10" rx="2" fill={fill} opacity={0.9} />
      {/* Left leg */}
      <Path d="M66 136 L64 174 L86 174 L84 136 Z" fill={fill} />
      {/* Right leg */}
      <Path d="M116 136 L114 174 L136 174 L134 136 Z" fill={fill} />
      {/* Crotch bridge */}
      <Path d="M84 136 L84 158 Q100 164 116 158 L116 136 Z" fill={fill} opacity={0.85} />
    </>
  );
}
