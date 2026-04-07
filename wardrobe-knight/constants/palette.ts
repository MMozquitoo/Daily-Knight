/**
 * Color Palette
 *
 * Controlled set of colors for clothing items + UI theme tokens.
 */

/** Clothing item colors — RGB for detection, hex for rendering */
export const ITEM_COLORS: Record<string, { hex: string; label: string }> = {
  white:  { hex: '#F5F5F0', label: 'White'  },
  black:  { hex: '#1E1E1E', label: 'Black'  },
  navy:   { hex: '#000080', label: 'Navy'   },
  gray:   { hex: '#8C8C8C', label: 'Gray'   },
  beige:  { hex: '#D2BE9A', label: 'Beige'  },
  brown:  { hex: '#784028', label: 'Brown'  },
  olive:  { hex: '#556B2F', label: 'Olive'  },
  red:    { hex: '#B42828', label: 'Red'    },
  blue:   { hex: '#4682C8', label: 'Blue'   },
  green:  { hex: '#3C783C', label: 'Green'  },
};

export const AVATAR_COLORS = {
  armor: '#E8E6E1',
  helmet: '#D1CEC6',
  helmetShadow: '#C4C0B8',
  helmetStroke: '#B0AFA8',
  outline: '#1A1A1A',
  highlight: '#F7F6F2',
} as const;

/** App-wide UI theme */
export const THEME = {
  bg:          '#FAFAF8',
  surface:     '#FFFFFF',
  surfaceMute: '#F2F1EE',
  border:      '#E8E6E1',
  text:        '#1A1A1A',
  textSecondary: '#8A8A86',
  textTertiary:  '#B0AFA8',
  accent:      '#3D5A80',
  accentLight: '#EBF0F5',
  carry:       '#C97B2A',
  danger:      '#C0392B',
  white:       '#FFFFFF',
} as const;
