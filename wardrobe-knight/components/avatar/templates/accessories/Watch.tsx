import { Rect, Circle } from 'react-native-svg';

interface Props { fill: string }

/** Wristwatch — on left wrist */
export function Watch({ fill }: Props) {
  return (
    <>
      {/* Band */}
      <Rect x="36" y="124" width="16" height="18" rx="3" fill={fill} opacity={0.8} />
      {/* Watch face */}
      <Circle cx="44" cy="133" r="6" fill="#FFFFFF" opacity={0.3} />
      <Circle cx="44" cy="133" r="5" fill={fill} opacity={0.5} />
    </>
  );
}
