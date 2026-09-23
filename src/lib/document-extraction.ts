import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import type {
  DocumentEvidenceChunk,
  DocumentExtraction,
  ExtractedTable,
  ExtractedTableRow,
  DocumentRecord,
} from "./types";

const MAX_CHUNKS = 2_000;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function extractDocument(
  fileName: string,
  buffer: Buffer,
  mimeType = ""
): Promise<DocumentExtraction> {
  const extension = fileName.toLowerCase().split(".").pop() || "";
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return failed("File exceeds the 25 MB extraction limit.");
  }
  try {
    if (extension === "pdf" || mimeType === "application/pdf") {
      return await extractPdf(buffer);
    }
    if (
      ["xlsx", "csv"].includes(extension) ||
      /spreadsheet|excel|csv/.test(mimeType)
    ) {
      return await extractWorkbook(buffer, extension === "csv");
    }
    if (["txt", "md"].includes(extension) || mimeType.startsWith("text/")) {
      const text = buffer.toString("utf8").trim();
      if (!text) return failed("Text file contained no readable text.");
      return complete([{ text }]);
    }
    return {
      status: "unsupported",
      extractedAt: new Date().toISOString(),
      error: `Unsupported file type: ${extension || mimeType || "unknown"}`,
      chunks: [],
    };
  } catch (error) {
    return failed(
      error instanceof Error ? error.message : "Document extraction failed."
    );
  }
}

async function extractPdf(buffer: Buffer): Promise<DocumentExtraction> {
  await ensurePdfGlobals();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
  });
  const pdf = await loadingTask.promise;
  const chunks: DocumentEvidenceChunk[] = [];
  try {
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(pdf.numPages, 500);
      pageNumber += 1
    ) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) chunks.push({ text, page: pageNumber });
      if (chunks.length >= MAX_CHUNKS) break;
    }
  } finally {
    await loadingTask.destroy();
  }
  if (!chunks.length) {
    return failed(
      "PDF contained no extractable text. It may be scanned; OCR is not configured."
    );
  }
  return complete(chunks);
}

async function ensurePdfGlobals() {
  const runtime = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    Path2D?: typeof Path2D;
    ImageData?: typeof ImageData;
  };
  if (runtime.DOMMatrix && runtime.Path2D && runtime.ImageData) return;
  // pdfjs normally loads this optional dependency itself. Vercel's external
  // module path can prevent that transitive require from being traced, so make
  // the dependency explicit and install the same Node canvas globals first.
  const canvas = await import("@napi-rs/canvas");
  runtime.DOMMatrix ??= canvas.DOMMatrix as unknown as typeof DOMMatrix;
  runtime.Path2D ??= canvas.Path2D as unknown as typeof Path2D;
  runtime.ImageData ??= canvas.ImageData as unknown as typeof ImageData;
}

async function extractWorkbook(
  buffer: Buffer,
  csv: boolean
): Promise<DocumentExtraction> {
  const workbook = new ExcelJS.Workbook();
  if (csv) {
    const rows = parseCsv(buffer.toString("utf8"), {
      skip_empty_lines: false,
      bom: true,
      relax_column_count: true,
    }) as unknown[][];
    workbook.addWorksheet("CSV").addRows(rows);
  } else {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  }
  const chunks: DocumentEvidenceChunk[] = [];
  const tables: ExtractedTable[] = [];

  for (const sheet of workbook.worksheets) {
    if (!sheet.actualRowCount || !sheet.actualColumnCount) continue;
    const sheetName = sheet.name;
    const headerRow = 1;
    const headers: Array<{ name: string; column: number; cell: string }> = [];
    for (let column = 1; column <= sheet.actualColumnCount; column += 1) {
      const cell = sheet.getCell(headerRow, column);
      const value = primitiveCell(cell.value);
      const name =
        value == null || String(value).trim() === ""
          ? `Column ${column}`
          : String(value).trim();
      headers.push({ name, column, cell: cell.address });
    }

    const rows: ExtractedTableRow[] = [];
    const endRow = Math.min(
      sheet.actualRowCount,
      headerRow + MAX_ROWS_PER_SHEET
    );
    for (let row = headerRow + 1; row <= endRow; row += 1) {
      const values: ExtractedTableRow["values"] = {};
      const cells: ExtractedTableRow["cells"] = {};
      let hasValue = false;
      for (const header of headers) {
        const cell = sheet.getCell(row, header.column);
        const address = cell.address;
        const raw = primitiveCell(cell.value);
        if (raw != null && String(raw).trim() !== "") hasValue = true;
        values[header.name] = raw;
        cells[header.name] = address;
      }
      if (!hasValue) continue;
      rows.push({ rowNumber: row, values, cells });
      if (chunks.length < MAX_CHUNKS) {
        const text = headers
          .map(({ name }) => `${name}: ${String(values[name] ?? "")}`)
          .join(" | ");
        chunks.push({
          text,
          sheet: sheetName,
          cell: `${sheet.getCell(row, 1).address}:${
            sheet.getCell(row, sheet.actualColumnCount).address
          }`,
        });
      }
    }
    tables.push({
      sheet: sheetName,
      range: `A1:${sheet.getCell(
        sheet.actualRowCount,
        sheet.actualColumnCount
      ).address}`,
      headers: headers.map(({ name }) => name),
      rows,
    });
  }

  if (!chunks.length && !tables.some((table) => table.rows.length)) {
    return failed("Workbook contained no readable data rows.");
  }
  return complete(chunks, tables);
}

