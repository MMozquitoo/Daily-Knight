/**
 * Natural Language Parser — Claude API (Sonnet)
 *
 * Interprets free-text messages about adding/modifying clothing items.
 * Returns structured ClothingItem fields matching the Google Sheet schema.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClothingItem } from '../types/wardrobe.js';

/** Strip a ```json … ``` fence if the model wrapped its JSON despite instructions */
function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}


const SCHEMA_DESCRIPTION = `The user wants to add a clothing item. Extract these fields from their message (in French).
Return a JSON object with these keys. Use null for fields you cannot infer.

{
  "categorie": "the item type: Jeans, Pants, Shorts, Shirt, T-shirt, Sweater, Hoodie, Shoes, Boots, Sneakers, Sandals, Jacket, Coat, Blazer, Vest, Hat, Scarf, Bag, Watch",
  "sousCategorie": "sub-style: Slim, Straight, Oxford, Derby, Loafers, Chelsea, Low-top, Crew, etc.",
  "marque": "brand name",
  "modele": "model name if mentioned",
  "couleur": "color in French (noir, blanc, bleu marine, bleu clair, gris, beige, marron, etc.)",
  "palette": "froid | neutre | chaud — based on color temperature",
  "matiere": "material: denim, cuir, coton, nylon, laine, daim, lin, etc.",
  "coupe": "fit/cut: slim, straight, regular, structured, oversized, etc.",
  "niveau": "casual | smart casual | business | formal",
  "saison": "toutes | été | hiver | automne/hiver | printemps/été",
  "formalite": "1-5 (1=très casual, 5=très formel)",
  "impact": "1-5 (visual impact, how much the piece stands out)",
  "polyvalence": "1-5 (how many outfits this works with)",
  "etat": "neuf | bon | usé"
}

Rules:
- If the user says "formalité 2", set formalite to 2
- Infer palette from color: cool tones (bleu, noir, gris) → "froid", warm tones (marron, beige, camel) → "chaud", neutral → "neutre"
- Infer niveau from formalite if given: 1-2 → casual, 3 → smart casual, 4 → business, 5 → formal
- Default saison to "toutes" unless the item is clearly seasonal
- Default etat to "neuf" unless stated otherwise
- Default impact to 3, polyvalence to 3

Return ONLY the JSON object, no markdown fences, no explanation.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export type ParsedItem = Partial<Omit<ClothingItem, 'id'>>;

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export async function parseAddItem(userMessage: string): Promise<ParsedItem> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `${SCHEMA_DESCRIPTION}\n\nUser message: "${userMessage}"`,
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';

  try {
    const parsed = JSON.parse(stripFence(text));
    return {
      categorie: parsed.categorie ?? undefined,
      sousCategorie: parsed.sousCategorie ?? undefined,
      marque: parsed.marque ?? undefined,
      modele: parsed.modele ?? undefined,
      couleur: parsed.couleur ?? undefined,
      palette: parsed.palette ?? undefined,
      matiere: parsed.matiere ?? undefined,
      coupe: parsed.coupe ?? undefined,
      niveau: parsed.niveau ?? undefined,
      saison: parsed.saison ?? undefined,
      formalite: parsed.formalite != null ? Number(parsed.formalite) : undefined,
      impact: parsed.impact != null ? Number(parsed.impact) : undefined,
      polyvalence: parsed.polyvalence != null ? Number(parsed.polyvalence) : undefined,
      etat: parsed.etat ?? undefined,
    };
  } catch {
    throw new Error('Je n\'ai pas pu interpréter le vêtement. Essaie avec plus de détails.');
  }
}

/** Check if a message intends to add a clothing item */
export function isAddItemIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(ajoute|ajout|nouveau|nouvelle|range|enregistre|añade|añadir|agregar|agrega|add)\b/.test(lower);
}

const IMAGE_PROMPT = `Analyze this photo of a clothing item. ${SCHEMA_DESCRIPTION}

Additional visual analysis rules:
- Identify the garment type from the image (categorie, sousCategorie)
- Detect the dominant color and infer palette temperature
- Estimate material/fabric from texture
- Assess formality level from the item's style
- If the user provided additional text, use it to fill or override fields (e.g. brand, model)`;

/** Extra fields returned only when the photo was taken away from Paris (see origin/style context). */
export interface TravelAnalysis {
  usableParis?: 'oui' | 'non' | 'à vérifier';
  usableParisRaison?: string;
}

function buildTravelPrompt(origin: string, styleProfile?: string): string {
  return `\n\nCette pièce a été photographiée à ${origin}, pas à Paris où Adrien vit et porte le reste de sa garde-robe. ` +
    `Évalue si elle est utilisable dans sa garde-robe parisienne, en tenant compte du climat tempéré de Paris (4 saisons, ` +
    `rarement les extrêmes de chaleur ou de froid secs) et, si fourni ci-dessous, de son style personnel.\n\n` +
    (styleProfile
      ? `Profil de style d'Adrien :\n"""\n${styleProfile}\n"""\n`
      : `(Profil de style d'Adrien pas encore renseigné — juge uniquement sur le climat et la polyvalence générale de la pièce.)\n`) +
    `\nAjoute deux clés au JSON :\n` +
    `"usableParis": "oui" (s'intègre au climat et au style d'Adrien à Paris) | "non" (trop spécifique au climat/style local, ` +
    `ex. doudoune trop épaisse, pièce hors style) | "à vérifier" (incertain),\n` +
    `"usableParisRaison": une phrase courte en français justifiant le choix.`;
}

export async function parseAddItemFromImage(
  imageBase64: string,
  mimeType: string,
  userText?: string,
  travelContext?: { origin: string; styleProfile?: string },
): Promise<ParsedItem & TravelAnalysis> {
  const anthropic = getClient();

  const travelPrompt =
    travelContext && travelContext.origin !== 'Paris'
      ? buildTravelPrompt(travelContext.origin, travelContext.styleProfile)
      : '';

  const textContent = (userText
    ? `${IMAGE_PROMPT}\n\nUser message: "${userText}"`
    : IMAGE_PROMPT) + travelPrompt;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: travelPrompt ? 650 : 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as ImageMediaType,
              data: imageBase64,
            },
          },
          { type: 'text', text: textContent },
        ],
      },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';

  try {
    const parsed = JSON.parse(stripFence(text));
    return {
      categorie: parsed.categorie ?? undefined,
      sousCategorie: parsed.sousCategorie ?? undefined,
      marque: parsed.marque ?? undefined,
      modele: parsed.modele ?? undefined,
      couleur: parsed.couleur ?? undefined,
      palette: parsed.palette ?? undefined,
      matiere: parsed.matiere ?? undefined,
      coupe: parsed.coupe ?? undefined,
      niveau: parsed.niveau ?? undefined,
      saison: parsed.saison ?? undefined,
      formalite: parsed.formalite != null ? Number(parsed.formalite) : undefined,
      impact: parsed.impact != null ? Number(parsed.impact) : undefined,
      polyvalence: parsed.polyvalence != null ? Number(parsed.polyvalence) : undefined,
      etat: parsed.etat ?? undefined,
      usableParis: parsed.usableParis ?? undefined,
      usableParisRaison: parsed.usableParisRaison ?? undefined,
    };
  } catch {
    throw new Error('Je n\'ai pas pu analyser la photo. Essaie avec une meilleure image ou ajoute une description.');
  }
}
