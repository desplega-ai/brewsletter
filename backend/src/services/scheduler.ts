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

const CHECK_INTERVAL = 60000; // Check every minute
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  console.log('Scheduler started');

  // Run immediately on start
  checkAndRunSchedules();

  // Then check every minute
  schedulerInterval = setInterval(checkAndRunSchedules, CHECK_INTERVAL);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler stopped');
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
          body.slice(0, 15000),
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
    topics,
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
