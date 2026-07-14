import type { Request, Response } from 'express';
import { requireCron } from '../_auth.js';
import { WebClient } from '@slack/web-api';
import { planWeek } from '../../services/planner.js';

// Hobby caps at 60s (vercel.json pins api/** to 60); 300 was never honoured.
export const config = { runtime: 'nodejs', maxDuration: 60 };

const SLACK_USER_ID = process.env.SLACK_USER_ID ?? '';

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!requireCron(req, res)) return;
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
