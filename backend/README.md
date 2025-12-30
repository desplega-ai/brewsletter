# Brewsletter - Backend

Bun + Hono API server for the Brewsletter newsletter aggregator.

## Setup

```bash
# Install dependencies
bun install

# Generate BAML client
bun run baml:generate

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Start development server
bun run dev
```

The server runs on [http://localhost:5101](http://localhost:5101) by default.

## Stack

- [Bun](https://bun.sh) - JavaScript runtime
- [Hono](https://hono.dev) - Web framework
- [BAML](https://docs.boundaryml.com) - AI prompt engineering
- [AgentMail](https://agentmail.to) - Email infrastructure
- SQLite - Database (via Bun's built-in driver)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5101) |
| `DATABASE_PATH` | SQLite database path |
| `AGENTMAIL_API_KEY` | AgentMail API key |
| `AGENTMAIL_INBOX_EMAIL` | Email address for receiving newsletters |
| `OPENROUTER_API_KEY` | OpenRouter API key for Gemini Flash |

## API Routes

- `/api/auth/*` - Authentication (API key generation/validation)
- `/api/newsletters/*` - Newsletter management
- `/api/preferences` - User preferences
- `/api/schedules/*` - Digest schedules
- `/api/processing/*` - Digest generation and history
