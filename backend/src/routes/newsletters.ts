import { Hono } from 'hono';
import { getDb } from '../db';
import { fetchMessages, getMessage, type AgentMailMessage } from '../services/agentmail';

export const newsletterRoutes = new Hono();

// List newsletters with pagination
newsletterRoutes.get('/', (c) => {
  const db = getDb();
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const unprocessedOnly = c.req.query('unprocessed') === 'true';
  const offset = (page - 1) * limit;

  let whereClause = '';
  if (unprocessedOnly) {
    whereClause = 'WHERE is_processed = 0';
  }

  const countResult = db.query(`SELECT COUNT(*) as count FROM newsletters ${whereClause}`).get() as { count: number };
  const total = countResult.count;

  const newsletters = db.query(`
    SELECT id, agentmail_id, from_address, from_name, subject, received_at, topics, is_processed, created_at
    FROM newsletters
    ${whereClause}
    ORDER BY received_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];

  return c.json({
    data: newsletters.map(n => ({
      id: n.id,
      agentmailId: n.agentmail_id,
      fromAddress: n.from_address,
      fromName: n.from_name,
      subject: n.subject,
      receivedAt: n.received_at,
      topics: JSON.parse(n.topics || '[]'),
      isProcessed: Boolean(n.is_processed),
      createdAt: n.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Get single newsletter
newsletterRoutes.get('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const newsletter = db.query('SELECT * FROM newsletters WHERE id = ?').get(id) as any;

  if (!newsletter) {
    return c.json({ error: 'Newsletter not found' }, 404);
  }

  return c.json({
    id: newsletter.id,
    agentmailId: newsletter.agentmail_id,
    fromAddress: newsletter.from_address,
    fromName: newsletter.from_name,
    subject: newsletter.subject,
    receivedAt: newsletter.received_at,
    rawText: newsletter.raw_text,
    rawHtml: newsletter.raw_html,
    extractedContent: newsletter.extracted_content ? JSON.parse(newsletter.extracted_content) : null,
    topics: JSON.parse(newsletter.topics || '[]'),
    isProcessed: Boolean(newsletter.is_processed),
    createdAt: newsletter.created_at,
  });
});

// Sync newsletters from AgentMail
newsletterRoutes.post('/sync', async (c) => {
  const db = getDb();
  const body = await c.req.json().catch(() => ({}));
  const forceRefresh = body.force === true;

  try {
    let pageToken: string | undefined;
    let totalSynced = 0;
    let totalSkipped = 0;
    let totalUpdated = 0;

    do {
      const response = await fetchMessages(pageToken);

      for (const message of response.messages) {
        // Check if already exists
        const existing = db.query('SELECT id, raw_text FROM newsletters WHERE agentmail_id = ?').get(message.message_id) as any;

        if (existing && !forceRefresh) {
          totalSkipped++;
          continue;
        }

        // Fetch full message content (list only returns preview)
        let fullMessage: AgentMailMessage;
        try {
          fullMessage = await getMessage(message.message_id);
        } catch (err) {
          console.error(`Failed to fetch full message ${message.message_id}:`, err);
          fullMessage = message; // Fall back to list data
        }

        // Parse from address (format: "Name <email>" or just "email")
        const fromMatch = fullMessage.from.match(/^(.+?)\s*<(.+)>$/) || [null, null, fullMessage.from];
        const fromName = fromMatch[1]?.trim() || null;
        const fromAddress = fromMatch[2] || fullMessage.from;

        if (existing) {
          // Update existing newsletter with full content
          db.run(`
            UPDATE newsletters SET raw_text = ?, raw_html = ? WHERE id = ?
          `, [
            fullMessage.text || fullMessage.preview || null,
            fullMessage.html || null,
            existing.id,
          ]);
          totalUpdated++;
        } else {
          // Insert new newsletter
          db.run(`
            INSERT INTO newsletters (agentmail_id, from_address, from_name, subject, received_at, raw_text, raw_html)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            fullMessage.message_id,
            fromAddress,
            fromName,
            fullMessage.subject || '(No subject)',
            fullMessage.timestamp,
            fullMessage.text || fullMessage.preview || null,
            fullMessage.html || null,
          ]);
          totalSynced++;
        }
      }

      pageToken = response.next_page_token || undefined;
    } while (pageToken);

    return c.json({
      success: true,
      synced: totalSynced,
      updated: totalUpdated,
      skipped: totalSkipped,
      message: forceRefresh
        ? `Synced ${totalSynced} new, updated ${totalUpdated} existing newsletters`
        : `Synced ${totalSynced} new newsletters, skipped ${totalSkipped} existing`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return c.json({
      error: 'Failed to sync newsletters',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Delete newsletter
newsletterRoutes.delete('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const result = db.run('DELETE FROM newsletters WHERE id = ?', [id]);

  if (result.changes === 0) {
    return c.json({ error: 'Newsletter not found' }, 404);
  }

  return c.json({ success: true, message: 'Newsletter deleted' });
});
