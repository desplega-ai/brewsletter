import type { Context, Next } from 'hono';
import { getDb } from '../db';

export async function authMiddleware(c: Context, next: Next) {
  // Skip auth for generate-key endpoint
  if (c.req.path === '/api/auth/generate-key' && c.req.method === 'POST') {
    return next();
  }

  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    return c.json({ error: 'API key required' }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const db = getDb();

  const result = db.query('SELECT id FROM api_keys WHERE key_hash = ?').get(keyHash);

  if (!result) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // Update last used timestamp
  db.run('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE key_hash = ?', [keyHash]);

  return next();
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `yn_${key}`;
}
