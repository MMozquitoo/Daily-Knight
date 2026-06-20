import Anthropic from '@anthropic-ai/sdk';
import type { ClothingItem } from '../types/wardrobe.js';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { DayWeather } from '../types/weather.js';
import type { AgendaSummary } from '../types/agenda.js';
import * as sheets from './sheets.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Multi-turn conversation memory (per user, in-memory)
// ---------------------------------------------------------------------------

interface ConversationEntry {
  messages: Anthropic.MessageParam[];
  lastActivity: number;
}

const conversations = new Map<string, ConversationEntry>();
const MAX_HISTORY = 100;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

function getHistory(userId: string): Anthropic.MessageParam[] {
  const entry = conversations.get(userId);
  if (!entry) return [];
  if (Date.now() - entry.lastActivity > TTL_MS) {
    conversations.delete(userId);
    return [];
  }
  return entry.messages;
}

function pushHistory(userId: string, messages: Anthropic.MessageParam[]) {
  const entry = conversations.get(userId) ?? { messages: [], lastActivity: 0 };
  entry.messages.push(...messages);
  if (entry.messages.length > MAX_HISTORY) {
    entry.messages = entry.messages.slice(-MAX_HISTORY);
  }
  entry.lastActivity = Date.now();
  conversations.set(userId, entry);
}

export function clearHistory(userId: string) {
  conversations.delete(userId);
}

// ---------------------------------------------------------------------------
// Wardrobe serialization
// ---------------------------------------------------------------------------

function serializeWardrobe(items: ClothingItem[]): string {
  if (items.length === 0) return '(armoire vide)';
  return items
    .map((i) => {
      const layer = categoryFromSheet(i.categorie);
      return [
        i.id, `[${layer}]`, i.categorie, i.sousCategorie, i.couleur,
        i.marque || '—', i.matiere || '—', `f${i.formalite}`, `pol${i.polyvalence}`,
        i.saison, i.etat,
      ].join(' | ');
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Tu es l'assistant garde-robe de Wardrobe Knight. Tu réponds en français, de façon concise et concrète.

Tu reçois l'inventaire complet de la garde-robe de l'utilisateur. Chaque ligne est un vêtement :
ID | [layer] | catégorie | sous-catégorie | couleur | marque | matière | formalité | polyvalence | saison | état

Les "layers" sont : top, bottom, shoes, outerwear, accessories.
La formalité va de 1 (très casual) à 5 (très formel). La polyvalence de 1 à 5.

Règles pour bien répondre :
- "Combien de X" → compte précisément depuis l'inventaire, donne le chiffre et liste les IDs.
- "Qu'est-ce qui manque" → repère les layers sous-représentés ou les manques par formalité/saison.
- "Qu'est-ce qui est en double" → même catégorie + couleur + formalité proches (±1). Signale par ID.
- "Qu'est-ce que je peux jeter" → priorise état "usé", faible polyvalence, puis doublons.
- "Quel accessoire va avec X" → harmonie de couleur et cohérence de formalité (±1 niveau).

Tu as accès à des outils pour MODIFIER la garde-robe et consulter l'historique. Utilise-les quand l'utilisateur le demande.
- Pour mettre à jour un item : utilise update_item.
- Pour supprimer un item : utilise delete_item — TOUJOURS demander confirmation avant de supprimer.
- Pour chercher un item par ID : utilise get_item.
- Pour voir ce qui a été porté récemment : utilise get_worn_history. Les vêtements portés hier sont automatiquement bloqués (cooldown de 3 jours).

Réponds en te basant UNIQUEMENT sur l'inventaire fourni. Référence les vêtements par leur ID. Sois bref.`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_item',
    description: 'Récupère un vêtement par son ID pour voir ses détails complets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: "L'ID du vêtement (ex: JE-01, SN-03)" },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_item',
    description: "Met à jour un ou plusieurs champs d'un vêtement existant. Champs modifiables : couleur, palette, matiere, coupe, niveau, saison, formalite, impact, polyvalence, etat, marque, modele, categorie, sousCategorie.",
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: "L'ID du vêtement à modifier" },
        fields: {
          type: 'object',
          description: 'Les champs à mettre à jour avec leurs nouvelles valeurs',
          properties: {
            categorie: { type: 'string' },
            sousCategorie: { type: 'string' },
            marque: { type: 'string' },
            modele: { type: 'string' },
            couleur: { type: 'string' },
            palette: { type: 'string', enum: ['froid', 'neutre', 'chaud'] },
            matiere: { type: 'string' },
            coupe: { type: 'string' },
            niveau: { type: 'string' },
            saison: { type: 'string' },
            formalite: { type: 'number', minimum: 1, maximum: 5 },
            impact: { type: 'number', minimum: 1, maximum: 5 },
            polyvalence: { type: 'number', minimum: 1, maximum: 5 },
            etat: { type: 'string', enum: ['neuf', 'bon', 'usé'] },
          },
        },
      },
      required: ['id', 'fields'],
    },
  },
  {
    name: 'delete_item',
    description: "Supprime un vêtement de la garde-robe par son ID. Utilise UNIQUEMENT après confirmation explicite de l'utilisateur.",
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: "L'ID du vêtement à supprimer" },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_worn_history',
    description: "Récupère l'historique des tenues portées récemment. Utile pour répondre à « qu'est-ce que j'ai porté cette semaine ? » ou vérifier si un vêtement a été porté récemment.",
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Nombre de jours à remonter (défaut: 7)', minimum: 1, maximum: 30 },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  switch (name) {
    case 'get_item': {
      const item = await sheets.getById(input.id);
      if (!item) return `Aucun vêtement trouvé avec l'ID "${input.id}".`;
      return JSON.stringify(item, null, 2);
    }
    case 'update_item': {
      const success = await sheets.update(input.id, input.fields);
      if (!success) return `Aucun vêtement trouvé avec l'ID "${input.id}".`;
      const fieldNames = Object.keys(input.fields).join(', ');
      return `${input.id} mis à jour (${fieldNames}).`;
    }
    case 'delete_item': {
      const success = await sheets.deleteById(input.id);
      if (!success) return `Aucun vêtement trouvé avec l'ID "${input.id}".`;
      return `${input.id} supprimé de la garde-robe.`;
    }
    case 'get_worn_history': {
      const days = input.days ?? 7;
      const history = await sheets.getWornRecently(days);
      if (history.length === 0) return `Aucun historique trouvé pour les ${days} derniers jours.`;
      return JSON.stringify(history, null, 2);
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}

