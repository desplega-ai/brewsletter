import { getDb } from '../db';
import { CronExpressionParser } from 'cron-parser';
import { b } from '../../baml_client';
import { sendEmail } from './agentmail';

export interface Schedule {
  id: number;
  name: string;
  topics: string;
  schedule: string;
  delivery_email: string;
  summary_length: string;
  include_links: number;
  custom_prompt: string | null;
  is_active: number;
  last_run_at: string | null;
  next_run_at: string;
}

interface Newsletter {
  id: number;
  from_address: string;
  from_name: string | null;
  subject: string;
  raw_text: string | null;
  raw_html: string | null;
  extracted_content: string | null;
  topics: string | null;
}

import { fetchMessages, getMessage, type AgentMailMessage } from './agentmail';
import { processNewsletters } from './summarizer';

const CHECK_INTERVAL = 60000; // Check schedules every minute
const SYNC_INTERVAL = 60 * 60 * 1000; // Sync newsletters every hour

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  console.log('Scheduler started');

  // Run immediately on start
  checkAndRunSchedules();

  // Then check every minute
  schedulerInterval = setInterval(checkAndRunSchedules, CHECK_INTERVAL);

  // Auto-sync newsletters every hour
  syncInterval = setInterval(autoSyncAndProcess, SYNC_INTERVAL);

  // Also run initial sync after 10 seconds (give server time to start)
  setTimeout(autoSyncAndProcess, 10000);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('Scheduler stopped');
}

