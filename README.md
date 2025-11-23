This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Architecture Overview

This project is a collaborative forum powered by LLMs. It uses a graph of nodes where each node represents a conversation thread.

### Core Components

- **Message Queue**: Handles incoming user messages (`services/queue.ts`). Currently an in-memory implementation, designed to be replaced by AWS SQS.
- **Adjudication Engine**: Evaluates messages for relevance and staleness against the current node state (`services/adjudication.ts`).
- **Core Engine**: Manages conversation threads (Nodes) and LLM interactions (`services/core.ts`).
- **Vector Store**: Interface for similarity search of topics (`services/vectorStore.ts`).
- **Database**: PostgreSQL via Prisma (`prisma/schema.prisma`).

### API Routes

- \`POST /api/message\`: Receives a user message and queues it for adjudication.

### Setup

1. Configure your database URL in \`.env\`.
2. Run \`npx prisma generate\` to generate the client.
3. Run \`npx prisma db push\` to sync the schema.
