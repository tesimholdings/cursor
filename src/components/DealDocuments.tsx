import type { Deal, DocumentRecord } from "@/lib/types";
import { companyScan } from "@/lib/company-scan";
import {
  foldName,
  isDumpDocument,
  storedDocumentUrl,
} from "@/lib/cim-drive";
import { documentClickUrl } from "@/lib/documents";

export function DealDocuments({
  deal,
  onUpload,
}: {
  deal: Deal;
  onUpload: (url: string, form: HTMLFormElement) => void;
}) {
  const scan = companyScan(deal);
  const cimHref = scan.openCimUrl;
  return (
    <section className="card rounded-2xl p-5">
      <div className="kicker">Documents</div>
      {cimHref ? (
        <a
          className="btn btn-primary btn-xl mt-3"
          href={cimHref}
          target="_blank"
          rel="noreferrer"
        >
          Open CIM
        </a>
      ) : (
        <p className="mt-2 text-base font-semibold">
          No CIM on this card · Step {scan.funnelStep}:{" "}
          {scan.funnelSteps.find((step) => step.key === scan.funnelStep)?.scanLabel}
        </p>
      )}
      {scan.otherDocuments.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {scan.otherDocuments.map((document) => (
            <SecondaryFile
              key={document.id}
              deal={deal}
              cimHref={cimHref}
              document={document}
            />
          ))}
        </ul>
      )}
      {scan.dumpDocuments.length > 0 && (
        <details className="mt-3 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">Research dumps (not the CIM)</summary>
          <ul className="mt-2 space-y-1">
            {scan.dumpDocuments.map((document) => (
              <li key={document.id}>{document.name}</li>
            ))}
          </ul>
        </details>
      )}
      <form
        className="mt-4 flex flex-wrap items-center gap-2 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onUpload(`/api/deals/${deal.id}/documents`, event.currentTarget);
        }}
      >
        <select
          name="category"
          aria-label="Document category"
          className="rounded-lg border border-[var(--line)] bg-white p-2"
          defaultValue="cim"
        >
          <option value="cim">CIM</option>
          <option value="teaser">Teaser</option>
          <option value="financials">Financials / QoE</option>
        </select>
        <input
          name="file"
          aria-label="PDF or workbook"
          type="file"
          accept=".pdf,.xlsx,.xlsm"
          required
        />
        <button className="btn btn-ghost">Attach</button>
      </form>
    </section>
  );
}

function SecondaryFile({
  deal,
  cimHref,
  document,
}: {
  deal: Deal;
  cimHref: string | null;
  document: DocumentRecord;
}) {
  const namedCim =
    Boolean(cimHref) &&
    deal.publicResearch?.cimDriveName &&
    foldName(document.name) === foldName(deal.publicResearch.cimDriveName);
  const href = isDumpDocument(document)
    ? undefined
    : namedCim
      ? cimHref
      : storedDocumentUrl(document) || documentClickUrl(deal.id, document);
  const kind =
    document.category === "financials"
      ? "Financials"
      : document.category === "listing"
        ? "Listing / research"
        : document.category.replace(/_/g, " ");
  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="underline">
          {document.name}
        </a>
      ) : (
        <span>{document.name}</span>
      )}
      <span className="ml-2 text-[var(--muted)]">{kind}</span>
    </li>
  );
}
