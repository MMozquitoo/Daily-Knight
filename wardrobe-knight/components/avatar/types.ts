import type { ComponentType } from 'react';
import type { PaletteColor } from '@/types/wardrobe';

export type AvatarLayerSlot =
  | 'bottom'
  | 'shoes'
  | 'top'
  | 'outerwear'
  | 'accessoryBack'
  | 'accessoryFront';

export interface AvatarTemplateProps {
  primaryColor: string;
  secondaryColor: string;
  strokeColor: string;
}

export interface AvatarVisualItem {
  templateId: string;
  colorToken: PaletteColor;
}

export interface AvatarOutfit {
  bottom?: AvatarVisualItem;
  shoes?: AvatarVisualItem;
  top?: AvatarVisualItem;
  outerwear?: AvatarVisualItem;
  accessoryBack?: AvatarVisualItem;
  accessoryFront?: AvatarVisualItem;
}

export interface ResolvedVisual {
  templateId: string;
  slot: AvatarLayerSlot;
  Component: ComponentType<AvatarTemplateProps>;
  colors: AvatarTemplateProps;
}
