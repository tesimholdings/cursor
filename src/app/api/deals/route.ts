import { NextResponse } from "next/server";
import { readStore, storePersistence } from "@/lib/store";
import { funnel, researchProgress } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    deals: store.deals,
    teams: store.teams,
    batches: store.batches,
    funnel: funnel(store.deals),
    research: researchProgress(store),
    persistence: storePersistence(),
  });
}
