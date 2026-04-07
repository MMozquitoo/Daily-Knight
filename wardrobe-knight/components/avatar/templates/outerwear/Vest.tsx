import { Path, Line } from 'react-native-svg';

interface Props { fill: string }

/** Vest — sleeveless, V-neck front, layering piece */
export function Vest({ fill }: Props) {
  return (
    <>
      {/* Body — no sleeves */}
      <Path
        d="M70 68 L130 68 Q136 68 138 74 L142 118 Q142 128 134 128 L66 128 Q58 128 58 118 L62 74 Q64 68 70 68 Z"
        fill={fill}
      />
      {/* V-neckline */}
      <Path
        d="M88 68 L100 90 L112 68"
        fill="none" stroke="#000000" strokeWidth="1" opacity={0.1}
      />
      {/* Arm holes */}
      <Path d="M70 68 Q60 80 62 96" fill="none" stroke="#000000" strokeWidth="1" opacity={0.08} />
      <Path d="M130 68 Q140 80 138 96" fill="none" stroke="#000000" strokeWidth="1" opacity={0.08} />
      {/* Button line */}
      <Line x1="100" y1="90" x2="100" y2="128" stroke="#000000" strokeWidth="1" opacity={0.08} />
    </>
  );
}
