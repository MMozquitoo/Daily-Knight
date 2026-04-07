import { Path, Rect, Line } from 'react-native-svg';

interface Props { fill: string }

/** Casual jacket — collar, zip front, relaxed fit */
export function Jacket({ fill }: Props) {
  return (
    <>
      {/* Body */}
      <Path
        d="M60 68 L140 68 Q146 68 148 74 L152 122 Q152 132 142 132 L58 132 Q48 132 48 122 L52 74 Q54 68 60 68 Z"
        fill={fill}
      />
      {/* Stand collar */}
      <Rect x="78" y="60" width="44" height="10" rx="4" fill={fill} opacity={0.8} />
      {/* Zip line */}
      <Line x1="100" y1="68" x2="100" y2="132" stroke="#FFFFFF" strokeWidth="2" opacity={0.15} />
      {/* Left sleeve */}
      <Path d="M54 74 L30 130 L44 136 L62 82 Z" fill={fill} />
      {/* Right sleeve */}
      <Path d="M146 74 L170 130 L156 136 L138 82 Z" fill={fill} />
      {/* Hem */}
      <Rect x="50" y="128" width="100" height="6" rx="2" fill={fill} opacity={0.7} />
    </>
  );
}
