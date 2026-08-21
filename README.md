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

The broker board also stores and searches compact scan tags on every deal:
business category, operating style, risk snapshot, asset profile, TESIM box fit,
and earnings quality. Missing evidence produces `Unknown` or `Unverified`, never
an optimistic guess. Seed records are marked `Seed / Demo`.

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

- Deal data uses a single private Vercel Blob object with ETag compare-and-swap
  so every serverless instance sees the same store without lost updates.
- Create and connect the store once from a Vercel-authenticated terminal:

  ```bash
  npx vercel@latest blob create-store acquisition-command-center-data \
    --access private --region iad1 --yes \
    --environment preview --environment production \
    --project acquisition-command-center --scope tesim-holdings
  ```

- A connected OIDC store injects `BLOB_STORE_ID`, but **not**
  `VERCEL_OIDC_TOKEN`: the SDK reads the token from the per-request
  `x-vercel-oidc-token` header and only falls back to the environment variable.
  So on Vercel a store id is sufficient, and no static token is required.
  Outside Vercel, use `vercel env pull` or `BLOB_READ_WRITE_TOKEN`.
- `GET /api/deals` reports `persistence.credential`, which asks the SDK for an
  actual credential rather than guessing from environment variables.
- With no store connected, the app reports `durable: false` and uses temp
  storage. If a store is connected but unusable, `/api/deals` returns 503 with
  the real Blob error and the UI says so, instead of quietly serving a partial
  board out of `/tmp`.
- Search and AI synthesis stay off until their keys are set in the Vercel
  project's environment variables.

Attach a Drive-downloaded CIM, teaser, or financial workbook to an existing
deal by exact ID (this never creates another company row):

```bash
curl -X POST \
  -F category=cim \
  -F stage=2 \
  -F file=@UCT_CIM.pdf \
  https://your-deployment/api/deals/deal_61peacy76abh/documents
```

Accepted files are PDF, XLSX, and XLSM. CIMs are stored as Stage 2 seller
material, their text is extracted and cited in the refreshed company screen,
and the deal advances to packet review unless it is already further along.
Financial uploads unlock Step 3 but never run Full IC automatically.

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

Next.js (App Router), TypeScript, Tailwind CSS, and a JSON deal store. Locally
that store is `data/store.json`. On Vercel it is a private Blob object once the
store is connected; until then each function uses ephemeral `/tmp`.
