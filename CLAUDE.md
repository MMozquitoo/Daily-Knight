# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wardrobe Knight is a personal Slack bot that recommends one outfit each morning. It reads the day's weather (Open-Meteo), calendar events (Google Calendar), and the user's wardrobe (Google Sheets) to generate a deterministic recommendation with an explanation. The user interacts exclusively from Slack — no mobile app, no web frontend.

## Commands

All commands run from the `wardrobe-knight/` directory:

```bash
cd wardrobe-knight
npm install
npm run dev          # start with hot-reload (tsx --watch)
npm start            # production start
npm run typecheck    # type-check without emitting
```

## Architecture

### Folder Structure

```
wardrobe-knight/
  bot/              # Slack Bolt app + Block Kit builders
  engine/           # Deterministic outfit decision pipeline (pure TS)
  services/
    weather.ts      # Open-Meteo API
    calendar.ts     # Google Calendar API v3
    sheets.ts       # Google Sheets API v4 (wardrobe CRUD)
    parser.ts       # Claude API for natural language parsing
  types/            # TypeScript interfaces
  constants/        # Scoring weights, why-templates, palette
```

### Decision Engine (`engine/`)

Pure TypeScript — zero framework imports. 6-step pipeline:

1. `filter.ts` — Remove unavailable items, weather/formality mismatches
2. `scorer.ts` — Rank items: weather (40%), formality (30%), context (20%), style (10%), plus bounded 👍/👎 feedback shifts and decisive style-rule adjustments ("Règles" tab, e.g. "no shirts on home days")
3. `assembler.ts` — Pick top-scoring item per layer (top, bottom, shoes, outerwear)
4. `validator.ts` — Check outfit-level rules (color harmony, formality consistency)
5. `carry.ts` — Rule-based carry items (umbrella if rain > 30%, etc.)
6. `why.ts` — Template-based explanation sentence (French)

Public API: `generateOutfit()`, `regenerateOutfit()`, `swapLayer()`.

### Type Adapter (`types/adapter.ts`)

The Google Sheets schema uses a 15-column `ClothingItem` type (French UI values, numeric formality 1–5). The engine uses the legacy `WardrobeItem` type (English, 3-level formality). The `toWardrobeItem()` adapter bridges between them — all mapping logic is centralized here.

### Slack Bot (`bot/`)

Built with `@slack/bolt` in Socket Mode. Entry point: `bot/index.ts`.

Slash commands: `/outfit`, `/armoire`, `/agenda`, `/meteo`, `/stats`.
Natural language: "je mets quoi ?" triggers outfit, "ajoute [vêtement]" triggers add-item flow via Claude API parsing. Voice notes are transcribed (Whisper via Replicate, `services/transcribe.ts`) and routed through the same text pipeline (`routeTextMessage`).
Block Kit messages with action buttons for regenerate, more-formal, view-agenda, and visible 👍/👎 feedback buttons per piece.

The daily outfit message carries ONE image: the user wearing the full look (`generateFullLook` in `services/tryon.ts` — google/nano-banana on Replicate, IDM-VTON two-pass as fallback). Per-item product photos are legacy-only. The evening cron pre-warms the look for the next morning; interactive flows post the outfit text first and follow up with the image.

Learning: the DM advisor (`services/advisor.ts`) saves structured style rules via its `save_style_rule` tool ("Règles" sheet tab) and can regenerate the day's outfit via `suggest_outfit`. The engine, the crons, and the weekly planner all consume these rules; the morning cron discards a pre-planned outfit that violates a rule now in force.

### Google Sheets Database (`services/sheets.ts`)

Single sheet "Armoire" with 15 columns (A–O). ID auto-generated with type prefix (e.g., JE-03 for jeans). Operations: `getAll()`, `getById()`, `append()`, `update()`.

Authentication: Google service account via `GOOGLE_SERVICE_ACCOUNT_JSON` env var.

### External Services

- **Weather**: Open-Meteo (free, no key) — location from `USER_LATITUDE`/`USER_LONGITUDE` env vars
- **Calendar**: Google Calendar API v3 — reads today's events, classifies formality by keywords
- **Parser**: Claude API (Sonnet) — interprets natural language add-item messages into structured 15-column data
- **Sheets**: Google Sheets API v4 — wardrobe CRUD operations

### Environment Variables

See `.env.example` for the full list. Required: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `ANTHROPIC_API_KEY`.

## Key Design Decisions

- **No backend/database server** — Google Sheets is the single source of truth, editable by hand.
- **Rule-based, not AI** — Deterministic scoring engine for outfit selection. Claude API is only used for natural language parsing of add-item messages.
- **Socket Mode** — Bot connects via WebSocket, no public URL needed.
- **French UI** — All bot responses, why-templates, and sheet column values are in French.
- **Scoring weights** in `constants/scoring.ts`, **explanation templates** in `constants/why-templates.ts` — tunable without changing logic.
