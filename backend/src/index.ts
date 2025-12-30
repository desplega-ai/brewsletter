import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDb, closeDb } from './db';
import { authRoutes } from './routes/auth';
import { newsletterRoutes } from './routes/newsletters';
import { preferencesRoutes } from './routes/preferences';
import { processingRoutes } from './routes/processing';
import { schedulesRoutes } from './routes/schedules';
import { authMiddleware } from './middleware/auth';
import { startScheduler, stopScheduler } from './services/scheduler';

const app = new Hono();

// Initialize database
initDb();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-API-Key'],
}));

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Auth routes (generate key doesn't need auth)
app.route('/api/auth', authRoutes);

// Protected routes
app.use('/api/*', authMiddleware);
app.route('/api/newsletters', newsletterRoutes);
app.route('/api/preferences', preferencesRoutes);
app.route('/api/processing', processingRoutes);
app.route('/api/schedules', schedulesRoutes);

const port = parseInt(process.env.PORT || '5101');

console.log(`Starting Your-News backend on port ${port}...`);

// Start the background scheduler
startScheduler();

// Graceful shutdown handler
const shutdown = () => {
  console.log('Shutting down gracefully...');
  stopScheduler();
  closeDb();
  console.log('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default {
  port,
  fetch: app.fetch,
};
