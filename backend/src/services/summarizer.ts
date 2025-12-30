import { b } from '../../baml_client';
import { getDb } from '../db';
import { sendEmail } from './agentmail';

interface Newsletter {
  id: number;
  from_address: string;
  from_name: string | null;
  subject: string;
  raw_text: string | null;
  raw_html: string | null;
  extracted_content: string | null;
}

interface Preferences {
  delivery_email: string;
  interests: string;
  format_preference: string;
  summary_length: string;
  include_links: number;
}

export async function processNewsletters(newsletterIds?: number[], forceAll?: boolean): Promise<{
  processingId: number;
  newsletterCount: number;
}> {
  const db = getDb();

  // Get preferences
  const prefs = db.query('SELECT * FROM preferences WHERE id = 1').get() as Preferences | null;

  if (!prefs) {
    throw new Error('Preferences not set. Please configure your delivery email first.');
  }

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
  processInBackground(processingId, newsletters, prefs).catch(err => {
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
  prefs: Preferences
): Promise<void> {
  const db = getDb();

  try {
    // Step 1: Extract content from newsletters that haven't been extracted yet
    const extractedNewsletters = [];

    for (const newsletter of newsletters) {
      let content = newsletter.extracted_content
        ? JSON.parse(newsletter.extracted_content)
        : null;

      if (!content) {
        const body = newsletter.raw_text || stripHtml(newsletter.raw_html || '');

        content = await b.ExtractNewsletter(
          newsletter.subject,
          body.slice(0, 15000), // Limit body size
          newsletter.from_address
        );

        // Store extracted content
        db.run(
          `UPDATE newsletters SET extracted_content = ?, topics = ? WHERE id = ?`,
          [JSON.stringify(content), JSON.stringify(content.topics), newsletter.id]
        );
      }

      extractedNewsletters.push({
        id: newsletter.id,
        ...content,
      });
    }

    // Step 2: Generate digest summary
    const interests = JSON.parse(prefs.interests || '[]');
    const digest = await b.GenerateDigest(
      JSON.stringify(extractedNewsletters),
      interests,
      prefs.summary_length,
      Boolean(prefs.include_links),
      undefined // custom_prompt not supported for on-demand processing
    );

    // Step 3: Format as HTML email
    const html = formatDigestHtml(digest);
    const text = formatDigestText(digest);

    // Step 4: Send email via AgentMail
    const sentResult = await sendEmail(
      prefs.delivery_email,
      `Brewsletter Digest - ${digest.periodCovered}`,
      html,
      text
    );

    // Step 5: Update processing record
    db.run(
      `UPDATE processing_history
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
           summary_html = ?, summary_text = ?, sent_to_email = ?, agentmail_sent_id = ?
       WHERE id = ?`,
      [html, text, prefs.delivery_email, sentResult.message_id, processingId]
    );

    // Mark newsletters as processed
    const newsletterIds = newsletters.map(n => n.id);
    const placeholders = newsletterIds.map(() => '?').join(',');
    db.run(`UPDATE newsletters SET is_processed = 1 WHERE id IN (${placeholders})`, ...newsletterIds);

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

function formatDigestHtml(digest: any): string {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h2 { color: #444; margin-top: 30px; }
    .highlight { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .newsletter { border-left: 3px solid #007bff; padding-left: 15px; margin: 20px 0; }
    .source { font-weight: bold; color: #007bff; }
    .link { color: #007bff; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <h1>Brewsletter Digest</h1>
  <p><em>${digest.periodCovered}</em></p>

  <div class="highlight">
    <h2>Highlights</h2>
    <ul>
      ${digest.highlights.map((h: string) => `<li>${h}</li>`).join('\n      ')}
    </ul>
  </div>

  <h2>Newsletter Summaries</h2>
  ${digest.newsletters.map((n: any) => `
  <div class="newsletter">
    <p class="source">${n.source}</p>
    <h3>${n.headline}</h3>
    <p>${n.summary}</p>
    ${n.topLinks && n.topLinks.length > 0 ? `
    <p><strong>Links:</strong></p>
    <ul>
      ${n.topLinks.map((l: any) => `<li><a class="link" href="${l.url || '#'}">${l.title}</a></li>`).join('\n      ')}
    </ul>
    ` : ''}
  </div>
  `).join('\n')}

  <div class="footer">
    <p>${digest.closingNote}</p>
    <p><em>Generated by Your-News</em></p>
  </div>
</body>
</html>`;

  return html;
}

function formatDigestText(digest: any): string {
  let text = `YOUR NEWSLETTER DIGEST\n`;
  text += `${digest.periodCovered}\n\n`;
  text += `HIGHLIGHTS\n`;
  text += `${'='.repeat(40)}\n`;
  digest.highlights.forEach((h: string) => {
    text += `• ${h}\n`;
  });
  text += `\n`;

  text += `NEWSLETTER SUMMARIES\n`;
  text += `${'='.repeat(40)}\n\n`;

  digest.newsletters.forEach((n: any) => {
    text += `[${n.source}]\n`;
    text += `${n.headline}\n`;
    text += `-`.repeat(30) + `\n`;
    text += `${n.summary}\n`;
    if (n.topLinks && n.topLinks.length > 0) {
      text += `\nLinks:\n`;
      n.topLinks.forEach((l: any) => {
        text += `  • ${l.title}: ${l.url || 'N/A'}\n`;
      });
    }
    text += `\n`;
  });

  text += `\n${digest.closingNote}\n`;
  text += `\n---\nGenerated by Your-News\n`;

  return text;
}

export async function getProcessingStatus(processingId?: number): Promise<any> {
  const db = getDb();

  if (processingId) {
    return db.query('SELECT * FROM processing_history WHERE id = ?').get(processingId);
  }

  // Get most recent processing
  return db.query('SELECT * FROM processing_history ORDER BY triggered_at DESC LIMIT 1').get();
}
