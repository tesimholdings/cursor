import type { Deal, DocumentRecord } from "@/lib/types";
import { companyScan } from "@/lib/company-scan";
import { documentClickUrl } from "@/lib/documents";

export function DealDocuments({
  deal,
  onUpload,
}: {
  deal: Deal;
  onUpload: (url: string, form: HTMLFormElement) => void;
}) {
  const scan = companyScan(deal);
  const cim = scan.primaryCim;
  const cimHref = cim ? documentClickUrl(deal.id, cim) : "";
  return (
    <section className="card rounded-2xl p-5">
      <div className="kicker">Documents</div>
      {cim ? (
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
            <SecondaryFile key={document.id} dealId={deal.id} document={document} />
          ))}
        </ul>
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
  dealId,
  document,
}: {
  dealId: string;
  document: DocumentRecord;
}) {
  const href = documentClickUrl(dealId, document);
  const kind =
    document.category === "financials"
      ? "Financials"
      : document.category === "listing"
        ? "Listing / research"
        : document.category.replace(/_/g, " ");
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className="underline">
        {document.name}
      </a>
      <span className="ml-2 text-[var(--muted)]">{kind}</span>
    </li>
  );
}
