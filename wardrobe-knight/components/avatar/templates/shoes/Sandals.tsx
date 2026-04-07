import { Path, Rect } from 'react-native-svg';

interface Props { fill: string }

/** Sandals — open, minimal, flat sole */
export function Sandals({ fill }: Props) {
  return (
    <>
      {/* Left sole */}
      <Path d="M60 214 Q58 226 66 226 L84 226 Q88 226 86 214 Z" fill={fill} opacity={0.85} />
      {/* Left straps */}
      <Rect x="62" y="212" width="22" height="4" rx="2" fill={fill} />
      <Rect x="64" y="220" width="18" height="3" rx="1.5" fill={fill} opacity={0.7} />
      {/* Right sole */}
      <Path d="M114 214 Q112 226 120 226 L138 226 Q142 226 140 214 Z" fill={fill} opacity={0.85} />
      {/* Right straps */}
      <Rect x="116" y="212" width="22" height="4" rx="2" fill={fill} />
      <Rect x="118" y="220" width="18" height="3" rx="1.5" fill={fill} opacity={0.7} />
    </>
  );
}
