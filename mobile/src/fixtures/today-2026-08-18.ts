// Fixture real — 18 ago 2026, de Planification/Armoire.
// Fuente: adrien-workbook-snapshot (checksum a0364a41…c5278fc).
// CM-04 y PA-17 no tienen foto "clean" en producción — este fixture
// ejercita el fallback real, no uno inventado.

import type { TodayOutfit } from '../types';

export const today20260818: TodayOutfit = {
  date: '2026-08-18',
  why: 'Cette combinaison équilibre météo, contexte et confort.',
  weather: {
    range: '19–27°C',
    condition: 'cloudy',
    rainChancePct: 3,
    windKmh: 13,
  },
  agenda: {
    eventCount: 2,
    formality: 'casual',
  },
  top: {
    id: 'CM-04',
    layer: 'top',
    category: 'T-shirt',
    brand: 'Seagale',
    color: 'Bleu pétrole',
    assets: {
      // sin "clean": cae a product (mismo shopify CDN que raw en este caso)
      raw: 'https://cdn.shopify.com/s/files/1/0906/5385/2022/files/Perf_tee_bleu_petrole.png',
      product: 'https://cdn.shopify.com/s/files/1/0906/5385/2022/files/Perf_tee_bleu_petrole.png',
    },
  },
  bottom: {
    id: 'PA-17',
    layer: 'bottom',
    category: 'Chino',
    brand: 'Seagale',
    color: 'Bleu roi',
    assets: {
      // sin "clean": mismo caso que CM-04
      raw: 'https://cdn.shopify.com/s/files/1/0906/5385/2022/files/Cordura_chinos_bleu_roi.png',
      product: 'https://cdn.shopify.com/s/files/1/0906/5385/2022/files/Cordura_chinos_bleu_roi.png',
    },
  },
  shoes: {
    id: 'SN-05',
    layer: 'shoes',
    category: 'Sneakers',
    brand: 'Autry',
    color: 'Blanc et noir',
    assets: {
      raw: 'https://daily-knight.vercel.app/api/images?url=https%3A%2F%2Ffiles.slack.com%2Ffiles-pri%2FT05UC6SSQQK-F0BAE2QLWE4%2Fdownload%2Fimg_4955.jpg',
      clean: 'https://replicate.delivery/yhqm/j3LM9if5hFU2MCVMWeIVaej7a78iKX2DA6HuEJptOAZaOYitA/output.jpg',
      product: 'https://unqvg1jdelq38itg.public.blob.vercel-storage.com/wardrobe-knight/product/SN-05.jpg',
    },
  },
  // outerwear y carry vacíos hoy — se omiten, no se rellenan con datos falsos.
};
