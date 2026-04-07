/**
 * Template Definition type
 *
 * Templates are the SVG shapes used to render clothing on the knight avatar.
 * Each template supports a set of colors from the controlled palette.
 */

import { LayerSlot, PaletteColor } from './wardrobe';

export interface TemplateDefinition {
  templateId: string;
  layer: LayerSlot;
  shape: string;
  supportedColors: PaletteColor[];
}
