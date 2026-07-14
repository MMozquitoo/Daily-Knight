/**
 * Run slow work after acknowledging Slack, without the 3-second timeout.
 *
 * A slash command must return HTTP 200 within 3s or Slack shows "operation_timeout".
 * The bot does its work (agenda + sheet + weather + engine) before replying, because
 * on Vercel the instance freezes the moment the response is flushed — so it can't
 * just ack() early and finish afterwards the way a long-running server would.
 *
 * waitUntil() is Vercel's escape hatch: it keeps the function alive until the passed
 * promise resolves, even after the HTTP response was sent. So the handler acks, hands
 * the heavy work to afterAck(), and returns immediately — the ack reaches Slack fast,
 * and the work still completes and posts the result via respond().
 *
 * Off Vercel (local dev, long-running process) there's no freeze and no waitUntil, so
 * we just await the work inline.
 */

import { waitUntil } from '@vercel/functions';

export function afterAck(work: () => Promise<void>): void {
  const done = work().catch((err) => console.error('[afterAck]', err));
  if (process.env.VERCEL) {
    waitUntil(done);
  } else {
    // Local: nothing freezes, so let it run in the background of the process
    void done;
  }
}
