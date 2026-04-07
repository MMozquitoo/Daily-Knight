import { Path, Rect } from 'react-native-svg';

interface Props { fill: string }

/** Boots — taller shaft, angular toe, heeled sole */
export function Boots({ fill }: Props) {
  return (
    <>
      {/* Left shaft */}
      <Rect x="62" y="194" width="22" height="16" rx="2" fill={fill} opacity={0.9} />
      {/* Left boot foot */}
      <Path d="M60 208 L56 220 Q54 226 62 226 L88 226 Q92 226 90 220 L86 210 Z" fill={fill} />
      {/* Left sole */}
      <Rect x="54" y="224" width="38" height="5" rx="2" fill="#2A2A2A" opacity={0.7} />
      {/* Left heel */}
      <Rect x="78" y="222" width="10" height="7" rx="1" fill="#2A2A2A" opacity={0.5} />
      {/* Right shaft */}
      <Rect x="116" y="194" width="22" height="16" rx="2" fill={fill} opacity={0.9} />
      {/* Right boot foot */}
      <Path d="M114 208 L112 220 Q110 226 118 226 L144 226 Q148 226 146 220 L138 210 Z" fill={fill} />
      {/* Right sole */}
      <Rect x="108" y="224" width="38" height="5" rx="2" fill="#2A2A2A" opacity={0.7} />
      {/* Right heel */}
      <Rect x="134" y="222" width="10" height="7" rx="1" fill="#2A2A2A" opacity={0.5} />
    </>
  );
}
