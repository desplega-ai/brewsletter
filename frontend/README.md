# Brewsletter - Frontend

Next.js dashboard for the Brewsletter newsletter aggregator.

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## Stack

- [Next.js 15](https://nextjs.org) - React framework
- [Tailwind CSS v4](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Radix UI](https://radix-ui.com) - Headless components
- [Sonner](https://sonner.emilkowal.ski) - Toast notifications

## Pages

- `/` - Dashboard with newsletter list and sync controls
- `/newsletter/[id]` - Newsletter detail with extracted content and preview
- `/schedules` - Manage automated digest schedules
- `/history` - View sent digest history
- `/preferences` - Configure delivery email, interests, and AI instructions
