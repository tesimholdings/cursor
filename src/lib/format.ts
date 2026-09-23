export function money(n?: number | null, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${Math.round(n).toLocaleString()}`;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  });
}

export function multiple(price?: number | null, earnings?: number | null) {
  if (!price || !earnings || earnings <= 0) return null;
  return price / earnings;
}

export function pct(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function parseMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/[$,\s]/g, "").replace(/[()]/g, "");
  if (!s) return null;
  const m = s.match(/^(-?[\d.]+)([kmb])?$/i);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  let n = Number(m[1]);
  const suf = (m[2] || "").toLowerCase();
  if (suf === "k") n *= 1_000;
  if (suf === "m") n *= 1_000_000;
  if (suf === "b") n *= 1_000_000_000;
  return Number.isFinite(n) ? n : null;
}

export function parseBool(raw: unknown): boolean | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  if (["y", "yes", "true", "1", "included"].includes(s)) return true;
  if (["n", "no", "false", "0", "excluded"].includes(s)) return false;
  return null;
}

export function id(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function stateFromLocation(location?: string) {
  if (!location) return undefined;
  const m = location.match(/\b([A-Z]{2})\b/);
  return m?.[1];
}

export function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
