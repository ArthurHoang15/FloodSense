/**
 * local server entry file, for local development
 */
import 'dotenv/config';
import app from './_app.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

// ── Flood Pipeline Cron ──────────────────────────────────────────────────────
// Runs Exa.ai → GPT-4o/rule-based → Supabase every 5 minutes (local dev only).
// This replaces n8n for the hackathon demo — no external service needed.
// NOTE: Vercel serverless (api/index.ts) does NOT run this; only _server.ts does.

const PIPELINE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PIPELINE_INITIAL_DELAY_MS = 10 * 1000; // 10s after server start
let pipelineCronId: ReturnType<typeof setInterval> | null = null;

async function runPipelineCron(): Promise<void> {
  const baseUrl = `http://localhost:${PORT}`;
  const secret = process.env.INTERNAL_SECRET || '';

  console.log('[cron] Running flood intelligence pipeline...');

  try {
    // Step 1: Run the Exa.ai → extraction → Supabase pipeline
    const pipelineRes = await fetch(`${baseUrl}/api/internal/run-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
    });

    const pipelineData = await pipelineRes.json() as {
      success: boolean;
      articles_fetched?: number;
      new_floods?: number;
      updated_floods?: number;
      error?: string;
    };

    if (!pipelineData.success) {
      console.error('[cron] Pipeline failed:', pipelineData.error);
      return;
    }

    console.log(
      `[cron] Pipeline complete — articles: ${pipelineData.articles_fetched}, ` +
      `new floods: ${pipelineData.new_floods}, updated: ${pipelineData.updated_floods}`
    );

    // Step 2: If new floods were found, check saved routes for affected users
    // (skipped if no new floods — nothing to notify about)
    if (pipelineData.new_floods && pipelineData.new_floods > 0) {
      console.log('[cron] New floods detected, checking saved routes...');

      const routesRes = await fetch(`${baseUrl}/api/internal/check-saved-routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
        },
        body: JSON.stringify({ flood_id: 'latest' }),
      });

      const routesData = await routesRes.json() as { success: boolean; notified?: number };
      if (routesData.success) {
        console.log(`[cron] Notified ${routesData.notified ?? 0} saved route owners`);
      }
    }
  } catch (err) {
    console.error('[cron] Pipeline cron error:', err);
  }
}

function startPipelineCron(): void {
  // Only start if EXA_API_KEY is configured (no point running without it)
  if (!process.env.EXA_API_KEY) {
    console.log('[cron] EXA_API_KEY not set — pipeline cron disabled');
    return;
  }

  console.log(`[cron] Pipeline cron scheduled: every ${PIPELINE_INTERVAL_MS / 1000}s (first run in ${PIPELINE_INITIAL_DELAY_MS / 1000}s)`);

  // First run after a short delay to let the server fully start
  setTimeout(() => {
    runPipelineCron();
    // Then repeat every 5 minutes
    pipelineCronId = setInterval(runPipelineCron, PIPELINE_INTERVAL_MS);
  }, PIPELINE_INITIAL_DELAY_MS);
}

// Start the cron after server is listening
startPipelineCron();

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal: string): void {
  console.log(`${signal} signal received`);
  if (pipelineCronId) {
    clearInterval(pipelineCronId);
    console.log('[cron] Pipeline cron stopped');
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;