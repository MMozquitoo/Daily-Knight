import type { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { planWeek } from '../../services/planner.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

const SLACK_USER_ID = process.env.SLACK_USER_ID ?? '';

export default async function handler(_req: Request, res: Response): Promise<void> {
  try {
    const planned = await planWeek(7, false);

    if (SLACK_USER_ID && process.env.SLACK_BOT_TOKEN) {
      const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

      const lines = planned.map((p) => {
        const items = [p.top, p.bottom, p.shoes, p.outerwear].filter(Boolean).join(' + ');
        return `*${p.dayName} ${p.date}*\n   ${p.weatherSummary}\n   ${p.agendaSummary}\n   :shirt: ${items || 'aucun'}${p.carry ? ` · :umbrella_with_rain_drops: ${p.carry}` : ''}`;
      });

      await slack.chat.postMessage({
        channel: SLACK_USER_ID,
        text: `:calendar: *Plan de la semaine*\n\n${lines.join('\n\n')}`,
      });
    }

    res.status(200).json({ ok: true, days: planned.length, planned });
  } catch (err) {
    console.error('[CRON PLAN-WEEK]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown' });
  }
}
