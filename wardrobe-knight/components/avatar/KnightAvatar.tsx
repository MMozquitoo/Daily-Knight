import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { BaseBodyLayer } from './BaseBodyLayer';
import { resolveVisual } from './resolveVisual';
import { AVATAR_LAYER_ORDER } from './templateRegistry';
import type { AvatarOutfit } from './types';

interface KnightAvatarProps {
  outfit: AvatarOutfit;
  size?: number;
}

export function KnightAvatar({ outfit, size = 240 }: KnightAvatarProps) {
  return (
    <View style={[styles.container, { width: size, height: size * 1.2 }]}>
      <Svg viewBox="-10 -12 220 250" width="100%" height="100%">
        <BaseBodyLayer />
        {AVATAR_LAYER_ORDER.map((slot) => {
          const visual = resolveVisual(slot, outfit[slot]);
          if (!visual) {
            return null;
          }

          const LayerComponent = visual.Component;
          return <LayerComponent key={`${slot}-${visual.templateId}`} {...visual.colors} />;
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
});
