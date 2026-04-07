import { Path, Rect, Ellipse } from 'react-native-svg';

interface Props { fill: string }

/** Hoodie — casual, hood behind head, front pocket */
export function Hoodie({ fill }: Props) {
  return (
    <>
      {/* Hood (behind head, visible above shoulders) */}
      <Path
        d="M74 52 Q74 40 100 40 Q126 40 126 52 L128 68 L72 68 Z"
        fill={fill} opacity={0.6}
      />
      {/* Torso */}
      <Path
        d="M66 68 L134 68 Q140 68 142 74 L146 118 Q146 128 136 128 L64 128 Q54 128 54 118 L58 74 Q60 68 66 68 Z"
        fill={fill}
      />
      {/* Left sleeve */}
      <Path d="M58 74 L36 128 L50 132 L68 82 Z" fill={fill} />
      {/* Right sleeve */}
      <Path d="M142 74 L164 128 L150 132 L132 82 Z" fill={fill} />
      {/* Front pocket */}
      <Rect x="78" y="100" width="44" height="20" rx="6" fill={fill} opacity={0.7} />
      {/* Drawstrings */}
      <Ellipse cx="94" cy="70" rx="1.5" ry="6" fill="#FFFFFF" opacity={0.2} />
      <Ellipse cx="106" cy="70" rx="1.5" ry="6" fill="#FFFFFF" opacity={0.2} />
      {/* Ribbed hem */}
      <Rect x="56" y="124" width="88" height="6" rx="2" fill={fill} opacity={0.7} />
    </>
  );
}
