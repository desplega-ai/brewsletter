import { b } from '../../baml_client';
import { getDb } from '../db';

interface Newsletter {
  id: number;
  from_address: string;
  from_name: string | null;
  subject: string;
  raw_text: string | null;
  raw_html: string | null;
  extracted_content: string | null;
}

// Process newsletters: extract topics only, no email sending
export async function processNewsletters(newsletterIds?: number[], forceAll?: boolean, forceReprocess?: boolean): Promise<{
  processingId: number;
  newsletterCount: number;
}> {
  const db = getDb();

  // Get newsletters to process
  let newsletters: Newsletter[];
  if (newsletterIds && newsletterIds.length > 0) {
    const placeholders = newsletterIds.map(() => '?').join(',');
    newsletters = db.query(
      `SELECT id, from_address, from_name, subject, raw_text, raw_html, extracted_content
       FROM newsletters WHERE id IN (${placeholders})`
    ).all(...newsletterIds) as Newsletter[];
  } else if (forceAll) {
    // Get all newsletters regardless of processed status
    newsletters = db.query(
      `SELECT id, from_address, from_name, subject, raw_text, raw_html, extracted_content
       FROM newsletters ORDER BY received_at DESC`
    ).all() as Newsletter[];
  } else {
    newsletters = db.query(
      `SELECT id, from_address, from_name, subject, raw_text, raw_html, extracted_content
       FROM newsletters WHERE is_processed = 0`
    ).all() as Newsletter[];
  }

  if (newsletters.length === 0) {
    throw new Error('No newsletters to process');
  }

  // Create processing record
  const result = db.run(
    `INSERT INTO processing_history (status, newsletter_count, newsletter_ids)
     VALUES ('processing', ?, ?)`,
    [newsletters.length, JSON.stringify(newsletters.map(n => n.id))]
  );
  const processingId = Number(result.lastInsertRowid);

  // Process in background
  processInBackground(processingId, newsletters, forceReprocess).catch(err => {
    console.error('Background processing error:', err);
    db.run(
      `UPDATE processing_history SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [err.message, processingId]
    );
  });

  return { processingId, newsletterCount: newsletters.length };
}

async function processInBackground(
  processingId: number,
  newsletters: Newsletter[],
  forceReprocess?: boolean
): Promise<void> {
  const db = getDb();

  try {
    let processedCount = 0;

    for (const newsletter of newsletters) {
      // Skip if already has extracted content (unless force reprocessing)
      if (newsletter.extracted_content && !forceReprocess) {
        processedCount++;
        continue;
      }

      const body = newsletter.raw_text || stripHtml(newsletter.raw_html || '');

      if (!body || body.length < 50) {
        console.log(`Skipping newsletter ${newsletter.id}: insufficient content`);
        continue;
      }

      try {
        const content = await b.ExtractNewsletter(
          newsletter.subject,
          body.slice(0, 100_000),
          newsletter.from_address
        );

        // Store extracted content and topics
        db.run(
          `UPDATE newsletters SET extracted_content = ?, topics = ?, is_processed = 1 WHERE id = ?`,
          [JSON.stringify(content), JSON.stringify(content.topics), newsletter.id]
        );

        console.log(`Extracted topics for newsletter ${newsletter.id}: ${content.topics.join(', ')}`);
        processedCount++;
      } catch (error) {
        console.error(`Failed to extract newsletter ${newsletter.id}:`, error);
      }
    }

    // Update processing record (no email sent, just extraction)
    db.run(
      `UPDATE processing_history
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [processingId]
    );

    console.log(`Processing complete: ${processedCount}/${newsletters.length} newsletters extracted`);

  } catch (error) {
    throw error;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getProcessingStatus(processingId?: number): Promise<any> {
  const db = getDb();

  if (processingId) {
    return db.query('SELECT * FROM processing_history WHERE id = ?').get(processingId);
  }

  // Get most recent processing
  return db.query('SELECT * FROM processing_history ORDER BY triggered_at DESC LIMIT 1').get();
}
