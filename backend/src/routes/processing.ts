import { Hono } from 'hono';
import { getDb } from '../db';
import { processNewsletters, getProcessingStatus } from '../services/summarizer';

export const processingRoutes = new Hono();

// Trigger summary generation
processingRoutes.post('/generate', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { newsletterIds, forceAll } = body;

    const result = await processNewsletters(newsletterIds, forceAll);

    return c.json({
      success: true,
      processingId: result.processingId,
      newsletterCount: result.newsletterCount,
      message: 'Summary generation started',
    });
  } catch (error) {
    console.error('Generate error:', error);
    return c.json({
      error: 'Failed to start processing',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get current processing status
processingRoutes.get('/status', async (c) => {
  const db = getDb();

  // Check for any in-progress processing
  const inProgress = db.query(
    "SELECT * FROM processing_history WHERE status = 'processing' ORDER BY triggered_at DESC LIMIT 1"
  ).get() as any;

  if (inProgress) {
    return c.json({
      isProcessing: true,
      processingId: inProgress.id,
      newsletterCount: inProgress.newsletter_count,
      triggeredAt: inProgress.triggered_at,
    });
  }

  // Get most recent completed/failed
  const recent = db.query(
    'SELECT * FROM processing_history ORDER BY triggered_at DESC LIMIT 1'
  ).get() as any;

  if (!recent) {
    return c.json({
      isProcessing: false,
      lastProcessing: null,
    });
  }

  return c.json({
    isProcessing: false,
    lastProcessing: {
      id: recent.id,
      status: recent.status,
      newsletterCount: recent.newsletter_count,
      triggeredAt: recent.triggered_at,
      completedAt: recent.completed_at,
      sentToEmail: recent.sent_to_email,
      errorMessage: recent.error_message,
    },
  });
});

// Get processing history
processingRoutes.get('/history', (c) => {
  const db = getDb();
  const limit = parseInt(c.req.query('limit') || '10');

  const history = db.query(`
    SELECT
      ph.id, ph.triggered_at, ph.completed_at, ph.status, ph.newsletter_count,
      ph.sent_to_email, ph.error_message, ph.schedule_id,
      ds.name as schedule_name
    FROM processing_history ph
    LEFT JOIN digest_schedules ds ON ph.schedule_id = ds.id
    ORDER BY ph.triggered_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return c.json({
    data: history.map(h => ({
      id: h.id,
      triggeredAt: h.triggered_at,
      completedAt: h.completed_at,
      status: h.status,
      newsletterCount: h.newsletter_count,
      sentToEmail: h.sent_to_email,
      errorMessage: h.error_message,
      scheduleId: h.schedule_id,
      scheduleName: h.schedule_name,
    })),
  });
});

// Get specific processing result
processingRoutes.get('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const processing = db.query(`
    SELECT
      ph.*,
      ds.name as schedule_name
    FROM processing_history ph
    LEFT JOIN digest_schedules ds ON ph.schedule_id = ds.id
    WHERE ph.id = ?
  `).get(id) as any;

  if (!processing) {
    return c.json({ error: 'Processing record not found' }, 404);
  }

  return c.json({
    id: processing.id,
    triggeredAt: processing.triggered_at,
    completedAt: processing.completed_at,
    status: processing.status,
    newsletterCount: processing.newsletter_count,
    newsletterIds: JSON.parse(processing.newsletter_ids || '[]'),
    summaryHtml: processing.summary_html,
    summaryText: processing.summary_text,
    sentToEmail: processing.sent_to_email,
    agentmailSentId: processing.agentmail_sent_id,
    errorMessage: processing.error_message,
    scheduleId: processing.schedule_id,
    scheduleName: processing.schedule_name,
  });
});
