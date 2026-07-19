<h3 align="center"> 慕乐の博客 </h3>

<div align="center">
  <a href="./README_CN.md"> 🇨🇳 简体中文</a>
  |
  <a href="https://iori-yimaga.site"> 👀 preview</a>
</div>

## 🎉 Introduction

A personal blog and portfolio built with Next.js, integrating technical article display, notes, photo album, and rich interactive features.

## 🌌 Features

-   **Content Management**: Blog posts, Notes, Projects, and Photo Album with MDX support.
-   **Interactive Comments**: Nested replies, markdown support, emoji reactions, and email notifications.
-   **Social Features**: Guestbook, Friends links, and "Talk" (micro-blogging).
-   **User System**: Authentication (GitHub/Google), Profile management, and Active sessions tracking.
-   **Admin Dashboard**: Comprehensive management for content, comments, users, and more.
-   **Performance & SEO**: SSR/ISR, Sitemap, RSS feed, and PWA support.
-   **Search**: Full-text search capability.

## ✨ Tech Stack

```mermaid
graph TD
    A[Frontend] --> B["Next.js 15 (App Router)"]
    A --> C["Tailwind CSS 4"]
    A --> D["TypeScript 5.7"]
    A --> E["React 19"]
    A --> F["Framer Motion"]

    G[Backend & Data] --> H["Drizzle ORM"]
    G --> I["oRPC (Type-safe RPC)"]
    H --> J["PostgreSQL"]
    I --> K["Redis (Upstash)"]
    G --> L["Better Auth"]

    M[Build & Tools] --> N["pnpm 10"]
    M --> O["Content Collections"]
    M --> P["Playwright & Vitest"]
    M --> Q["ESLint 9"]

    classDef framework fill:#2196F3,stroke:#1976D2;
    classDef service fill:#FFC107,stroke:#000;
    classDef build fill:#9C27B0,stroke:#7B1FA2;

    class A,D,E,M,N,P,Q service;
    class B,C,F,H,I,J,K,L,O build;
```

## 🚀 Quick Start

### Vercel One-Click Deployment

[![Deploy with Vercel](https://vercel.com/button)](<https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIori-yimaga%2Fmmblog&env=SITE_URL,SITE_AUTHOR>)

### Docker Compose Deployment

```bash
docker compose up -d
```

## 🖥️ Local Development

### Prerequisites

-   Node.js >= 22
-   pnpm >= 10
-   PostgreSQL
-   Redis

### Setup

```bash
# Install dependencies
pnpm i

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Database initialization
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start development server
pnpm dev
```

### Key Scripts

```bash
# Build production version
pnpm build

# Type checking
pnpm typecheck

# Code linting
pnpm lint

# Database management (Studio)
pnpm db:studio

# Run Unit Tests
pnpm test:unit

# Run E2E Tests
pnpm test:e2e
```

## ☕️ Buy me a coffee

<div align="center">
  <img src="./public//images/wechat-pay.png" alt="Admire" width="70%"/>
</div>
