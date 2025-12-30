import { Hono } from 'hono';
import { getDb } from '../db';

export const preferencesRoutes = new Hono();

// Get preferences
preferencesRoutes.get('/', (c) => {
  const db = getDb();
  const prefs = db.query('SELECT * FROM preferences WHERE id = 1').get() as any;

  if (!prefs) {
    return c.json({
      exists: false,
      message: 'No preferences set. Please configure your preferences.',
    });
  }

  return c.json({
    exists: true,
    deliveryEmail: prefs.delivery_email,
    interests: JSON.parse(prefs.interests || '[]'),
    formatPreference: prefs.format_preference,
    summaryLength: prefs.summary_length,
    includeLinks: Boolean(prefs.include_links),
    customPrompt: prefs.custom_prompt || null,
    createdAt: prefs.created_at,
    updatedAt: prefs.updated_at,
  });
});

// Update preferences
preferencesRoutes.put('/', async (c) => {
  const body = await c.req.json();
  const db = getDb();

  const { deliveryEmail, interests, formatPreference, summaryLength, includeLinks, customPrompt } = body;

  if (!deliveryEmail) {
    return c.json({ error: 'deliveryEmail is required' }, 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(deliveryEmail)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  const interestsJson = JSON.stringify(interests || []);

  // Upsert preferences (single row with id=1)
  db.run(`
    INSERT INTO preferences (id, delivery_email, interests, format_preference, summary_length, include_links, custom_prompt, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      delivery_email = excluded.delivery_email,
      interests = excluded.interests,
      format_preference = excluded.format_preference,
      summary_length = excluded.summary_length,
      include_links = excluded.include_links,
      custom_prompt = excluded.custom_prompt,
      updated_at = CURRENT_TIMESTAMP
  `, [
    deliveryEmail,
    interestsJson,
    formatPreference || 'digest',
    summaryLength || 'medium',
    includeLinks !== false ? 1 : 0,
    customPrompt || null,
  ]);

  return c.json({
    success: true,
    message: 'Preferences updated',
  });
});
