/**
 * Color Detection Service — works in browser
 *
 * Uses canvas to sample pixels from a captured image
 * and maps to the nearest palette color.
 */

import type { PaletteColor } from '@/types/wardrobe';

const PALETTE_RGB: Record<PaletteColor, [number, number, number]> = {
  white:  [245, 245, 240],
  black:  [30,  30,  30 ],
  navy:   [0,   0,   128],
  gray:   [140, 140, 140],
  beige:  [210, 190, 160],
  brown:  [120, 80,  40 ],
  olive:  [85,  107, 47 ],
  red:    [180, 40,  40 ],
  blue:   [70,  130, 200],
  green:  [60,  120, 60 ],
};

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function nearestColor(r: number, g: number, b: number): PaletteColor {
  let best: PaletteColor = 'gray';
  let minDist = Infinity;
  for (const [name, rgb] of Object.entries(PALETTE_RGB)) {
    const dist = rgbDistance([r, g, b], rgb as [number, number, number]);
    if (dist < minDist) {
      minDist = dist;
      best = name as PaletteColor;
    }
  }
  return best;
}

/**
 * Detect dominant color from an image file.
 * Creates a canvas, draws the image, samples the center 60% of pixels.
 */
export function detectColorFromFile(file: File): Promise<PaletteColor> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 50;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('gray'); return; }

      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(
        Math.floor(size * 0.2),
        Math.floor(size * 0.2),
        Math.floor(size * 0.6),
        Math.floor(size * 0.6)
      );

      let totalR = 0, totalG = 0, totalB = 0;
      const pixels = imageData.data;
      const count = pixels.length / 4;

      for (let i = 0; i < pixels.length; i += 4) {
        totalR += pixels[i];
        totalG += pixels[i + 1];
        totalB += pixels[i + 2];
      }

      resolve(nearestColor(
        Math.round(totalR / count),
        Math.round(totalG / count),
        Math.round(totalB / count),
      ));

      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve('gray');
    img.src = URL.createObjectURL(file);
  });
}

/** Simple fallback for non-file contexts */
export function detectDominantColor(_imageUri: string): PaletteColor {
  return 'navy';
}
