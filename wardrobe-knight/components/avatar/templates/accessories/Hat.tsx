import { Path, Rect, Ellipse } from 'react-native-svg';

interface Props { fill: string }

/** Simple hat — brimmed, casual */
export function Hat({ fill }: Props) {
  return (
    <>
      {/* Crown */}
      <Path d="M76 6 Q76 -10 100 -10 Q124 -10 124 6 L124 16 L76 16 Z" fill={fill} />
      {/* Brim */}
      <Ellipse cx="100" cy="16" rx="34" ry="6" fill={fill} opacity={0.85} />
    </>
  );
}
