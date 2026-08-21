/**
 * Poland-trip wardrobe report — Claude API (Sonnet)
 *
 * One-shot analysis combining the two "sub-wardrobes" (origine = France vs
 * Pologne), Adrien's style profile, and a monthly climate projection, to
 * answer: what from the Poland haul is worth integrating, what in the France
 * wardrobe is now redundant, and what to prioritise month by month once he's
 * back home.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClothingItem } from '../types/wardrobe.js';
import type { MonthlyClimate } from './weather.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function itemLine(item: ClothingItem): string {
  const bits = [
    item.id,
    item.categorie,
    item.sousCategorie,
    item.couleur,
    item.matiere,
    `niveau ${item.niveau}`,
    `saison ${item.saison}`,
    `formalité ${item.formalite}/5`,
  ];
  if (item.usableParis) bits.push(`utilisable Paris: ${item.usableParis}`);
  return `- ${bits.filter(Boolean).join(' · ')}`;
}

function climateTable(climate: MonthlyClimate[]): string {
  return climate
    .map((m) => `- ${m.label} : ${m.avgTempMin}°C à ${m.avgTempMax}°C, pluie ${m.rainyDaysPct}% des jours`)
    .join('\n');
}

export interface TripReportInput {
  franceItems: ClothingItem[];
  polandItems: ClothingItem[];
  styleProfile?: string;
  climate: MonthlyClimate[];
  returnDate: string; // "2026-08-27"
}

/** Generate the French-language report as Slack mrkdwn text. */
export async function generateTripReturnReport(input: TripReportInput): Promise<string> {
  const { franceItems, polandItems, styleProfile, climate, returnDate } = input;

  const prompt = `Tu es le styliste personnel d'Adrien (bot "Mage Stylist"). Il est actuellement à Radom, en Pologne, et rentre en France le ${returnDate}.

Voici sa garde-robe actuelle en France (origine = France, ${franceItems.length} pièces) :
${franceItems.length ? franceItems.map(itemLine).join('\n') : '(aucune donnée)'}

Voici les pièces ajoutées pendant son séjour en Pologne (origine = Pologne, ${polandItems.length} pièces) :
${polandItems.length ? polandItems.map(itemLine).join('\n') : "(aucune pour l'instant — il n'a pas encore envoyé de photos)"}

${styleProfile ? `Son profil de style :\n${styleProfile}\n` : ''}
Climat prévu en France pour les prochains mois (moyennes historiques) :
${climateTable(climate)}

Rédige un rapport court en français, format Slack (gras avec des astérisques simples *comme ça*, listes à puces avec •), structuré en 3 sections avec ces titres exacts :

*1. Retour de Pologne*
Pour chaque pièce ramenée de Pologne (s'il y en a), dis si elle doit rejoindre la rotation régulière, si c'était utile seulement pour le voyage (à mettre de côté), ou si le style/climat ne colle pas avec la France. S'il n'y a encore aucune pièce de Pologne, dis-le simplement et explique qu'on complètera cette section dès qu'il envoie ses photos.

*2. Garde-robe France*
Avec l'arrivée des nouvelles pièces (ou en anticipant), quelles pièces françaises deviennent redondantes ou passent en second plan. Sois concret, cite des IDs.

*3. Projection ${climate.map((m) => m.label).join('/')}*
Mois par mois, ce qu'il faut prioriser (fond de garde-robe, superposition, imperméable, etc.) selon le climat ci-dessus, et les manques à combler (achats à prévoir), en tenant compte de son profil de style si fourni.

Reste concis — pas plus de 250 mots au total. Pas de préambule, commence directement par "*1. Retour de Pologne*".`;

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : "Je n'ai pas pu générer le rapport.";
}
