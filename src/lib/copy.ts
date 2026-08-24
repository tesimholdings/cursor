const TEMPLATE_WHY =
  "This changes whether the opportunity deserves more time.";

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function legalNameStems(name?: string | null) {
  const full = (name || "").replace(/\s+/g, " ").trim();
  if (!full) return [];
  const stems = [full];
  const withoutEntity = full
    .replace(
      /,?\s*(llc|l\.l\.c\.|inc|incorporated|co\.|company|ltd|lp|llp|corp|corporation)\.?$/i,
      ""
    )
    .trim();
  if (withoutEntity && withoutEntity !== full) stems.push(withoutEntity);
  return [...new Set(stems.filter((stem) => stem.length > 3))];
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

/** Remove the legal name anywhere after the page has already shown it once. */
export function stripRepeatedName(text: string, name?: string | null) {
  if (!text) return "";
  let next = stripLeadingName(text, name);
  for (const stem of legalNameStems(name)) {
    next = next
      .replace(new RegExp(`\\b${escapeRegExp(stem)}(?:'s)?\\b`, "gi"), "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/^[—–:,-]\s*/, "")
      .trim();
  }
  if (!next) return "";
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
  if (!compact) return false;
  if (/(?:[A-Z]\s){3,}[A-Z]/.test(compact)) return true;
  if (/confidentialinformation|confidentialuniquecoat|trailing3-year|sectioniexecutive/i.test(
    compact.replace(/\s+/g, "")
  )) return true;
  if (/C O N F I D E N T I A L|T R A I L I N G|I N F O R M A T I O N/.test(compact)) {
    return true;
  }
  if (compact.length > 420) return true;
  const words = compact.split(" ");
  if (words.length >= 40) {
    const short = words.filter((word) => word.length <= 2).length;
    if (short / words.length > 0.3) return true;
  }
  const letters = compact.replace(/[^A-Za-z]/g, "");
  const caps = compact.replace(/[^A-Z]/g, "");
  return letters.length > 24 && caps.length / letters.length > 0.55;
}

export function readableDocumentText(chunks: Array<{ text?: string }>) {
  return chunks
    .map((chunk) => chunk.text || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
