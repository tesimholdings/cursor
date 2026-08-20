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

Step 1A uses supplied listing/company URLs and, when configured, Tavily public
search. Search results are persisted with their real URLs and excerpts. AI
synthesis can only cite IDs from that fetched source set; unknown or invented
source IDs are discarded.

Packet and diligence uploads read PDF, XLS/XLSX, CSV, and text files. PDF
evidence retains page numbers; workbook evidence retains sheet names and cell
ranges. Scanned PDFs fail explicitly because OCR is not configured.

The final IC call is exactly one of **STRONG BUY**, **BUY SUBJECT TO
CONDITIONS**, **CONTINUE DILIGENCE**, **RENEGOTIATE**, or **PASS**. The scoring
weights are Financial 20, Customer 15, Operations 15, Growth 15,
Asset/downside 10, Deal structure 10, Tax 10, and Legal/environmental 5.
Fatal risks override the total. Seller-recast SDE/EBITDA is never treated as
verified, and tax benefits cannot rescue weak economics.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

A sample pipeline (including Mighty Molding) loads on first run.

Copy `.env.example` to `.env.local` as needed:

```
OPENAI_API_KEY=...
# or
AI_GATEWAY_API_KEY=...
TAVILY_API_KEY=...
```

- `TAVILY_API_KEY` enables public search. Without it, only explicitly supplied
  public listing/company URLs are fetched.
- `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` enables source-bounded synthesis.
  Without it, fetched excerpts and citations remain visible but are not
  converted into new narrative claims.
- Without either key, the funnel still runs and returns honest unanswered
  fields.

```bash
npm test
npx tsc --noEmit
npm run build
```

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, file-backed JSON store in `data/store.json`.
