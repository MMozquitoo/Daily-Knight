# Wardrobe Knight

A personal Slack bot that tells you what to wear every day. No browsing, no AI decisions — just one clear outfit recommendation based on your weather, calendar, and wardrobe.

> Open Slack, get one answer. The choice is already made.

## What It Does

1. **Reads your day** — weather forecast (Open-Meteo) + calendar events (Google Calendar)
2. **Scores your wardrobe** — deterministic rule engine filters and ranks every item (Google Sheets)
3. **Shows one outfit** — what to wear, what to carry, and why — directly in Slack

## Tech Stack

| Layer | Choice |
|-------|--------|
| Bot | Slack Bolt (HTTP Request URL) |
| Language | TypeScript (strict) |
| Wardrobe DB | Google Sheets API v4 |
| Calendar | Google Calendar API v3 |
| Weather | Open-Meteo (free, no API key) |
| NLP Parser | Claude API (Sonnet) — for adding items with natural language |

## Commands

| Command | Description |
|---------|-------------|
| `/outfit` | Get today's outfit recommendation |
| `/armario` | View your wardrobe |
| `/agenda` | View today's calendar with formality tags |
| `/clima` | View today's weather |
| _"¿qué me pongo?"_ | Natural language trigger for outfit |
| _"añade unos jeans negros slim"_ | Add a clothing item with natural language |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A Slack workspace with a bot app configured for HTTP Request URLs
- A Google Cloud service account with Sheets + Calendar API access
- An Anthropic API key

### Install & Run

```bash
cd wardrobe-knight
cp .env.example .env   # fill in your credentials
npm install
npm run dev            # start with hot-reload
```

## Deploy on Vercel

Set the Vercel project Root Directory to `wardrobe-knight`.

Add these environment variables in Vercel:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_SHEET_ID`
- `GOOGLE_CALENDAR_ID`
- `ANTHROPIC_API_KEY`
- `USER_LATITUDE`
- `USER_LONGITUDE`

Slack configuration after deployment:

1. Disable Socket Mode in your Slack app.
2. Set the Request URL for Event Subscriptions to `https://<your-domain>/api/slack/events`.
3. Point every slash command to `https://<your-domain>/api/slack/events`.
4. Point Interactivity & Shortcuts to `https://<your-domain>/api/slack/events`.
5. Subscribe to at least `message.im` if you want DM-based natural language commands.

Use `https://<your-domain>/api/health` for a basic deployment check.

## Decision Engine

The engine is pure TypeScript with no framework dependencies:

1. **Filter** — remove unavailable items, weather mismatches, formality mismatches
2. **Score** — rank items by weather fit (40%), formality (30%), context (20%), style preference (10%)
3. **Assemble** — pick the top-scoring item per layer (top, bottom, shoes, outerwear)
4. **Validate** — check outfit-level rules (color harmony, formality consistency)
5. **Carry** — umbrella if rain > 30%, light layer if temp swing > 8°C, bag if formal day
6. **Explain** — generate a one-sentence "why" from templates

## License

MIT
