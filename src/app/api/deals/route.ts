import { NextResponse } from "next/server";
import { readStore, storeStatus } from "@/lib/store";
import { funnel, researchProgress } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const store = await readStore();
    return NextResponse.json(
      {
        deals: store.deals,
        teams: store.teams,
        batches: store.batches,
        funnel: funnel(store.deals),
        research: researchProgress(store),
        persistence: await storeStatus(),
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    // The shared store is configured but unreachable. Report that instead of
    // serving a partial board that looks like a smaller pipeline.
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The shared deal store could not be read.",
        storeUnavailable: true,
        persistence: await storeStatus(),
      },
      { status: 503, headers: NO_STORE }
    );
  }
}
