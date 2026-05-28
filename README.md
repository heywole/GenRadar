# GenScout

The trust and intelligence layer for community-built GenLayer projects.

---

## Project Structure

```
genlayer-projects-hub/
├── app/
│   ├── layout.tsx                 Root layout (Navbar, ThemeProvider)
│   ├── page.tsx                   Homepage
│   ├── globals.css                Design tokens — light/dark CSS variables
│   ├── explore/page.tsx           Explore with search + filters
│   ├── project/[id]/page.tsx      Project detail + AI score panel
│   ├── submit/page.tsx            Submit form with logo upload
│   ├── resources/page.tsx         Resources hub
│   └── api/
│       ├── auth/callback/         Supabase OAuth callback
│       ├── projects/              GET projects with AI scores
│       ├── submit-project/        POST submit (auth + rate limit + AI)
│       └── interact/              POST save / report / view
│
├── components/
│   ├── Navbar.tsx                 Logo + nav + theme toggle + auth
│   ├── ProjectCard.tsx            Logo hero + gradient + score bar + risk badge
│   ├── ProjectCardSkeleton.tsx    Loading shimmer
│   ├── RiskBadge.tsx
│   └── ThemeProvider.tsx
│
├── contracts/
│   └── project_evaluator.py      GenLayer Intelligent Contract (on-chain AI)
│
├── lib/
│   ├── supabase.ts                Supabase client (browser + server)
│   ├── genlayerAI.ts              AI integration — server-only
│   ├── validation.ts              Zod schemas
│   └── rateLimit.ts               Rate limiter
│
├── scripts/
│   └── deploy-contract.js         Deploys GenLayer contract, auto-updates .env.local
│
├── supabase/
│   └── schema.sql                 Paste into Supabase SQL Editor — creates everything
│
├── types/index.ts
├── .env.example
└── README.md
```

---

## How AI Evaluation Works

```
User submits project (authenticated)
         ↓
/api/submit-project  (rate limit check → Zod validation)
         ↓
Insert project into Supabase (status: pending)
         ↓
lib/genlayerAI.ts → genlayer-js SDK
         ↓
GenLayer Testnet — writeContract('evaluate_project')
  ├─ Validator 1 (GPT-4o)
  ├─ Validator 2 (Claude Sonnet)   ← each runs project_evaluator.py
  ├─ Validator 3 (Llama 3)
  └─ Optimistic Democracy → consensus
         ↓
waitForTransactionReceipt (polls for agreement)
         ↓
readContract('get_evaluation') → { score, risk, confidence, positives, risks }
         ↓
Skepticism penalties applied (missing GitHub, short description, etc.)
         ↓
Saved to Supabase ai_scores table
         ↓
Project status → active → visible in hub
```

**The frontend never calls AI directly. All evaluation is server-side only.**

---

## Design Tokens

| Token         | Light     | Dark      |
|---------------|-----------|-----------|
| Background    | `#F8FAFC` | `#0D1117` |
| Card          | `#FFFFFF` | `#111827` |
| Border        | `#E5E7EB` | `#1F2937` |
| Text Primary  | `#0F172A` | `#F9FAFB` |
| Text Secondary| `#6B7280` | `#9CA3AF` |
| Low Risk      | `#22C55E` | `#22C55E` |
| Medium Risk   | `#F59E0B` | `#F59E0B` |
| High Risk     | `#EF4444` | `#EF4444` |
| Primary Blue  | `#3B82F6` | `#3B82F6` |
