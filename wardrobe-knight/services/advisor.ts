import Anthropic from '@anthropic-ai/sdk';
import type { ClothingItem } from '../types/wardrobe.js';
import { categoryFromSheet } from '../types/wardrobe.js';
import type { DayWeather } from '../types/weather.js';
import type { AgendaSummary } from '../types/agenda.js';
import type { StyleRule } from '../types/rules.js';
import * as sheets from './sheets.js';
import * as memory from './memory.js';
import { getPlannedOutfit } from './planner.js';
import { regenerateOutfit } from '../engine/index.js';
import { buildDailyContext } from '../engine/context.js';
import { toWardrobeItems } from '../types/adapter.js';
import { fetchTodayAgenda } from './calendar.js';
import { resolveDayPlace } from './destination.js';
import { todayStr } from './dates.js';

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

const SYSTEM_PROMPT = `Tu es Mage Stylist, l'assistant garde-robe personnel de l'utilisateur. Tu réponds UNIQUEMENT en français — jamais en espagnol, anglais ou autre langue, même si l'utilisateur écrit dans une autre langue. Sois concis et concret. Tu as de la personnalité : tu es un ami styliste, pas un robot.

Tu reçois l'inventaire complet de la garde-robe de l'utilisateur. Chaque ligne est un vêtement :
ID | [layer] | catégorie | sous-catégorie | couleur | marque | matière | formalité | polyvalence | saison | état

Les "layers" sont : top, bottom, shoes, outerwear, accessories.
La formalité va de 1 (très casual) à 5 (très formel). La polyvalence de 1 à 5.

SOURCE DE VÉRITÉ : l'INVENTAIRE ci-dessous est TOUJOURS à jour au moment présent et c'est la SEULE source fiable de ce que l'utilisateur possède. La garde-robe change en cours de conversation — l'utilisateur ajoute et retire des vêtements (souvent par photo, sans te le dire dans le chat). Ce que tu as pu dire plus tôt sur ce qu'il possède ou non peut donc être PÉRIMÉ. Avant d'affirmer qu'un vêtement manque ("tu n'as pas de X"), RELIS l'inventaire actuel et cherche par marque, catégorie ET sous-catégorie (ex : une Birkenstock apparaît en catégorie "Sandals", marque "Birkenstock"). Ne répète jamais une affirmation d'un tour précédent sans l'avoir re-vérifiée dans l'inventaire présent.

Règles pour bien répondre :
- "Combien de X" → compte précisément depuis l'inventaire, donne le chiffre et liste les IDs.
- "Qu'est-ce qui manque" → repère les layers sous-représentés ou les manques par formalité/saison.
- "Qu'est-ce qui est en double" → même catégorie + couleur + formalité proches (±1). Signale par ID.
- "Qu'est-ce que je peux jeter" → priorise état "usé", faible polyvalence, puis doublons.
- "Quel accessoire va avec X" → harmonie de couleur et cohérence de formalité (±1 niveau).

IMAGES : NE JAMAIS inclure d'URLs d'images, de liens markdown ![](url) ou de liens bruts dans ta réponse. Les images des vêtements sont affichées automatiquement par le système. N'essaie pas de les montrer toi-même.

OUTILS GARDE-ROBE :
- update_item : mettre à jour un item.
- delete_item : supprimer un item — TOUJOURS demander confirmation avant.
- get_item : chercher un item par ID.
- get_worn_history : voir l'historique récent. Cooldown de 3 jours automatique.
- get_planned_outfit : voir/générer la tenue planifiée pour une date (demain, lundi, etc.).
  → "demain" = date d'aujourd'hui + 1 jour. Calcule la bonne date YYYY-MM-DD.
  → Si le plan n'existe pas, dis à l'utilisateur de lancer /outfit pour le jour même.

OUTILS TENUE & RÈGLES DE STYLE — c'est comme ça que tu APPRENDS :
- suggest_outfit : génère/régénère la tenue du jour avec le vrai moteur (météo + agenda +
  règles). Utilise-le dès que l'utilisateur demande une autre tenue, refuse une pièce, ou
  veut plus casual / plus formel (« régénère », « propose autre chose », « je veux être
  tranquille aujourd'hui »). Mentionne ensuite chaque pièce par nom + ID — les images
  s'affichent automatiquement.
- save_style_rule : TRÈS IMPORTANT. Dès que l'utilisateur exprime une règle vestimentaire
  durable — « pas de chemise quand je suis à la maison », « jamais de boots l'été », « je
  préfère les sneakers au bureau » — sauvegarde une règle STRUCTURÉE avec cet outil. C'est
  la SEULE chose que le moteur du matin lit : un save_memory ne change JAMAIS les tenues
  proposées. Exemple exact : l'utilisateur dit « pourquoi une chemise, je suis à la maison,
  je veux être informel » → save_style_rule(context=maison, target=shirt, action=eviter)
  PUIS suggest_outfit(max_formality=casual, avoid_types=["shirt"]).

OUTILS MÉMOIRE — Tu as une mémoire persistante entre les conversations :
- save_memory : Sauvegarde une info importante. Types :
  • "preference" — marques aimées, styles préférés, couleurs favorites, habitudes
  • "suggestion" — tu recommandes d'acheter quelque chose (ajoute followUpDate pour rappeler plus tard)
  • "observation" — pattern de vie (ex: samedi = repos, travaille dans le marketing)
  • "joke" — blagues internes, réferences humoristiques partagées
- get_memories : Récupère les souvenirs sauvegardés.

QUAND SAUVEGARDER :
- L'utilisateur mentionne une marque qu'il aime → save_memory type "preference"
- L'utilisateur dit quelque chose sur ses habitudes (ex: "le samedi je fais rien") → save_memory type "observation"
- Tu suggères d'acheter un vêtement manquant → save_memory type "suggestion" + followUpDate dans 4-7 jours
- Un moment drôle ou une blague → save_memory type "joke"
- NE PAS sauvegarder des infos triviales ou déjà dans l'inventaire.

QUAND UTILISER LES SOUVENIRS :
- Personnalise tes recommandations avec les préférences connues (ex: si l'utilisateur aime Nike, suggère Nike).
- Rappelle les suggestions passées naturellement (ex: "Au fait, tu as pu regarder pour les sneakers blanches ?").
- Utilise les blagues internes pour créer de la complicité.
- Les samedis/dimanches, si tu sais que l'utilisateur se repose, adapte le ton (pyjama day, relax, etc.).

Réponds en te basant sur l'inventaire ET tes souvenirs. Quand tu parles d'un vêtement, utilise son nom complet (ex: "ta chemise Oxford bleu marine Seagale") plutôt que juste l'ID. Tu peux mettre l'ID entre parenthèses si nécessaire (ex: "ta chemise Oxford bleu marine Seagale (CA-03)") mais le nom doit toujours être en premier. Sois bref mais chaleureux.`;

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
  {
    name: 'save_memory',
    description: "Sauvegarde un souvenir persistant. Utilise pour retenir les préférences, suggestions, observations ou blagues de l'utilisateur.",
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['preference', 'suggestion', 'observation', 'joke'],
          description: 'Type de souvenir',
        },
        content: {
          type: 'string',
          description: 'Le contenu du souvenir (ex: "Aime Nike", "Suggéré des sneakers blanches")',
        },
        follow_up_date: {
          type: 'string',
          description: 'Date de rappel optionnelle au format YYYY-MM-DD. Utile pour les suggestions à rappeler.',
        },
      },
      required: ['type', 'content'],
    },
  },
  {
    name: 'get_memories',
    description: "Récupère les souvenirs sauvegardés pour cet utilisateur. Utilise en début de conversation ou quand tu veux personnaliser ta réponse.",
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Nombre max de souvenirs (défaut: 50)', minimum: 1, maximum: 100 },
      },
      required: [],
    },
  },
  {
    name: 'save_style_rule',
    description: "Sauvegarde une règle de style STRUCTURÉE que le moteur de tenues applique automatiquement chaque matin. À utiliser dès que l'utilisateur exprime une préférence vestimentaire durable (ex : « pas de chemise quand je suis à la maison »).",
    input_schema: {
      type: 'object' as const,
      properties: {
        context: {
          type: 'string',
          enum: ['maison', 'bureau', 'voyage', 'toujours'],
          description: "Quand la règle s'applique. maison = journée sans rendez-vous.",
        },
        target: {
          type: 'string',
          description: "Type de vêtement du moteur : shirt, tshirt, sweater, hoodie, pants, jeans, shorts, sneakers, boots, loafers, sandals, jacket, coat, blazer, vest — OU un ID précis (ex : CA-03). « chemise » → shirt.",
        },
        action: {
          type: 'string',
          enum: ['eviter', 'preferer'],
          description: 'eviter = ne plus proposer dans ce contexte ; preferer = favoriser.',
        },
        note: {
          type: 'string',
          description: "La phrase de l'utilisateur, pour mémoire.",
        },
      },
      required: ['context', 'target', 'action'],
    },
  },
  {
    name: 'suggest_outfit',
    description: "Génère une nouvelle tenue du jour avec le moteur déterministe (météo réelle + agenda + règles de style + feedback). Utilise quand l'utilisateur demande une tenue, une régénération, ou plus/moins formel. Enregistre aussi la tenue comme portée aujourd'hui.",
    input_schema: {
      type: 'object' as const,
      properties: {
        max_formality: {
          type: 'string',
          enum: ['casual', 'smart', 'formal'],
          description: "Force le niveau de formalité visé (casual = à la maison / détente).",
        },
        avoid_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types de vêtements à exclure pour CETTE tenue (ex : ["shirt"]).',
        },
        exclude_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs précis à exclure (ex : la pièce que l\'utilisateur vient de refuser).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_planned_outfit',
    description: "Récupère la tenue planifiée pour une date donnée et génère une image try-on si possible. Utilise quand l'utilisateur demande « qu'est-ce que je mets demain ? », « outfit de lundi », etc.",
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date au format YYYY-MM-DD. Utilise la date d\'aujourd\'hui + 1 pour "demain", etc.',
        },
      },
      required: ['date'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(name: string, input: Record<string, any>, userId: string): Promise<string> {
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
    case 'save_memory': {
      await memory.saveMemory(userId, input.type, input.content, input.follow_up_date);
      return `Souvenir sauvegardé : [${input.type}] ${input.content}`;
    }
    case 'get_memories': {
      const memories = await memory.getMemories(userId, input.limit ?? 50);
      if (memories.length === 0) return 'Aucun souvenir sauvegardé pour cet utilisateur.';
      return memories
        .map((m) => `[${m.date}] (${m.type}) ${m.content}${m.followUpDate ? ` → rappel: ${m.followUpDate}${m.done ? ' (fait)' : ''}` : ''}`)
        .join('\n');
    }
    case 'save_style_rule': {
      await sheets.logStyleRule({
        context: input.context,
        target: input.target,
        action: input.action,
        note: input.note,
      });
      return `Règle sauvegardée : [${input.context}] ${input.action} ${input.target}. Le moteur l'appliquera à chaque tenue.`;
    }
    case 'suggest_outfit': {
      const [agenda, items, wornHistory, feedbackScores, styleRules] = await Promise.all([
        fetchTodayAgenda(),
        sheets.getAll(),
        sheets.getWornRecently(7),
        sheets.getFeedbackScores().catch(() => new Map<string, number>()),
        sheets.getStyleRules().catch(() => [] as StyleRule[]),
      ]);
      const place = await resolveDayPlace(agenda);

      // A requested formality overrides what the calendar implies — "je veux être
      // tranquille" beats a work-tagged event.
      const adjustedAgenda = { ...agenda };
      if (input.max_formality === 'casual') {
        adjustedAgenda.highestFormality = 'casual';
      } else if (input.max_formality === 'smart') {
        adjustedAgenda.highestFormality = 'work';
      } else if (input.max_formality === 'formal') {
        adjustedAgenda.highestFormality = 'formal';
      }

      const context = buildDailyContext(place.weather, adjustedAgenda, 'mixed', place.name);
      const wardrobeItems = toWardrobeItems(items);
      const recentlyWorn = sheets.buildCooldownMap(wornHistory);

      // One-off exclusions ride as ephemeral rules — same mechanism, not persisted
      const ephemeralRules: StyleRule[] = (input.avoid_types ?? []).map((t: string) => ({
        date: todayStr(),
        context: 'toujours' as const,
        target: t,
        action: 'eviter' as const,
      }));

      const recommendation = regenerateOutfit(
        wardrobeItems,
        context,
        input.exclude_ids ?? [],
        recentlyWorn,
        feedbackScores,
        [...styleRules, ...ephemeralRules],
      );

      await sheets.logWorn(todayStr(), {
        top: recommendation.wear.top,
        bottom: recommendation.wear.bottom,
        shoes: recommendation.wear.shoes,
        outerwear: recommendation.wear.outerwear,
      }).catch(() => {});

      const describe = (id?: string) => {
        if (!id) return '';
        const item = items.find((i) => i.id === id);
        return item
          ? `${item.categorie} ${item.sousCategorie} ${item.couleur}${item.marque ? ` (${item.marque})` : ''} [${id}]`
          : id;
      };
      return [
        `Tenue générée (météo ${place.weather.temperature}°C à ${place.name}) :`,
        `Haut : ${describe(recommendation.wear.top)}`,
        `Bas : ${describe(recommendation.wear.bottom)}`,
        `Chaussures : ${describe(recommendation.wear.shoes)}`,
        recommendation.wear.outerwear ? `Veste : ${describe(recommendation.wear.outerwear)}` : '',
        `Pourquoi : ${recommendation.why}`,
      ].filter(Boolean).join('\n');
    }
    case 'get_planned_outfit': {
      const planned = await getPlannedOutfit(input.date);
      if (!planned || !planned.top) {
        return `Aucune tenue planifiée pour le ${input.date}. Le plan est généré chaque dimanche soir. L'utilisateur peut aussi demander /outfit pour aujourd'hui.`;
      }
      const allItems = await sheets.getAll();
      const itemDetails = (id: string) => {
        const item = allItems.find((i) => i.id === id);
        return item ? `${id} — ${item.categorie} ${item.sousCategorie} ${item.couleur}${item.marque ? ` (${item.marque})` : ''}` : id;
      };

      const lines = [
        `Tenue planifiée pour ${planned.dayName} ${planned.date} :`,
        `Météo : ${planned.weatherSummary}`,
        `Agenda : ${planned.agendaSummary}`,
        '',
        `Haut : ${itemDetails(planned.top)}`,
        planned.bottom ? `Bas : ${itemDetails(planned.bottom)}` : '',
        planned.shoes ? `Chaussures : ${itemDetails(planned.shoes)}` : '',
        planned.outerwear ? `Outerwear : ${itemDetails(planned.outerwear)}` : '',
        planned.carry ? `Accessoires : ${planned.carry}` : '',
        `Raison : ${planned.why}`,
      ].filter(Boolean);

      for (const id of [planned.top, planned.bottom, planned.shoes, planned.outerwear]) {
        if (!id) continue;
        const item = allItems.find((i) => i.id === id);
        const imageUrl = item?.productUrl || item?.tryonUrl;
        if (imageUrl) {
          lines.push(`Image ${item!.id} : ${imageUrl}`);
        }
      }

      return lines.join('\n');
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

  const today = new Date();
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  contextLines.push('', `AUJOURD'HUI : ${dayNames[today.getDay()]} ${today.toISOString().slice(0, 10)}`);

  // Load persistent memories
  const [savedMemories, pendingFollowUps] = await Promise.all([
    memory.getMemories(userId).catch(() => []),
    memory.getPendingFollowUps(userId).catch(() => []),
  ]);

  if (savedMemories.length > 0) {
    contextLines.push('', `SOUVENIRS (${savedMemories.length}) :`);
    for (const m of savedMemories) {
      contextLines.push(`[${m.date}] (${m.type}) ${m.content}`);
    }
  }

  if (pendingFollowUps.length > 0) {
    contextLines.push('', 'RAPPELS EN ATTENTE :');
    for (const f of pendingFollowUps) {
      contextLines.push(`- ${f.content} (suggéré le ${f.date})`);
    }
    contextLines.push('→ Mentionne ces rappels naturellement dans ta réponse si pertinent.');
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
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, any>, userId);
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
