import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { investmentCommitteeHtml } from "@/lib/ic-report";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = await readStore();
  const deal = store.deals.find((d) => d.id === id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!deal.diligence) {
    return NextResponse.json(
      {
        error:
          "Full IC report is locked until readable financials / QoE are uploaded and Step 4 is run.",
      },
      { status: 409 }
    );
  }
  const html = investmentCommitteeHtml(deal);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${deal.name.replace(/\s+/g, "-")}-IC-report.html"`,
    },
  });
}
