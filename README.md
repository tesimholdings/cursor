# Acquisition Command Center

A simple full-stack workspace for buying lower-middle-market businesses (typically **$5–10 million** asking price, with support for smaller and larger deals).

The product is a funnel, not a 400-field spreadsheet:

1. **Upload a list** (CSV / Excel)
2. **Step 1A — Owner Questions** — the investor's 40 mandatory questions run first
3. **Step 1B** — normal listing/public-financial screen
4. **Stage 2** — Is the information packet good enough for an LOI?
5. **Stage 3** — Diligence, financing, tax sketch, downside cases
6. **Buy, continue, renegotiate, or pass**

Every screen answers four things: what we know, what we don’t, why it matters, and what to do next.

Facts are labeled **Verified**, **Seller provided**, **Estimate**, **AI calculation**, **Assumption**, **Not provided**, **Conflict**, or **External research**. The app will not invent capacity or pick a number when listing and packet disagree.

Step 1B is guarded in code: it cannot run until Step 1A has persisted all 40
Owner Questions. The UI groups them into seven small expandable sections rather
than dumping 40 answers onto one screen.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

A sample pipeline (including Mighty Molding) loads on first run.

Optional AI enrichment for Stage 1 narratives:

```
OPENAI_API_KEY=...
# or
AI_GATEWAY_API_KEY=...
```

Without a key, screening still runs using listing numbers plus industry knowledge, and labels unknowns honestly.

```bash
npm test
npm run build
```

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, file-backed JSON store in `data/store.json`.
