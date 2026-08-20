import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { researchDeal, researchNext } from "@/lib/research";
import { researchProgress } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  return NextResponse.json(researchProgress(store));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.dealId) {
    const deal = await researchDeal(body.dealId);
    return NextResponse.json({ deal });
  }
  const ids = await researchNext(body.limit ?? 4);
  const store = await readStore();
  return NextResponse.json({ processed: ids, ...researchProgress(store) });
}
