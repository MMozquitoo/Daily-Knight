import { AVATAR_COLORS, ITEM_COLORS } from '@/constants/palette';
import { AVATAR_TEMPLATES } from './templateRegistry';
import type { AvatarLayerSlot, AvatarVisualItem, ResolvedVisual } from './types';

export function resolveVisual(slot: AvatarLayerSlot, item?: AvatarVisualItem): ResolvedVisual | null {
  if (!item) {
    return null;
  }

  const template = AVATAR_TEMPLATES[item.templateId];
  if (!template) {
    return null;
  }

  if (template.layer !== slot) {
    return null;
  }

  const color = ITEM_COLORS[item.colorToken];
  if (!color) {
    return null;
  }

  return {
    templateId: template.templateId,
    slot,
    Component: template.Component,
    colors: {
      primaryColor: color.hex,
      secondaryColor: AVATAR_COLORS.highlight,
      strokeColor: AVATAR_COLORS.outline,
    },
  };
}
