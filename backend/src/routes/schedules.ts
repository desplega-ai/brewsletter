import { Hono } from 'hono';
import { getDb } from '../db';
import { CronExpressionParser } from 'cron-parser';
import { runScheduledDigest, type Schedule } from '../services/scheduler';

export const schedulesRoutes = new Hono();

// List all schedules
schedulesRoutes.get('/', (c) => {
  const db = getDb();
  const schedules = db.query('SELECT * FROM digest_schedules ORDER BY created_at DESC').all() as any[];

  return c.json({
    data: schedules.map(s => ({
      id: s.id,
      name: s.name,
      topics: JSON.parse(s.topics),
      schedule: s.schedule,
      deliveryEmail: s.delivery_email,
      summaryLength: s.summary_length,
      includeLinks: Boolean(s.include_links),
      customPrompt: s.custom_prompt || null,
      isActive: Boolean(s.is_active),
      lastRunAt: s.last_run_at,
      nextRunAt: s.next_run_at,
      createdAt: s.created_at,
    })),
  });
});

// Helper: Get common cron presets (must be before /:id)
schedulesRoutes.get('/presets', (c) => {
  return c.json({
    presets: [
      { name: 'Daily at 8am', cron: '0 8 * * *', description: 'Every day at 8:00 AM' },
      { name: 'Daily at 6pm', cron: '0 18 * * *', description: 'Every day at 6:00 PM' },
      { name: 'Weekdays at 8am', cron: '0 8 * * 1-5', description: 'Monday-Friday at 8:00 AM' },
      { name: 'Monday & Wednesday', cron: '0 8 * * 1,3', description: 'Mon & Wed at 8:00 AM' },
      { name: 'Monday & Friday', cron: '0 8 * * 1,5', description: 'Mon & Fri at 8:00 AM' },
      { name: 'Weekly on Monday', cron: '0 8 * * 1', description: 'Every Monday at 8:00 AM' },
      { name: 'Weekly on Sunday', cron: '0 10 * * 0', description: 'Every Sunday at 10:00 AM' },
    ],
  });
});

// Get defaults from user preferences (must be before /:id)
schedulesRoutes.get('/defaults', (c) => {
  const db = getDb();
  const prefs = db.query('SELECT * FROM preferences WHERE id = 1').get() as any;

  if (!prefs) {
    return c.json({
      deliveryEmail: '',
      summaryLength: 'medium',
      includeLinks: true,
      interests: [],
      customPrompt: null,
    });
  }

  return c.json({
    deliveryEmail: prefs.delivery_email,
    summaryLength: prefs.summary_length,
    includeLinks: Boolean(prefs.include_links),
    interests: prefs.interests ? JSON.parse(prefs.interests) : [],
    customPrompt: prefs.custom_prompt || null,
  });
});

// Get single schedule
schedulesRoutes.get('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const schedule = db.query('SELECT * FROM digest_schedules WHERE id = ?').get(id) as any;

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  return c.json({
    id: schedule.id,
    name: schedule.name,
    topics: JSON.parse(schedule.topics),
    schedule: schedule.schedule,
    deliveryEmail: schedule.delivery_email,
    summaryLength: schedule.summary_length,
    includeLinks: Boolean(schedule.include_links),
    customPrompt: schedule.custom_prompt || null,
    isActive: Boolean(schedule.is_active),
    lastRunAt: schedule.last_run_at,
    nextRunAt: schedule.next_run_at,
    createdAt: schedule.created_at,
  });
});

