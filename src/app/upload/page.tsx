"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error || "Upload failed");
      return;
    }
    setMsg(`${json.count} companies added. Starting screening…`);
    await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 6 }),
    });
    router.push("/ranking");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="kicker">Stage 0</div>
        <h1 className="serif text-4xl">Upload a business list</h1>
        <p className="mt-2 text-[var(--muted)]">
          Excel or CSV. 10 companies, 50, 100, or hundreds. Each row becomes a deal. Then we answer one
          question: should we even request the NDA?
        </p>
      </div>
      <form onSubmit={onSubmit} className="card space-y-4 rounded-2xl p-6">
        <label className="block text-sm font-medium">
          Spreadsheet
          <input
            required
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="mt-2 block w-full text-sm"
          />
        </label>
        <p className="text-sm text-[var(--muted)]">
          Columns we look for: company name, listing URL, industry, location, asking price, revenue,
          EBITDA, SDE / cash flow, employees, real estate, FF&E, seller financing, notes, broker, source.
        </p>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Importing…" : "Create deal records"}
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
      <a className="btn btn-ghost" href="/api/sample">
        Download a sample spreadsheet
      </a>
    </div>
  );
}
