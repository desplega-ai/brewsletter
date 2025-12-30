export const schema = `
-- API keys for frontend auth
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
);

-- User preferences (single row enforced by CHECK constraint)
CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    delivery_email TEXT NOT NULL,
    interests TEXT DEFAULT '[]',
    format_preference TEXT DEFAULT 'digest',
    summary_length TEXT DEFAULT 'medium',
    include_links INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Received newsletters from AgentMail
CREATE TABLE IF NOT EXISTS newsletters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agentmail_id TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    from_name TEXT,
    subject TEXT NOT NULL,
    received_at DATETIME NOT NULL,
    raw_text TEXT,
    raw_html TEXT,
    extracted_content TEXT,
    topics TEXT,
    is_processed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Processing history for summaries
CREATE TABLE IF NOT EXISTS processing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT DEFAULT 'pending',
    newsletter_count INTEGER,
    newsletter_ids TEXT,
    summary_text TEXT,
    summary_html TEXT,
    sent_to_email TEXT,
    agentmail_sent_id TEXT,
    error_message TEXT
);

-- Digest schedules for automated summaries
CREATE TABLE IF NOT EXISTS digest_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    topics TEXT NOT NULL,                    -- JSON array of topics to include
    schedule TEXT NOT NULL,                  -- Cron expression (e.g., "0 8 * * 1,3" for Mon/Wed 8am)
    delivery_email TEXT NOT NULL,
    summary_length TEXT DEFAULT 'medium',
    include_links INTEGER DEFAULT 1,
    custom_prompt TEXT,                      -- Optional custom prompt to guide summarization
    is_active INTEGER DEFAULT 1,
    last_run_at DATETIME,
    next_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_newsletters_received_at ON newsletters(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletters_is_processed ON newsletters(is_processed);
CREATE INDEX IF NOT EXISTS idx_processing_history_status ON processing_history(status);
CREATE INDEX IF NOT EXISTS idx_digest_schedules_next_run ON digest_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_digest_schedules_active ON digest_schedules(is_active);
`;
