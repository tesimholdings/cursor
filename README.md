# Acquisition Command Center

A simple full-stack workspace for buying lower-middle-market businesses (typically **$5–10 million** asking price, with support for smaller and larger deals).

The product is a five-step funnel, not a 400-field spreadsheet:

1. **Listing / teaser screen (pre-NDA)** — paste intel, upload one teaser, or
   upload a multi-company CSV/XLSX. The broker board preserves a 0–100 screen,
   one Good / Bad / Ugly bullet, and `INQUIRE + NDA | NEED MORE | PASS`.
2. **NDA + CIM**
3. **Financials / QoE packet**
4. **Full IC** — unlocked only by a readable financials/QoE document
5. **LOI / price / structure**

Every screen answers four things: what we know, what we don’t, why it matters, and what to do next.

Facts are labeled **Verified**, **Seller provided**, **Estimate**, **AI calculation**, **Assumption**, **Not provided**, **Conflict**, or **External research**. The app will not invent capacity or pick a number when listing and packet disagree.

Inside Step 1, the mandatory Owner Questions run before the normal listing
screen. The original pre-NDA score is preserved when later documents arrive.
The Full IC API and report are hard-locked until financial materials are
readable; teaser SDE never drives a Full IC, financing case, or maximum price.

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

## Publish a shareable preview

Run this from the repository root, on the branch you want to share:

```bash
npx vercel@latest deploy
```

On the first run it prompts you to log in (GitHub is fine) and to confirm the
project. It then prints the public preview URL. Add `--prod` instead if you want
a stable URL that does not change on every deploy.

To get preview URLs automatically on every push, add three repository secrets
under **Settings → Secrets and variables → Actions**: `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The included
`.github/workflows/preview.yml` stays green and skips deploying until all three
exist, then comments the preview URL on the open pull request.

Hosted notes:

- Serverless filesystems are read-only, so deal data is kept in memory and
  resets when the instance recycles. The dashboard shows a banner when storage
  is not durable. Set `ACC_DATA_DIR` to a writable, persistent path for durable
  storage.
- Search and AI synthesis stay off until their keys are set in the Vercel
  project's environment variables.

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
