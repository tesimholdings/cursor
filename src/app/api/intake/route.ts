import { NextResponse } from "next/server";
import { extractDocument } from "@/lib/document-extraction";
import { id, parseBool, parseMoney, stateFromLocation } from "@/lib/format";
import { parsePastedListing } from "@/lib/intake";
import { researchDeal } from "@/lib/research";
import { updateStore } from "@/lib/store";
import { storeFailureResponse } from "@/lib/store-response";
import type { Deal, DocumentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const mode = String(form.get("mode") || "paste");
  const pasted = String(form.get("text") || "").trim();
  const parsed = parsePastedListing(pasted);
  const file = form.get("file");
  const name = String(form.get("name") || parsed.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Company name is required so the deal is not misidentified." },
      { status: 400 }
    );
  }
  if (mode === "paste" && !pasted) {
    return NextResponse.json(
      { error: "Paste listing or broker notes first." },
      { status: 400 }
    );
  }
  if (mode === "teaser" && !(file instanceof File)) {
    return NextResponse.json(
      { error: "Choose a teaser PDF, XLSX, CSV, or text file." },
      { status: 400 }
    );
  }

  const dealId = id("deal");
  const batchId = id("batch");
  const now = new Date().toISOString();
  const documents: DocumentRecord[] = [];
  if (mode === "paste") {
    documents.push({
      id: id("doc"),
      dealId,
      name: "Pasted listing intelligence",
      category: "listing",
      stage: 1,
      uploadedAt: now,
      size: Buffer.byteLength(pasted),
      textExcerpt: pasted,
      extraction: {
        status: "complete",
        extractedAt: now,
        chunks: [{ text: pasted }],
      },
    });
  } else if (file instanceof File) {
    const buffer = Buffer.from(await file.arrayBuffer());
    documents.push({
      id: id("doc"),
      dealId,
      name: file.name,
      category: "listing",
      stage: 1,
      uploadedAt: now,
      size: file.size,
      extraction: await extractDocument(file.name, buffer, file.type),
    });
  }
  const teaserText = documents
    .flatMap((document) => document.extraction?.chunks || [])
    .map((chunk) => chunk.text)
    .join("\n")
    .slice(0, 8_000);
  const intelligence =
    mode === "teaser" ? parsePastedListing(teaserText) : parsed;
  const industry =
    String(form.get("industry") || intelligence.industry || "Unknown").trim() ||
    "Unknown";
  const location = String(
    form.get("location") || intelligence.location || ""
  ).trim();

  const deal: Deal = {
    id: dealId,
    batchId,
    name,
    listingUrl:
      String(
        form.get("listingUrl") || intelligence.listingUrl || ""
      ).trim() ||
      undefined,
    websiteUrl:
      String(
        form.get("websiteUrl") || intelligence.websiteUrl || ""
      ).trim() ||
      undefined,
    industry,
    location,
    state: stateFromLocation(location),
    askingPrice:
      parseMoney(form.get("askingPrice")) ?? intelligence.askingPrice ?? null,
    revenue: parseMoney(form.get("revenue")) ?? intelligence.revenue ?? null,
    ebitda: parseMoney(form.get("ebitda")) ?? intelligence.ebitda ?? null,
    sde: parseMoney(form.get("sde")) ?? intelligence.sde ?? null,
    employees: parseMoney(form.get("employees")),
    realEstateIncluded: parseBool(form.get("realEstateIncluded")),
    ffe: parseMoney(form.get("ffe")),
    sellerFinancing: parseBool(form.get("sellerFinancing")),
    notes:
      pasted ||
      teaserText ||
      String(form.get("notes") || "").trim() ||
      undefined,
    broker: String(form.get("broker") || "").trim() || undefined,
    source: mode === "paste" ? "Pasted listing intel" : "Uploaded teaser",
    status: "imported",
    researchStatus: "pending",
    createdAt: now,
    updatedAt: now,
    documents,
    assignedQuestions: [],
    fatalRisks: [],
  };

  try {
    await updateStore((store) => {
      store.deals.push(deal);
      store.batches.unshift({
        id: batchId,
        name:
          mode === "paste" ? `${name} — pasted intake` : `${name} — teaser`,
        createdAt: now,
        total: 1,
      });
    });
    const researched = await researchDeal(dealId);
    return NextResponse.json({ deal: researched }, { status: 201 });
  } catch (error) {
    return storeFailureResponse(error);
  }
}