// Create schedule
schedulesRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { name, topics, schedule, deliveryEmail, summaryLength, includeLinks, customPrompt } = body;

  if (!name || !topics || !schedule || !deliveryEmail) {
    return c.json({ error: 'name, topics, schedule, and deliveryEmail are required' }, 400);
  }

  // Validate cron expression
  let nextRunAt: Date;
  try {
    const interval = CronExpressionParser.parse(schedule);
    nextRunAt = interval.next().toDate();
  } catch {
    return c.json({ error: 'Invalid cron expression' }, 400);
  }

  const db = getDb();
  const result = db.run(`
    INSERT INTO digest_schedules (name, topics, schedule, delivery_email, summary_length, include_links, custom_prompt, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    name,
    JSON.stringify(topics),
    schedule,
    deliveryEmail,
    summaryLength || 'medium',
    includeLinks !== false ? 1 : 0,
    customPrompt || null,
    nextRunAt.toISOString(),
  ]);

  return c.json({
    success: true,
    id: Number(result.lastInsertRowid),
    nextRunAt: nextRunAt.toISOString(),
    message: 'Schedule created',
  });
});

// Update schedule
schedulesRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { name, topics, schedule, deliveryEmail, summaryLength, includeLinks, customPrompt, isActive } = body;

  const db = getDb();
  const existing = db.query('SELECT id FROM digest_schedules WHERE id = ?').get(id);
  if (!existing) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  // Validate cron if provided
  let nextRunAt: Date | null = null;
  if (schedule) {
    try {
      const interval = CronExpressionParser.parse(schedule);
      nextRunAt = interval.next().toDate();
    } catch {
      return c.json({ error: 'Invalid cron expression' }, 400);
    }
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (topics !== undefined) { updates.push('topics = ?'); values.push(JSON.stringify(topics)); }
  if (schedule !== undefined) { updates.push('schedule = ?'); values.push(schedule); }
  if (deliveryEmail !== undefined) { updates.push('delivery_email = ?'); values.push(deliveryEmail); }
  if (summaryLength !== undefined) { updates.push('summary_length = ?'); values.push(summaryLength); }
  if (includeLinks !== undefined) { updates.push('include_links = ?'); values.push(includeLinks ? 1 : 0); }
  if (customPrompt !== undefined) { updates.push('custom_prompt = ?'); values.push(customPrompt || null); }
  if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
  if (nextRunAt) { updates.push('next_run_at = ?'); values.push(nextRunAt.toISOString()); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  values.push(id);
  db.run(`UPDATE digest_schedules SET ${updates.join(', ')} WHERE id = ?`, values);

  return c.json({ success: true, message: 'Schedule updated' });
});

// Trigger schedule manually (run now)
schedulesRoutes.post('/:id/trigger', async (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const schedule = db.query('SELECT * FROM digest_schedules WHERE id = ?').get(id) as Schedule | null;

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  try {
    const result = await runScheduledDigest(schedule);

    // Update last_run_at (but not next_run_at since this is manual)
    db.run(
      'UPDATE digest_schedules SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    return c.json({
      success: true,
      processingId: result.processingId,
      newsletterCount: result.newsletterCount,
      message: 'Schedule triggered successfully',
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to trigger schedule',
    }, 500);
  }
});

// Get processing history for a schedule
schedulesRoutes.get('/:id/history', (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '10');

  // Verify schedule exists
  const schedule = db.query('SELECT id, name FROM digest_schedules WHERE id = ?').get(id) as any;
  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  const history = db.query(`
    SELECT id, triggered_at, completed_at, status, newsletter_count, sent_to_email, error_message
    FROM processing_history
    WHERE schedule_id = ?
    ORDER BY triggered_at DESC
    LIMIT ?
  `).all(id, limit) as any[];

  return c.json({
    schedule: {
      id: schedule.id,
      name: schedule.name,
    },
    data: history.map(h => ({
      id: h.id,
      triggeredAt: h.triggered_at,
      completedAt: h.completed_at,
      status: h.status,
      newsletterCount: h.newsletter_count,
      sentToEmail: h.sent_to_email,
      errorMessage: h.error_message,
    })),
  });
});

// Delete schedule
schedulesRoutes.delete('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const result = db.run('DELETE FROM digest_schedules WHERE id = ?', [id]);

  if (result.changes === 0) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  return c.json({ success: true, message: 'Schedule deleted' });
});

