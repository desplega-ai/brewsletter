import { Database } from 'bun:sqlite';
import { schema } from './schema';

let db: Database;

export function getDb(): Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './brewsletter.db';
    db = new Database(dbPath, { create: true });
    db.exec('PRAGMA journal_mode = WAL');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  database.exec(schema);

  // Run migrations for existing databases
  runMigrations(database);

  console.log('Database initialized');
}

function runMigrations(database: Database): void {
  // Check if custom_prompt column exists in digest_schedules
  const schedulesInfo = database.query("PRAGMA table_info(digest_schedules)").all() as any[];
  const hasScheduleCustomPrompt = schedulesInfo.some(col => col.name === 'custom_prompt');

  if (!hasScheduleCustomPrompt) {
    console.log('Adding custom_prompt column to digest_schedules...');
    database.exec('ALTER TABLE digest_schedules ADD COLUMN custom_prompt TEXT');
  }

  // Check if schedule_id column exists in processing_history
  const processingInfo = database.query("PRAGMA table_info(processing_history)").all() as any[];
  const hasScheduleId = processingInfo.some(col => col.name === 'schedule_id');

  if (!hasScheduleId) {
    console.log('Adding schedule_id column to processing_history...');
    database.exec('ALTER TABLE processing_history ADD COLUMN schedule_id INTEGER REFERENCES digest_schedules(id)');
  }

  // Check if custom_prompt column exists in preferences
  const prefsInfo = database.query("PRAGMA table_info(preferences)").all() as any[];
  const hasPrefsCustomPrompt = prefsInfo.some(col => col.name === 'custom_prompt');

  if (!hasPrefsCustomPrompt) {
    console.log('Adding custom_prompt column to preferences...');
    database.exec('ALTER TABLE preferences ADD COLUMN custom_prompt TEXT');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
}

export { db };
