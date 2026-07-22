/**
 * Slack Block Kit message builders
 */

import type { ClothingItem } from '../types/wardrobe.js';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { OutfitRecommendation, CarryItem } from '../types/outfit.js';
import type { DayWeather } from '../types/weather.js';
import type { StatsSummary, StatBucket } from '../services/stats.js';
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
    return `${label} : *${itemDisplayName(item)}* — ${item.couleur}${item.matiere ? ', ' + item.matiere : ''}`;
  }

  // Each main piece gets its own line with a 👍/👎 overflow, so Mage Stylist learns
  // which garments the user actually likes and weights them next time.
  const feedbackLayers: { id?: string; label: string }[] = [
    { id: recommendation.wear.top, label: ':shirt: Haut' },
    { id: recommendation.wear.bottom, label: ':jeans: Bas' },
    { id: recommendation.wear.shoes, label: ':athletic_shoe: Chaussures' },
    { id: recommendation.wear.outerwear, label: ':coat: Veste' },
  ];
  const wearBlocks: object[] = [
    { type: 'section', text: { type: 'mrkdwn', text: '*PORTER*' } },
  ];
  for (const { id, label } of feedbackLayers) {
    if (!id) continue;
    wearBlocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: itemLine(id, label) },
      accessory: {
        type: 'overflow',
        action_id: 'item_feedback',
        options: [
          { text: { type: 'plain_text', text: "👍 J'aime", emoji: true }, value: `like:${id}` },
          { text: { type: 'plain_text', text: '👎 Bof', emoji: true }, value: `dislike:${id}` },
        ],
      },
    });
  }
  const accLines = recommendation.wear.accessories
    .map((id) => itemLine(id, ':ring: Acc'))
    .filter(Boolean);
  if (accLines.length) {
    wearBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: accLines.join('\n') } });
  }

  const carryLines = recommendation.carry.length > 0
    ? recommendation.carry.map((c) => CARRY_LABELS[c]).join(' · ')
    : '_Rien de plus_';

  // Collect images for the outfit (prefer product image > try-on (Blob only) > original photo)
  const outfitImages: { url: string; alt: string }[] = [];
  for (const id of [recommendation.wear.top, recommendation.wear.bottom, recommendation.wear.shoes, recommendation.wear.outerwear]) {
    if (!id) continue;
    const item = itemMap.get(id);
    if (!item) continue;
    const imageUrl = item.productUrl
      || (item.tryonUrl && !item.tryonUrl.includes('replicate.delivery') ? item.tryonUrl : null)
      || item.imageUrl;
    if (imageUrl) {
      outfitImages.push({ url: imageUrl, alt: itemDisplayName(item) });
    }
  }

  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':magic_wand: Ta tenue du jour', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: formatWeatherSlack(weather) },
    },
    { type: 'divider' },
    ...wearBlocks,
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*EMPORTER*\n' + carryLines },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*POURQUOI*\n_${recommendation.why}_` },
    },
    ...outfitImages.map((img) => ({
      type: 'image',
      title: { type: 'plain_text' as const, text: img.alt },
      image_url: img.url,
      alt_text: img.alt,
    })),
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: ':arrows_counterclockwise: Changer de tenue', emoji: true },
          action_id: 'regenerate_outfit',
          // Carry the shown outfit in the button so regenerate works on any cold
          // serverless instance, not only the one that posted the message.
          value: [recommendation.wear.top, recommendation.wear.bottom, recommendation.wear.shoes].filter(Boolean).join(','),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: ':arrow_up: Plus formel', emoji: true },
          action_id: 'more_formal',
          value: [recommendation.wear.top, recommendation.wear.bottom, recommendation.wear.shoes].filter(Boolean).join(','),
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

export function statsMessage(stats: StatsSummary): object[] {
  const bar = (p: number) => '█'.repeat(Math.max(1, Math.round(p / 5)));
  const table = (rows: StatBucket[]) =>
    rows
      .filter((r) => r.count > 0)
      .map((r) => `${r.label.padEnd(16)}${bar(r.pct).padEnd(21)}${String(r.count).padStart(3)}  ${r.pct}%`)
      .join('\n') || '—';

  const emoji: Record<string, string> = {
    under: ':small_red_triangle_down:',
    over: ':small_red_triangle:',
    warn: ':warning:',
    ok: ':white_check_mark:',
  };
  const insightLines = stats.insights.map((i) => `${emoji[i.kind] ?? '•'} ${i.text}`).join('\n');

  return [
    { type: 'header', text: { type: 'plain_text', text: ':bar_chart: Stats de ta garde-robe', emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `*${stats.total} pièces* au total` } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Par catégorie*\n```\n' + table(stats.byLayer) + '\n```' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Par formalité*\n```\n' + table(stats.byFormality) + '\n```' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Par saison*\n```\n' + table(stats.bySeason) + '\n```' } },
    { type: 'section', text: { type: 'mrkdwn', text: `*État* : ${stats.condition.neuf} neuf · ${stats.condition.bon} bon · ${stats.condition.use} usé` } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: '*Analyse & benchmarks*\n' + insightLines } },
  ];
}

