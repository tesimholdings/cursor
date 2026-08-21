const TEMPLATE_WHY =
  "This changes whether the opportunity deserves more time.";

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripLeadingName(text: string, name?: string | null) {
  if (!text) return "";
  let next = text.replace(/\s+/g, " ").trim();
  if (!name?.trim()) return next;
  const escaped = escapeRegExp(name.trim());
  next = next.replace(
    new RegExp(
      `^(the\\s+)?${escaped}(?:'s)?\\s*(?:is |are |has |have |was |will |includes? |maps |appears |offers |sells |does )?`,
      "i"
    ),
    ""
  );
  next = next.replace(/^\s*[—–:,-]\s*/, "").trim();
  if (!next) return text.replace(/\s+/g, " ").trim();
  return next.replace(/^[a-z]/, (char) => char.toUpperCase());
}

export function sentences(text: string) {
  return (text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map((part) => part.trim())
    .filter(Boolean);
}

export function firstSentences(text: string, max = 3) {
  return sentences(text).slice(0, max).join(" ").trim();
}

export function tightenAnswer(text: string, name?: string | null, max = 3) {
  return firstSentences(stripLeadingName(text, name), max);
}

export function unanswered(item: string) {
  return `Unanswered — ${item}`;
}

export function defaultWhy() {
  return "This fact changes price, structure, or whether we keep spending time.";
}

export function isTemplateWhy(value?: string) {
  return (value || "").trim() === TEMPLATE_WHY;
}

export function looksLikeOcrDump(text?: string | null) {
  if (!text) return false;
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length > 900) return true;
  const words = compact.split(" ");
  if (words.length < 80) return false;
  const short = words.filter((word) => word.length <= 2).length;
  return short / words.length > 0.35;
}

export function readableDocumentText(chunks: Array<{ text?: string }>) {
  return chunks
    .map((chunk) => chunk.text || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
