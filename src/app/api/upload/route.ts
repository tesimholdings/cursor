import { NextResponse } from "next/server";
import { parseSpreadsheet, toDeal } from "@/lib/parse-spreadsheet";
import { updateStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";
import { id } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please upload a CSV or Excel file." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const rows = await parseSpreadsheet(buf, file.name);
  if (!rows.length) {
    return NextResponse.json(
      { error: "No companies found. Need a Company / Name column." },
      { status: 400 }
    );
  }
  const batchId = id("batch");
  try {
    const created = await updateStore((store) => {
      const deals = rows.map((r) => toDeal(r, batchId));
      store.deals.push(...deals);
      store.batches.unshift({
        id: batchId,
        name: file.name,
        createdAt: new Date().toISOString(),
        total: deals.length,
      });
      return deals;
    });
    return NextResponse.json({
      batchId,
      count: created.length,
      ids: created.map((d) => d.id),
    });
  } catch (error) {
    return storeFailureResponse(error);
  }
}
