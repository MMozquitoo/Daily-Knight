/**
 * Slack Block Kit message builders
 */

import type { ClothingItem } from '../types/wardrobe.js';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { OutfitRecommendation, CarryItem } from '../types/outfit.js';
import type { DayWeather } from '../types/weather.js';
import { formatWeatherSlack } from '../services/weather.js';

const CARRY_LABELS: Record<CarryItem, string> = {
  umbrella: ':umbrella_with_rain_drops: Parapluie',
  'light-layer': ':coat: Couche légère',
  bag: ':handbag: Sac',
  sunglasses: ':dark_sunglasses: Lunettes de soleil',
};

function itemDisplayName(item: ClothingItem): string {
  const parts = [item.marque, item.categorie, item.sousCategorie].filter(Boolean);
  return parts.join(' ') || item.id;
}

export function outfitMessage(
  recommendation: OutfitRecommendation,
  items: ClothingItem[],
  weather: DayWeather,
): object[] {
  const itemMap = new Map(items.map((i) => [i.id, i]));

  function itemLine(id: string | undefined, label: string): string {
    if (!id) return '';
    const item = itemMap.get(id);
    if (!item) return `${label} : _inconnu_`;
    return `${label} : *${itemDisplayName(item)}* (${item.couleur})`;
  }

  const wearLines = [
    itemLine(recommendation.wear.top, ':shirt: Haut'),
    itemLine(recommendation.wear.bottom, ':jeans: Bas'),
    itemLine(recommendation.wear.shoes, ':athletic_shoe: Chaussures'),
    recommendation.wear.outerwear ? itemLine(recommendation.wear.outerwear, ':coat: Veste') : '',
    ...recommendation.wear.accessories.map((id) => itemLine(id, ':ring: Acc')),
  ].filter(Boolean);

  const carryLines = recommendation.carry.length > 0
    ? recommendation.carry.map((c) => CARRY_LABELS[c]).join(' · ')
    : '_Rien de plus_';

  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':shield: Ta tenue du jour', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatWeatherSlack(weather) },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*PORTER*\n' + wearLines.join('\n') },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*EMPORTER*\n' + carryLines },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*POURQUOI*\n_${recommendation.why}_` },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: ':arrows_counterclockwise: Changer de tenue', emoji: true },
          action_id: 'regenerate_outfit',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: ':arrow_up: Plus formel', emoji: true },
          action_id: 'more_formal',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: ':calendar: Voir agenda', emoji: true },
          action_id: 'view_agenda',
        },
      ],
    },
  ];

  return blocks;
}

export function confirmAddItem(
  parsed: Partial<ClothingItem>,
  generatedId: string,
  imageUrl?: string,
): object[] {
  const fields = [
    `*ID :* ${generatedId}`,
    `*Catégorie :* ${parsed.categorie ?? '_à compléter_'}`,
    `*Sous-catégorie :* ${parsed.sousCategorie ?? '_–_'}`,
    `*Marque :* ${parsed.marque ?? '_–_'}`,
    `*Modèle :* ${parsed.modele ?? '_–_'}`,
    `*Couleur :* ${parsed.couleur ?? '_à compléter_'}`,
    `*Palette :* ${parsed.palette ?? '_–_'}`,
    `*Matière :* ${parsed.matiere ?? '_–_'}`,
    `*Coupe :* ${parsed.coupe ?? '_–_'}`,
    `*Niveau :* ${parsed.niveau ?? '_à compléter_'}`,
    `*Saison :* ${parsed.saison ?? 'toutes'}`,
    `*Formalité :* ${parsed.formalite ?? '_à compléter_'}`,
    `*Impact :* ${parsed.impact ?? '3'}`,
    `*Polyvalence :* ${parsed.polyvalence ?? '3'}`,
    `*État :* ${parsed.etat ?? 'neuf'}`,
  ];

  const blocks: object[] = [];

  if (imageUrl) {
    blocks.push({
      type: 'image',
      image_url: imageUrl,
      alt_text: `Photo: ${parsed.categorie ?? 'vêtement'}`,
    });
  }

  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:camera_with_flash: *Nouveau vêtement détecté :*\n\n` + fields.join('\n'),
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Confirmer', emoji: true },
          style: 'primary',
          action_id: 'confirm_add_item',
          value: JSON.stringify({ ...parsed, id: generatedId, imageUrl }),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Annuler', emoji: true },
          style: 'danger',
          action_id: 'cancel_add_item',
        },
      ],
    },
  );

  return blocks;
}

export function wardrobeList(items: ClothingItem[]): object[] {
  if (items.length === 0) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: 'Ton armoire est vide. Écris « ajoute [vêtement] » pour commencer.' } }];
  }

  // Group by engine category (top/bottom/shoes/outerwear/accessories)
  const grouped = new Map<string, ClothingItem[]>();
  for (const item of items) {
    const cat = categoryFromSheet(item.categorie);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  const catEmoji: Record<string, string> = {
    top: ':shirt:',
    bottom: ':jeans:',
    shoes: ':athletic_shoe:',
    outerwear: ':coat:',
    accessories: ':ring:',
  };

  const catLabel: Record<string, string> = {
    top: 'HAUTS',
    bottom: 'BAS',
    shoes: 'CHAUSSURES',
    outerwear: 'VESTES',
    accessories: 'ACCESSOIRES',
  };

  const blocks: object[] = [
    { type: 'header', text: { type: 'plain_text', text: ':closet: Ton armoire', emoji: true } },
  ];

  for (const [cat, catItems] of grouped) {
    const emoji = catEmoji[cat] ?? ':small_blue_diamond:';
    const label = catLabel[cat] ?? cat.toUpperCase();
    const lines = catItems.map((i) => {
      const status = i.etat === 'usé' ? ' :warning:' : '';
      const photo = i.imageUrl ? ' :camera:' : '';
      const name = `${i.categorie} ${i.sousCategorie}`.trim();
      return `• ${i.id} — *${name}*${status}${photo} (${i.couleur}, ${i.marque}, f${i.formalite})`;
    });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${emoji} *${label}*\n${lines.join('\n')}` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Total : ${items.length} vêtements` }],
  });

  return blocks;
}
