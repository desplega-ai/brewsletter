# Brewsletter

A self-hosted newsletter aggregator that collects your email newsletters, summarizes them using AI, and delivers personalized digests on your schedule.

## Features

- **Email Collection**: Receives newsletters via [AgentMail](https://agentmail.to) inbox
- **AI Summarization**: Uses Gemini Flash (via OpenRouter) to extract key insights
- **Scheduled Digests**: Configure multiple schedules for different topics
- **Customizable**: Set interests, summary length, and custom AI instructions
- **Self-Hosted**: Run on your own infrastructure with SQLite storage

## Architecture

```
├── backend/          # Bun + Hono API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic (scheduler, summarizer, agentmail)
│   │   └── db/       # SQLite schema and migrations
│   └── baml_src/     # BAML prompts for AI extraction
│
├── frontend/         # Next.js 15 dashboard
│   └── src/
│       ├── app/      # Pages (dashboard, schedules, history, preferences)
│       └── components/
│
└── docker-compose.yml
```

## Prerequisites

- [Bun](https://bun.sh) runtime
- [AgentMail](https://agentmail.to) account and API key
- [OpenRouter](https://openrouter.ai) API key (for Gemini Flash)

## Quick Start

### 1. Clone and install dependencies

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your API keys
bun install
bun run baml:generate

# Frontend
cd ../frontend
cp .env.example .env.local
# Edit .env.local if needed
pnpm install
```

### 2. Configure environment

**Backend** (`backend/.env`):
```env
PORT=5101
DATABASE_PATH=./brewsletter.db
AGENTMAIL_API_KEY=am_your_key
AGENTMAIL_INBOX_EMAIL=your-inbox@agentmail.to
OPENROUTER_API_KEY=sk-or-your_key
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5101
```

### 3. Run development servers

```bash
# Terminal 1 - Backend
cd backend
bun run dev

# Terminal 2 - Frontend
cd frontend
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Docker Deployment

```bash
# Create .env file in root with backend variables
docker-compose up -d
```

## Usage

1. **Connect**: Enter your backend URL and generate an API key
2. **Configure Preferences**: Set your delivery email, interests, and default AI instructions
3. **Create Schedules**: Set up automated digests for different topics (e.g., "AI Daily" at 8am)
4. **Forward Newsletters**: Subscribe to newsletters using your AgentMail inbox address
5. **Receive Digests**: Get summarized digests delivered to your email on schedule

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/generate-key` | POST | Generate API key |
| `/api/auth/validate` | GET | Validate API key |
| `/api/newsletters` | GET | List newsletters |
| `/api/newsletters/sync` | POST | Sync from AgentMail |
| `/api/preferences` | GET/PUT | User preferences |
| `/api/schedules` | GET/POST | Manage schedules |
| `/api/schedules/:id/trigger` | POST | Run schedule now |
| `/api/processing/generate` | POST | Generate digest |
| `/api/processing/history` | GET | Processing history |

## Tech Stack

**Backend**:
- [Bun](https://bun.sh) - JavaScript runtime
- [Hono](https://hono.dev) - Web framework
- [BAML](https://docs.boundaryml.com) - AI prompt engineering
- [AgentMail](https://agentmail.to) - Email infrastructure
- SQLite - Database

**Frontend**:
- [Next.js 15](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Sonner](https://sonner.emilkowal.ski) - Toast notifications

## License

MIT