export function savedItemMessage(item: ClothingItem): object[] {
  const fields = [
    `*ID :* ${item.id}`,
    `*Catégorie :* ${item.categorie || '_–_'}`,
    `*Sous-catégorie :* ${item.sousCategorie || '_–_'}`,
    `*Marque :* ${item.marque || '_–_'}`,
    `*Modèle :* ${item.modele || '_–_'}`,
    `*Couleur :* ${item.couleur || '_–_'}`,
    `*Palette :* ${item.palette || '_–_'}`,
    `*Matière :* ${item.matiere || '_–_'}`,
    `*Coupe :* ${item.coupe || '_–_'}`,
    `*Niveau :* ${item.niveau || '_–_'}`,
    `*Saison :* ${item.saison || 'toutes'}`,
    `*Formalité :* ${item.formalite}`,
    `*Impact :* ${item.impact}`,
    `*Polyvalence :* ${item.polyvalence}`,
    `*État :* ${item.etat || 'neuf'}`,
  ];

  const blocks: object[] = [];

  if (item.imageUrl) {
    blocks.push({
      type: 'image',
      image_url: item.imageUrl,
      alt_text: `Photo: ${item.categorie ?? 'vêtement'}`,
    });
  }

  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:white_check_mark: *Enregistré dans ton armoire :*\n\n` + fields.join('\n'),
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: ':pencil2: Modifier', emoji: true },
          action_id: 'edit_item',
          value: item.id,
        },
      ],
    },
  );

  return blocks;
}

export function editItemModal(item: ClothingItem): object {
  const textInput = (label: string, actionId: string, initial: string) => ({
    type: 'input',
    block_id: actionId,
    optional: true,
    element: {
      type: 'plain_text_input',
      action_id: actionId,
      initial_value: initial || '',
    },
    label: { type: 'plain_text', text: label },
  });

  const selectInput = (label: string, actionId: string, options: string[], initial: string) => ({
    type: 'input',
    block_id: actionId,
    optional: true,
    element: {
      type: 'static_select',
      action_id: actionId,
      options: options.map((o) => ({ text: { type: 'plain_text', text: o }, value: o })),
      ...(initial && options.includes(initial) ? { initial_option: { text: { type: 'plain_text', text: initial }, value: initial } } : {}),
    },
    label: { type: 'plain_text', text: label },
  });

  return {
    type: 'modal',
    callback_id: 'edit_item_modal',
    private_metadata: item.id,
    title: { type: 'plain_text', text: `Modifier ${item.id}` },
    submit: { type: 'plain_text', text: 'Enregistrer' },
    close: { type: 'plain_text', text: 'Annuler' },
    blocks: [
      textInput('Catégorie', 'categorie', item.categorie),
      textInput('Sous-catégorie', 'sousCategorie', item.sousCategorie),
      textInput('Marque', 'marque', item.marque),
      textInput('Modèle', 'modele', item.modele),
      textInput('Couleur', 'couleur', item.couleur),
      selectInput('Palette', 'palette', ['chaud', 'froid', 'neutre'], item.palette),
      textInput('Matière', 'matiere', item.matiere),
      textInput('Coupe', 'coupe', item.coupe),
      selectInput('Niveau', 'niveau', ['casual', 'smart-casual', 'habillé'], item.niveau),
      selectInput('Saison', 'saison', ['toutes', 'été', 'hiver', 'mi-saison'], item.saison),
      textInput('Formalité (1-5)', 'formalite', item.formalite.toString()),
      textInput('Impact (1-5)', 'impact', item.impact.toString()),
      textInput('Polyvalence (1-5)', 'polyvalence', item.polyvalence.toString()),
      selectInput('État', 'etat', ['neuf', 'bon', 'usé'], item.etat),
    ],
  };
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

  // Slack rejects the whole message if any one text object exceeds 3000 chars. With
  // 117 items the "HAUTS" group alone blows past that, so each category's lines are
  // split into sub-3000-char section blocks instead of one giant field.
  const MAX_TEXT = 2900;

  for (const [cat, catItems] of grouped) {
    const emoji = catEmoji[cat] ?? ':small_blue_diamond:';
    const label = catLabel[cat] ?? cat.toUpperCase();
    const lines = catItems.map((i) => {
      const status = i.etat === 'usé' ? ' :warning:' : '';
      const photo = i.productUrl ? ' :framed_picture:' : i.imageUrl ? ' :camera:' : '';
      const name = `${i.categorie} ${i.sousCategorie}`.trim();
      return `• ${i.id} — *${name}*${status}${photo} (${i.couleur}, ${i.marque}, f${i.formalite})`;
    });

    let header = `${emoji} *${label}*`;
    let buffer = header;
    for (const line of lines) {
      if (buffer.length + 1 + line.length > MAX_TEXT) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: buffer } });
        buffer = `${header} _(suite)_`;
      }
      buffer += `\n${line}`;
    }
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: buffer } });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Total : ${items.length} vêtements` }],
  });

  return blocks;
}