// Auto-sync newsletters from AgentMail and extract topics
async function autoSyncAndProcess(): Promise<void> {
  console.log('Starting auto-sync...');

  try {
    const db = getDb();
    const inboxEmail = process.env.AGENTMAIL_INBOX_EMAIL || 'news@agentmail.to';
    let pageToken: string | undefined;
    let totalSynced = 0;

    do {
      const response = await fetchMessages(pageToken);

      for (const message of response.messages) {
        // Skip emails sent by the inbox (outgoing emails)
        if (message.from.includes(inboxEmail)) {
          continue;
        }

        // Check if already exists
        const existing = db.query('SELECT id FROM newsletters WHERE agentmail_id = ?').get(message.message_id);

        if (existing) {
          continue; // Already synced
        }

        // Fetch full message content
        let fullMessage: AgentMailMessage;
        try {
          fullMessage = await getMessage(message.message_id);
        } catch (err) {
          console.error(`Failed to fetch message ${message.message_id}:`, err);
          fullMessage = message;
        }

        // Helper to safely convert values for SQLite
        const toSql = (val: unknown): string | number | null => {
          if (val === undefined || val === null) return null;
          if (typeof val === 'string') return val;
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 1 : 0;
          if (val instanceof Date) return val.toISOString();
          return String(val);
        };

        // Parse from address
        const fromMatch = fullMessage.from?.match(/^(.+?)\s*<(.+)>$/) || [null, null, fullMessage.from];
        const fromName = fromMatch[1]?.trim() ?? null;
        const fromAddress = fromMatch[2] ?? fullMessage.from ?? 'unknown';

        const timestamp = typeof fullMessage.timestamp === 'string'
          ? fullMessage.timestamp
          : fullMessage.timestamp instanceof Date
            ? fullMessage.timestamp.toISOString()
            : new Date().toISOString();

        try {
          db.run(`
            INSERT INTO newsletters (agentmail_id, from_address, from_name, subject, received_at, raw_text, raw_html)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            toSql(fullMessage.message_id),
            toSql(fromAddress),
            toSql(fromName),
            toSql(fullMessage.subject) || '(No subject)',
            toSql(timestamp),
            toSql(fullMessage.text || fullMessage.preview),
            toSql(fullMessage.html),
          ]);
          totalSynced++;
        } catch (err) {
          console.error(`Failed to insert newsletter ${message.message_id}:`, err);
        }
      }

      pageToken = response.next_page_token || undefined;
    } while (pageToken);

    console.log(`Auto-sync complete: ${totalSynced} new newsletters`);

    // Now auto-process any unprocessed newsletters
    if (totalSynced > 0) {
      const unprocessed = db.query('SELECT COUNT(*) as count FROM newsletters WHERE is_processed = 0').get() as { count: number };
      if (unprocessed.count > 0) {
        console.log(`Auto-processing ${unprocessed.count} unprocessed newsletters...`);
        try {
          await processNewsletters();
        } catch (err) {
          // Ignore "no newsletters to process" error
          if (!(err instanceof Error && err.message.includes('No newsletters'))) {
            console.error('Auto-process error:', err);
          }
        }
      }
    }

  } catch (error) {
    console.error('Auto-sync error:', error);
  }
}

async function checkAndRunSchedules(): Promise<void> {
  const db = getDb();
  const now = new Date();

  // Find schedules that are due
  const dueSchedules = db.query(`
    SELECT * FROM digest_schedules
    WHERE is_active = 1 AND next_run_at <= ?
  `).all(now.toISOString()) as Schedule[];

  for (const schedule of dueSchedules) {
    try {
      console.log(`Running scheduled digest: ${schedule.name}`);
      await runScheduledDigest(schedule);

      // Update last_run_at and calculate next_run_at
      const interval = CronExpressionParser.parse(schedule.schedule);
      const nextRun = interval.next().toDate();

      db.run(`
        UPDATE digest_schedules
        SET last_run_at = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [now.toISOString(), nextRun.toISOString(), schedule.id]);

      console.log(`Scheduled digest "${schedule.name}" completed. Next run: ${nextRun.toISOString()}`);
    } catch (error) {
      console.error(`Failed to run scheduled digest "${schedule.name}":`, error);
    }
  }
}

export async function runScheduledDigest(schedule: Schedule): Promise<{ processingId: number; newsletterCount: number }> {
  const db = getDb();
  const scheduleTopics = JSON.parse(schedule.topics) as string[];

  // Find newsletters from the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const newsletters = db.query(`
    SELECT id, from_address, from_name, subject, raw_text, raw_html, extracted_content, topics
    FROM newsletters
    WHERE received_at >= ?
    ORDER BY received_at DESC
  `).all(sevenDaysAgo) as Newsletter[];

  if (newsletters.length === 0) {
    console.log(`No newsletters in the last 7 days for "${schedule.name}"`);
    throw new Error(`No newsletters in the last 7 days`);
  }

  // First, extract content/topics for any newsletters that don't have them yet
  const extractedNewsletters = [];

  for (const newsletter of newsletters) {
    let content = newsletter.extracted_content
      ? JSON.parse(newsletter.extracted_content)
      : null;

    // Extract if not already done
    if (!content) {
      const body = newsletter.raw_text || stripHtml(newsletter.raw_html || '');

      if (!body || body.length < 50) {
        console.log(`Skipping newsletter ${newsletter.id}: no content`);
        continue;
      }

      try {
        content = await b.ExtractNewsletter(
          newsletter.subject,
          body.slice(0, 250_000),
          newsletter.from_address
        );

        // Store extracted content and topics
        db.run(
          `UPDATE newsletters SET extracted_content = ?, topics = ? WHERE id = ?`,
          [JSON.stringify(content), JSON.stringify(content.topics), newsletter.id]
        );
        console.log(`Extracted topics for newsletter ${newsletter.id}: ${content.topics.join(', ')}`);
      } catch (error) {
        console.error(`Failed to extract newsletter ${newsletter.id}:`, error);
        continue;
      }
    }

    // Now check if this newsletter matches the schedule's topics
    const newsletterTopics = content.topics || [];
    const matches = scheduleTopics.some(scheduleTopic =>
      newsletterTopics.some((nt: string) =>
        nt.toLowerCase().includes(scheduleTopic.toLowerCase()) ||
        scheduleTopic.toLowerCase().includes(nt.toLowerCase())
      )
    );

    if (matches) {
      extractedNewsletters.push({
        id: newsletter.id,
        ...content,
      });
    }
  }

  if (extractedNewsletters.length === 0) {
    console.log(`No newsletters matching topics [${scheduleTopics.join(', ')}] for "${schedule.name}"`);
    throw new Error(`No newsletters matching topics: ${scheduleTopics.join(', ')}. Try broader topics or wait for more newsletters.`);
  }

  // Generate digest
  const digest = await b.GenerateDigest(
    JSON.stringify(extractedNewsletters),
    scheduleTopics,
    schedule.summary_length,
    Boolean(schedule.include_links),
    schedule.custom_prompt || undefined
  );

  // Format and send email
  const html = formatDigestHtml(digest, schedule.name);
  const text = formatDigestText(digest, schedule.name);

  await sendEmail(
    schedule.delivery_email,
    `${schedule.name} - ${digest.periodCovered}`,
    html,
    text
  );

  // Record in processing history
  const result = db.run(`
    INSERT INTO processing_history (status, newsletter_count, newsletter_ids, summary_html, summary_text, sent_to_email, completed_at, schedule_id)
    VALUES ('completed', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `, [
    extractedNewsletters.length,
    JSON.stringify(extractedNewsletters.map(n => n.id)),
    html,
    text,
    schedule.delivery_email,
    schedule.id,
  ]);

  return {
    processingId: Number(result.lastInsertRowid),
    newsletterCount: extractedNewsletters.length,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDigestHtml(digest: any, scheduleName: string): string {
  return `
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
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <h1>${scheduleName}</h1>
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
}

function formatDigestText(digest: any, scheduleName: string): string {
  let text = `${scheduleName.toUpperCase()}\n`;
  text += `${digest.periodCovered}\n\n`;
  text += `HIGHLIGHTS\n`;
  text += `${'='.repeat(40)}\n`;
  digest.highlights.forEach((h: string) => {
    text += `- ${h}\n`;
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
        text += `  - ${l.title}: ${l.url || 'N/A'}\n`;
      });
    }
    text += `\n`;
  });

  text += `\n${digest.closingNote}\n`;
  text += `\n---\nGenerated by Your-News\n`;

  return text;
}
