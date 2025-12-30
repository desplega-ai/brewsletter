import { Hono } from 'hono';
import { getDb } from '../db';
import { generateApiKey, hashApiKey } from '../middleware/auth';

export const authRoutes = new Hono();

// Generate new API key (no auth required for first setup)
authRoutes.post('/generate-key', async (c) => {
  const db = getDb();

  // Check if any API keys exist
  const existingKeys = db.query('SELECT COUNT(*) as count FROM api_keys').get() as { count: number };

  if (existingKeys.count > 0) {
    // Require existing API key to generate new ones
    const apiKey = c.req.header('X-API-Key');
    if (!apiKey) {
      return c.json({ error: 'API key required to generate additional keys' }, 401);
    }

    const keyHash = await hashApiKey(apiKey);
    const valid = db.query('SELECT id FROM api_keys WHERE key_hash = ?').get(keyHash);
    if (!valid) {
      return c.json({ error: 'Invalid API key' }, 401);
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const name = body.name || 'Default';

  const newKey = generateApiKey();
  const keyHash = await hashApiKey(newKey);

  db.run('INSERT INTO api_keys (key_hash, name) VALUES (?, ?)', [keyHash, name]);

  return c.json({
    apiKey: newKey,
    message: 'Store this key securely. It will not be shown again.',
  });
});

// Validate API key
authRoutes.get('/validate', async (c) => {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json({ valid: false, error: 'No API key provided' }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const db = getDb();

  const result = db.query('SELECT id, name, created_at, last_used_at FROM api_keys WHERE key_hash = ?').get(keyHash) as any;

  if (!result) {
    return c.json({ valid: false, error: 'Invalid API key' }, 401);
  }

  return c.json({
    valid: true,
    name: result.name,
    createdAt: result.created_at,
    lastUsedAt: result.last_used_at,
  });
});
