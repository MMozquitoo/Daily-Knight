import { View, Image, StyleSheet, Platform } from 'react-native';
import { ITEM_COLORS } from '@/constants/palette';
import type { PaletteColor } from '@/types/wardrobe';

// Asset imports
const BASE_BODY = require('@/assets/character/Men.png');
const LAYER_ASSETS: Record<string, any> = {
  tshirt: require('@/assets/character/T-shirts.png'),
  shirt: require('@/assets/character/T-shirts.png'),
  pants: require('@/assets/character/Pants.png'),
  jeans: require('@/assets/character/Pants.png'),
  shorts: require('@/assets/character/Pants.png'),
  jacket: require('@/assets/character/jacket.png'),
  coat: require('@/assets/character/jacket.png'),
  blazer: require('@/assets/character/jacket.png'),
  sneakers: require('@/assets/character/Shoes.png'),
  boots: require('@/assets/character/Shoes.png'),
  loafers: require('@/assets/character/Shoes.png'),
};

interface ClothingLayer {
  type: string;
  color: PaletteColor;
}

interface CharacterAvatarProps {
  top?: ClothingLayer;
  bottom?: ClothingLayer;
  shoes?: ClothingLayer;
  outerwear?: ClothingLayer;
  size?: number;
}

/**
 * Renders a tinted clothing layer on top of the base character.
 * Uses mix-blend-mode: multiply on web — the white areas of the PNG
 * take the tint color, black outlines stay black.
 */
function TintedLayer({
  source,
  color,
  style,
}: {
  source: any;
  color: string;
  style?: any;
}) {
  return (
    <View style={[styles.layerWrap, style]}>
      {/* Color fill behind the image */}
      <View style={[styles.colorFill, { backgroundColor: color }]} />
      {/* Line art on top with multiply blend */}
      <Image
        source={source}
        style={[
          styles.layerImage,
          Platform.OS === 'web' ? { mixBlendMode: 'multiply' } as any : { tintColor: color },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

export function CharacterAvatar({
  top,
  bottom,
  shoes,
  outerwear,
  size = 300,
}: CharacterAvatarProps) {
  const scale = size / 300;

  return (
    <View style={[styles.container, { width: size, height: size * 1.2 }]}>
      {/* z-0: Base body — always visible */}
      <Image
        source={BASE_BODY}
        style={[styles.baseImage, { width: size * 0.7, height: size * 1.0 }]}
        resizeMode="contain"
      />

      {/* z-1: Shoes */}
      {shoes && LAYER_ASSETS[shoes.type] && (
        <TintedLayer
          source={LAYER_ASSETS[shoes.type]}
          color={ITEM_COLORS[shoes.color]?.hex ?? '#8C8C8C'}
          style={{
            bottom: -2 * scale,
            width: size * 0.55,
            height: size * 0.32,
            alignSelf: 'center',
          }}
        />
      )}

      {/* z-2: Pants/bottom */}
      {bottom && LAYER_ASSETS[bottom.type] && (
        <TintedLayer
          source={LAYER_ASSETS[bottom.type]}
          color={ITEM_COLORS[bottom.color]?.hex ?? '#8C8C8C'}
          style={{
            bottom: size * 0.15,
            width: size * 0.48,
            height: size * 0.35,
            alignSelf: 'center',
          }}
        />
      )}

      {/* z-3: Top (shirt/tshirt) */}
      {top && LAYER_ASSETS[top.type] && (
        <TintedLayer
          source={LAYER_ASSETS[top.type]}
          color={ITEM_COLORS[top.color]?.hex ?? '#8C8C8C'}
          style={{
            top: size * 0.28,
            width: size * 0.58,
            height: size * 0.32,
            alignSelf: 'center',
          }}
        />
      )}

      {/* z-4: Outerwear (jacket/coat/blazer) */}
      {outerwear && LAYER_ASSETS[outerwear.type] && (
        <TintedLayer
          source={LAYER_ASSETS[outerwear.type]}
          color={ITEM_COLORS[outerwear.color]?.hex ?? '#8C8C8C'}
          style={{
            top: size * 0.22,
            width: size * 0.72,
            height: size * 0.42,
            alignSelf: 'center',
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseImage: {
    position: 'absolute',
  },
  layerWrap: {
    position: 'absolute',
    overflow: 'hidden',
  },
  colorFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    borderRadius: 8,
  },
  layerImage: {
    width: '100%',
    height: '100%',
  },
});