// ---------------------------------------------------------------------------
// Main advisor entry point (agentic loop)
// ---------------------------------------------------------------------------

export async function askAdvisor(
  userId: string,
  question: string,
  items: ClothingItem[],
  weather?: DayWeather,
  agenda?: AgendaSummary,
): Promise<string> {
  const anthropic = getClient();

  const contextLines = [`INVENTAIRE (${items.length} pièces) :`, serializeWardrobe(items)];
  if (weather) {
    contextLines.push(
      '',
      `MÉTÉO DU JOUR : ${weather.temperature}°C (ressenti ${weather.feelsLike}°C), ` +
        `pluie ${weather.rainProbability}%, ${weather.condition}`,
    );
  }
  if (agenda) {
    contextLines.push(
      '',
      `AGENDA : ${agenda.meetingsCount} événement(s), ` +
        `formalité ${agenda.highestFormality}, journée ${agenda.dayType}`,
    );
  }

  const systemWithContext = `${SYSTEM_PROMPT}\n\n${contextLines.join('\n')}`;

  const history = getHistory(userId);
  const userMessage: Anthropic.MessageParam = { role: 'user', content: question };
  const messages: Anthropic.MessageParam[] = [...history, userMessage];

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: systemWithContext,
    tools: TOOLS,
    messages,
  });

  const allAssistantContent: Anthropic.ContentBlock[] = [];

  // Agentic loop: keep going while Claude wants to use tools
  while (response.stop_reason === 'tool_use') {
    allAssistantContent.push(...response.content);

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: any } =>
        b.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: 'assistant', content: response.content as any });
    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemWithContext,
      tools: TOOLS,
      messages,
    });
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  const answer = textBlock?.type === 'text' ? textBlock.text : "Je n'ai pas pu générer de réponse.";

  // Save to multi-turn history (only user message + final assistant text)
  pushHistory(userId, [
    userMessage,
    { role: 'assistant', content: answer },
  ]);

  return answer;
}
