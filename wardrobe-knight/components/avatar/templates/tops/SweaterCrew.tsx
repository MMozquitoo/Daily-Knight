import { Path, Rect } from 'react-native-svg';

interface Props { fill: string }

/** Crew-neck sweater — thicker silhouette, ribbed details */
export function SweaterCrew({ fill }: Props) {
  return (
    <>
      {/* Torso — slightly wider than shirts to suggest thickness */}
      <Path
        d="M68 70 L132 70 Q138 70 140 76 L144 118 Q144 128 134 128 L66 128 Q56 128 56 118 L60 76 Q62 70 68 70 Z"
        fill={fill}
      />
      {/* Ribbed collar */}
      <Rect x="84" y="64" width="32" height="8" rx="4" fill={fill} opacity={0.75} />
      {/* Left sleeve */}
      <Path d="M60 76 L38 128 L52 132 L70 84 Z" fill={fill} />
      {/* Right sleeve */}
      <Path d="M140 76 L162 128 L148 132 L130 84 Z" fill={fill} />
      {/* Ribbed hem */}
      <Rect x="58" y="124" width="84" height="6" rx="2" fill={fill} opacity={0.7} />
      {/* Ribbed cuffs */}
      <Rect x="36" y="126" width="18" height="6" rx="2" fill={fill} opacity={0.7} />
      <Rect x="146" y="126" width="18" height="6" rx="2" fill={fill} opacity={0.7} />
    </>
  );
}
