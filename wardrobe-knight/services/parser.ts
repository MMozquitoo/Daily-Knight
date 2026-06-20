/**
 * Natural Language Parser — Claude API (Sonnet)
 *
 * Interprets free-text messages about adding/modifying clothing items.
 * Returns structured ClothingItem fields matching the Google Sheet schema.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClothingItem } from '../types/wardrobe.js';

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
    const parsed = JSON.parse(text);
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

export async function parseAddItemFromImage(
  imageBase64: string,
  mimeType: string,
  userText?: string,
): Promise<ParsedItem> {
  const anthropic = getClient();

  const textContent = userText
    ? `${IMAGE_PROMPT}\n\nUser message: "${userText}"`
    : IMAGE_PROMPT;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
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
    const parsed = JSON.parse(text);
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
    throw new Error('Je n\'ai pas pu analyser la photo. Essaie avec une meilleure image ou ajoute une description.');
  }
}
