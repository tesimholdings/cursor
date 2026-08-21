"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type IntakeMode = "spreadsheet" | "paste" | "teaser";

export default function UploadPage() {
  const [mode, setMode] = useState<IntakeMode>("spreadsheet");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    endpoint: string
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Intake failed.");
        return;
      }
      setMessage(
        payload.count
          ? `${payload.count} companies added. Opening the broker board…`
          : `${payload.deal?.name || "Company"} added. Opening the broker board…`
      );
      router.push("/ranking");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="kicker">Intake</div>
        <h1 className="serif text-4xl">Add companies to the broker board</h1>
        <p className="mt-2 text-[var(--muted)]">
          Paste listing intelligence, upload a multi-company spreadsheet, or
          attach one listing teaser. Every company starts at Step 1.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["spreadsheet", "Upload spreadsheet"],
            ["paste", "Paste listing intel"],
            ["teaser", "Upload listing teaser"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn ${mode === key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setMode(key);
              setMessage(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "spreadsheet" && (
        <form
          onSubmit={(event) => submit(event, "/api/upload")}
          className="card space-y-4 rounded-2xl p-6"
        >
          <div>
            <div className="kicker">Fast batch intake</div>
            <h2 className="serif text-2xl">Multi-company CSV / XLSX</h2>
          </div>
          <label className="block text-sm font-medium">
            Spreadsheet
            <input
              required
              name="file"
              type="file"
              accept=".csv,.xlsx"
              className="mt-2 block w-full text-sm"
            />
          </label>
          <p className="text-sm text-[var(--muted)]">
            Recognized columns: company, listing URL, company website, industry,
            location, asking price, revenue, EBITDA, SDE/cash flow, employees,
            real estate, FF&amp;E, seller financing, notes, broker, and source.
          </p>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Importing…" : "Add rows to broker board"}
          </button>
          <a className="ml-2 text-sm underline" href="/api/sample">
            Download sample
          </a>
        </form>
      )}

      {mode === "paste" && (
        <form
          onSubmit={(event) => submit(event, "/api/intake")}
          className="card space-y-4 rounded-2xl p-6"
        >
          <input type="hidden" name="mode" value="paste" />
          <div>
            <div className="kicker">One-company intake</div>
            <h2 className="serif text-2xl">Paste broker / listing intel</h2>
          </div>
          <textarea
            required
            name="text"
            rows={12}
            className="w-full rounded-xl border border-[var(--line)] p-3 text-sm"
            placeholder={`Company: Example Operator\nIndustry: Express car wash\nLocation: Columbus, OH\nAsking price: $7,500,000\nRevenue: $4,000,000\nSDE: $1,100,000\nListing URL: https://…\n\nPaste the rest of the broker notes here.`}
          />
          <OptionalIdentityFields />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Screening…" : "Add and screen listing"}
          </button>
        </form>
      )}

      {mode === "teaser" && (
        <form
          onSubmit={(event) => submit(event, "/api/intake")}
          className="card space-y-4 rounded-2xl p-6"
        >
          <input type="hidden" name="mode" value="teaser" />
          <div>
            <div className="kicker">One-company intake</div>
            <h2 className="serif text-2xl">Upload listing teaser</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              PDFs and spreadsheets are extracted. A scanned PDF returns a hard
              failure rather than invented content.
            </p>
          </div>
          <label className="block text-sm font-medium">
            Company name
            <input
              required
              name="name"
              className="mt-1 w-full rounded-lg border border-[var(--line)] p-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Teaser file
            <input
              required
              name="file"
              type="file"
              accept=".pdf,.xlsx,.csv,.txt"
              className="mt-2 block w-full text-sm"
            />
          </label>
          <OptionalIdentityFields />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Extracting and screening…" : "Add and screen teaser"}
          </button>
        </form>
      )}

      {message && (
        <div className="rounded-xl bg-[var(--paper-2)] p-3 text-sm">
          {message}
        </div>
      )}
    </div>
  );
}

function OptionalIdentityFields() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm">
        Industry (optional)
        <input
          name="industry"
          className="mt-1 w-full rounded-lg border border-[var(--line)] p-2"
        />
      </label>
      <label className="text-sm">
        Location (optional)
        <input
          name="location"
          className="mt-1 w-full rounded-lg border border-[var(--line)] p-2"
        />
      </label>
      <label className="text-sm">
        Listing URL (optional)
        <input
          name="listingUrl"
          type="url"
          className="mt-1 w-full rounded-lg border border-[var(--line)] p-2"
        />
      </label>
      <label className="text-sm">
        Company website (optional)
        <input
          name="websiteUrl"
          type="url"
          className="mt-1 w-full rounded-lg border border-[var(--line)] p-2"
        />
      </label>
    </div>
  );
}