function primitiveCell(
  value: ExcelJS.CellValue
): string | number | boolean | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if ("result" in value)
    return primitiveCell(value.result as ExcelJS.CellValue);
  if ("text" in value) return String(value.text);
  if ("richText" in value)
    return value.richText.map((part) => part.text).join("");
  if ("hyperlink" in value) return String(value.hyperlink);
  return String(value);
}

function complete(
  chunks: DocumentEvidenceChunk[],
  tables?: ExtractedTable[]
): DocumentExtraction {
  return {
    status: "complete",
    extractedAt: new Date().toISOString(),
    chunks,
    tables,
  };
}

function failed(error: string): DocumentExtraction {
  return {
    status: "failed",
    extractedAt: new Date().toISOString(),
    error,
    chunks: [],
  };
}

export function extractionText(extraction?: DocumentExtraction): string {
  if (extraction?.status !== "complete") return "";
  return extraction.chunks.map((chunk) => chunk.text).join("\n");
}

export function guessDocumentCategory(
  name: string
): DocumentRecord["category"] {
  const value = name.toLowerCase();
  if (
    value.includes("cim") ||
    value.includes("offering memo") ||
    /\bteaser\b/.test(value) ||
    /\bcbr\b/.test(value) ||
    /\bexec(utive)?[\s._-]*summ/.test(value) ||
    /confidential[\s._-]*information/.test(value)
  ) {
    if (!/^tavily-|ais-tight-copy-|ais[_-]tight/.test(value)) return "cim";
  }
  if (
    value.includes("p&l") ||
    value.includes("pnl") ||
    value.includes("balance") ||
    value.includes("income statement") ||
    value.includes("general ledger") ||
    value.includes("financial") ||
    value.includes("qoe") ||
    value.includes("quality of earnings")
  )
    return "financials";
  if (value.includes("tax")) return "tax";
  if (value.includes("equip") || value.includes("ffe") || value.includes("asset"))
    return "equipment";
  if (value.includes("customer") || value.includes("revenue by"))
    return "customers";
  if (value.includes("employee") || value.includes("payroll")) return "employees";
  if (value.includes("real estate") || value.includes("lease"))
    return "real_estate";
  if (
    value.includes("legal") ||
    value.includes("environment") ||
    value.includes("contract")
  )
    return "legal";
  return "other";
}

export function classifyDocument(
  name: string,
  extraction?: DocumentExtraction
): DocumentRecord["category"] {
  const named = guessDocumentCategory(name);
  if (named !== "other" || extraction?.status !== "complete") return named;
  const headers = (extraction.tables || [])
    .flatMap((table) => table.headers)
    .join(" ");
  const text = extraction.chunks
    .slice(0, 30)
    .map((chunk) => chunk.text)
    .join(" ");
  const sample = `${headers} ${text}`;
  if (
    /customer|client/i.test(headers) &&
    /revenue|sales/i.test(headers)
  )
    return "customers";
  if (
    /income statement|balance sheet|revenue|sales|cogs|gross profit|ebitda|net income|accounts receivable/i.test(
      sample
    )
  )
    return "financials";
  if (/machine|manufacturer|model|serial|equipment|fixed asset/i.test(sample))
    return "equipment";
  return "other";
}
