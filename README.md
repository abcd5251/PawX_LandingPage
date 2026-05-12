# PawX 🐾

> **Follow PawX AI to Alpha** — Paw through social data to crypto insights.

PawX is a **Crypto Social Intelligence Platform** that turns the firehose of X (Twitter) activity into actionable, real-time signals for traders, researchers, and on-chain builders. This repository contains the marketing site and Credit Hub front-end for [pawx.ai](https://pawx.ai), plus the service layer that powers user accounts, credits, and payments.

- 🌐 **Website**: <https://pawx.ai>
- 📚 **API Docs / Backend**: <https://github.com/abcd5251/pawx_api>

---

## What is PawX?

PawX listens to the social layer of crypto 24/7 and surfaces the posts, accounts, keywords, and narratives that actually move markets — before they go mainstream.

### Core capabilities

| # | Feature | What it does |
|---|---------|--------------|
| 01 | **Tweet Performance** | Real-time engagement metrics that show which posts are actually moving markets. |
| 02 | **Advanced Tweet Filters** | Filter by token, contract, hashtag, sentiment, or engagement to surface signal fast. |
| 03 | **Curated KOL Dataset (~10K)** | KOL profiles with tags and audience-quality insights. |
| 04 | **Smart Filters** | Instant keyword and trending filters tuned to your watchlist. |
| 05 | **Keyword & Hashtag Insights** | Track rising narratives, keywords, and hashtag momentum early. |
| 06 | **Live Feed + AI Sniping Signals** | AI-powered live feed highlighting posts with trading or viral potential. |

### Product surfaces

- **REST API** — historical tweets, profiles, smart-follower graphs, and KOL metadata.
- **WebSocket Stream** — sub-second push of new tweets matching your filters.
- **Alert Bot** — push qualifying signals to Telegram / Discord / webhooks.
- **Credit Hub** — sign in with X, top up credits (USDC on EVM & Solana via KiraPay), track usage, and manage referrals.

---

## Tech stack

**Frontend**

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [Framer Motion](https://www.framer.com/motion/) for animations
- [React Router](https://reactrouter.com/) + [TanStack Query](https://tanstack.com/query)
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for forms & validation

**Services (`/services`)**

- Auth (X / Twitter OAuth), Turnstile, sessions
- Credit accounting, usage tracking, referrals
- Payments — KiraPay sessions & webhooks (USDC on EVM + Solana)
- Email, Telegram profiles, RapidAPI integration

**Testing & tooling**

- [Vitest](https://vitest.dev/) + Testing Library + jsdom
- ESLint 9 (typescript-eslint) + TypeScript strict mode

---

## Project structure

```
PawX_LandingPage/
├── src/
│   ├── components/        # UI components (Hero, Features, Pricing, Dashboard, …)
│   │   └── ui/            # shadcn/ui primitives
│   ├── pages/             # Route entries: Index, CreditHub, NotFound
│   ├── hooks/             # Reusable React hooks
│   ├── lib/               # Client utilities (auth helpers, etc.)
│   ├── assets/            # Static assets imported by components
│   └── test/              # Vitest setup & helpers
├── services/              # Server-side service modules
│   └── payments/          # KiraPay sessions, webhooks, helpers
├── public/                # Static files served as-is (favicon, robots.txt, …)
├── index.html             # Vite entry HTML
├── tailwind.config.ts
├── vite.config.ts
├── vitest.config.ts
└── vercel.json            # Vercel deployment config
```

---

## Quick start

### Prerequisites

- **Node.js** ≥ 18 (LTS recommended) — install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- A package manager: **npm**, **pnpm**, **yarn**, or **bun** (a `bun.lockb` is checked in)

### Install & run

```sh
# 1. Clone the repo
git clone https://github.com/<your-org>/PawX_LandingPage.git
cd PawX_LandingPage

# 2. Install dependencies
npm install
# or: bun install / pnpm install / yarn

# 3. Start the dev server (http://localhost:8080 by default)
npm run dev
```

That's it — the dev server hot-reloads on save.

### Available scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server with HMR. |
| `npm run build` | Production build → `dist/`. |
| `npm run build:dev` | Build in development mode (useful for debug deploys). |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint over the project. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |

---

## Environment variables

The landing page itself runs without any keys, but features that touch auth, payments, or the PawX API need configuration. Create a `.env.local` at the project root and set the values you need — Vite only exposes variables prefixed with `VITE_` to the browser.

```env
# Public (browser) — must start with VITE_
VITE_API_BASE_URL=https://api.pawx.ai
VITE_TURNSTILE_SITE_KEY=

# Server-side (services/) — never prefix with VITE_
X_CLIENT_ID=
X_CLIENT_SECRET=
KIRAPAY_API_KEY=
KIRAPAY_WEBHOOK_SECRET=
```

> ⚠️ Don't commit `.env.local`. Only `VITE_*` values reach the client — keep secrets unprefixed.

---

## Deployment

The project ships with `vercel.json` and deploys cleanly to **Vercel**:

```sh
npm run build      # outputs to dist/
# then push to your connected Vercel project,
# or run `vercel --prod` from the CLI.
```

Any static host that can serve a Vite SPA (Netlify, Cloudflare Pages, S3 + CloudFront) works too — point it at `dist/` and add an SPA fallback to `index.html`.

---

## Contributing

1. Fork & branch from `main`.
2. Run `npm run lint` and `npm run test` before pushing.
3. Open a PR with a short description of the change and screenshots for UI tweaks.

---

## License

Proprietary © PawX. All rights reserved unless stated otherwise.
