import type { ComponentType } from 'react';
import type { PaletteColor } from '@/types/wardrobe';
import type { AvatarLayerSlot, AvatarTemplateProps } from './types';
import { ShirtOxford } from './templates/tops/ShirtOxford';
import { TshirtCrew } from './templates/tops/TshirtCrew';
import { PantsStraight } from './templates/bottoms/PantsStraight';
import { JeansSlim } from './templates/bottoms/JeansSlim';
import { Loafers } from './templates/shoes/Loafers';
import { Sneakers } from './templates/shoes/Sneakers';
import { Blazer } from './templates/outerwear/Blazer';
import { Coat } from './templates/outerwear/Coat';
import { Bag } from './templates/accessories/Bag';
import { Scarf } from './templates/accessories/Scarf';

type TemplateComponent = ComponentType<AvatarTemplateProps>;

interface AvatarTemplateDefinition {
  templateId: string;
  layer: AvatarLayerSlot;
  shape: string;
  supportedColors: PaletteColor[];
  Component: TemplateComponent;
}

const allColors: PaletteColor[] = [
  'white',
  'black',
  'navy',
  'gray',
  'beige',
  'brown',
  'olive',
  'red',
  'blue',
  'green',
];

export const AVATAR_LAYER_ORDER: AvatarLayerSlot[] = [
  'bottom',
  'shoes',
  'top',
  'outerwear',
  'accessoryBack',
  'accessoryFront',
];

export const AVATAR_Z_INDEX: Record<AvatarLayerSlot | 'base', number> = {
  base: 0,
  bottom: 10,
  shoes: 20,
  top: 30,
  outerwear: 40,
  accessoryBack: 50,
  accessoryFront: 60,
};

export const AVATAR_TEMPLATES: Record<string, AvatarTemplateDefinition> = {
  top_shirt_oxford: {
    templateId: 'top_shirt_oxford',
    layer: 'top',
    shape: 'shirt_oxford',
    supportedColors: allColors,
    Component: ShirtOxford,
  },
  top_tshirt_crew: {
    templateId: 'top_tshirt_crew',
    layer: 'top',
    shape: 'tshirt_crew',
    supportedColors: allColors,
    Component: TshirtCrew,
  },
  bottom_pants_straight: {
    templateId: 'bottom_pants_straight',
    layer: 'bottom',
    shape: 'pants_straight',
    supportedColors: allColors,
    Component: PantsStraight,
  },
  bottom_jeans_slim: {
    templateId: 'bottom_jeans_slim',
    layer: 'bottom',
    shape: 'jeans_slim',
    supportedColors: allColors,
    Component: JeansSlim,
  },
  shoes_loafers: {
    templateId: 'shoes_loafers',
    layer: 'shoes',
    shape: 'loafers',
    supportedColors: allColors,
    Component: Loafers,
  },
  shoes_sneakers: {
    templateId: 'shoes_sneakers',
    layer: 'shoes',
    shape: 'sneakers',
    supportedColors: allColors,
    Component: Sneakers,
  },
  outerwear_blazer: {
    templateId: 'outerwear_blazer',
    layer: 'outerwear',
    shape: 'blazer',
    supportedColors: allColors,
    Component: Blazer,
  },
  outerwear_coat: {
    templateId: 'outerwear_coat',
    layer: 'outerwear',
    shape: 'coat',
    supportedColors: allColors,
    Component: Coat,
  },
  accessory_bag: {
    templateId: 'accessory_bag',
    layer: 'accessoryBack',
    shape: 'bag',
    supportedColors: allColors,
    Component: Bag,
  },
  accessory_scarf: {
    templateId: 'accessory_scarf',
    layer: 'accessoryFront',
    shape: 'scarf',
    supportedColors: allColors,
    Component: Scarf,
  },
};
