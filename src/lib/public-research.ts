import { lookup } from "node:dns/promises";
import * as cheerio from "cheerio";
import ipaddr from "ipaddr.js";
import type { Deal, PublicResearch, ResearchSource } from "./types";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_SOURCE_CHARS = 6_000;

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

export async function researchCompany(deal: Deal): Promise<PublicResearch> {
  const searchedAt = new Date().toISOString();
  const sources: ResearchSource[] = sellerMaterialSources(deal, searchedAt);
  const errors: string[] = [];

  for (const candidate of [
    { url: deal.listingUrl, kind: "LISTING" as const, title: "Business listing" },
    {
      url: deal.websiteUrl,
      kind: "COMPANY_WEBSITE" as const,
      title: "Company website",
    },
  ]) {
    if (!candidate.url) continue;
    try {
      const page = await fetchPublicPage(candidate.url);
      sources.push({
        id: sourceId(candidate.url),
        title: page.title || candidate.title,
        url: page.url,
        excerpt: page.text.slice(0, MAX_SOURCE_CHARS),
        accessedAt: searchedAt,
        kind: candidate.kind,
      });
    } catch (error) {
      errors.push(
        `${candidate.title}: ${
          error instanceof Error ? error.message : "fetch failed"
        }`
      );
    }
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (apiKey) {
    const queries = [
      `"${deal.name}" ${deal.location} ${deal.industry}`,
      `"${deal.name}" customers equipment employees certifications`,
      `${deal.industry} United States market size CAGR competitors`,
      `${deal.industry} largest companies United States`,
    ];
    for (const query of queries) {
      try {
        const results = await searchTavily(query, apiKey);
        for (const result of results) {
          if (!result.url || !isSafeCitationUrl(result.url)) continue;
          const canonical = canonicalUrl(result.url);
          if (sources.some((source) => canonicalUrl(source.url || "") === canonical)) {
            continue;
          }
          sources.push({
            id: sourceId(canonical),
            title: result.title?.trim() || new URL(canonical).hostname,
            url: canonical,
            excerpt: (result.content || "").slice(0, MAX_SOURCE_CHARS),
            query,
            accessedAt: searchedAt,
            kind:
              /market|industry|cagr|competitor/i.test(query)
                ? "INDUSTRY_SOURCE"
                : "PUBLIC_SOURCE",
          });
        }
      } catch (error) {
        errors.push(
          `Search "${query}": ${
            error instanceof Error ? error.message : "failed"
          }`
        );
      }
    }
  }

  const deduped = dedupeSources(sources);
  if (!deduped.length) {
    return {
      status: "unavailable",
      provider: apiKey ? "tavily" : "none",
      searchedAt,
      reason: apiKey
        ? `No usable public sources found.${errors.length ? ` ${errors.join(" ")}` : ""}`
        : "TAVILY_API_KEY is not configured and no supplied public URL could be fetched.",
      sources: [],
    };
  }

  return {
    status: "complete",
    provider: apiKey ? "tavily" : "direct_only",
    searchedAt,
    reason: errors.length ? `Partial research: ${errors.join(" ")}` : undefined,
    companyWebsiteUrl: deal.websiteUrl,
    sources: deduped.slice(0, 20),
  };
}

function sellerMaterialSources(
  deal: Deal,
  accessedAt: string
): ResearchSource[] {
  return deal.documents
    .filter(
      (document) =>
        ["listing", "cim", "financials"].includes(document.category) &&
        (document.textExcerpt ||
          document.extraction?.chunks.some((chunk) => chunk.text.trim()))
    )
    .map((document) => {
      const excerpt =
        document.textExcerpt ||
        document.extraction?.chunks
          .map((chunk) => chunk.text)
          .join("\n")
          .slice(0, MAX_SOURCE_CHARS);
      return {
        id: `seller_${document.id}`,
        title: `${document.category.toUpperCase()} — ${document.name}`,
        excerpt: cleanText(excerpt || ""),
        accessedAt,
        kind: "SELLER_MATERIAL" as const,
      };
    });
}

async function searchTavily(
  query: string,
  apiKey: string
): Promise<TavilyResult[]> {
  const response = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Tavily returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as TavilyResponse;
  return Array.isArray(payload.results) ? payload.results : [];
}

async function fetchPublicPage(input: string): Promise<{
  url: string;
  title: string;
  text: string;
}> {
  let url = new URL(input);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "AcquisitionCommandCenter/1.0 (+public diligence research)",
        Accept: "text/html,text/plain;q=0.9",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect missing location");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      throw new Error(`unsupported content type ${contentType || "unknown"}`);
    }
    const html = (await response.text()).slice(0, 1_000_000);
    if (/text\/plain/i.test(contentType)) {
      return { url: url.toString(), title: url.hostname, text: cleanText(html) };
    }
    const $ = cheerio.load(html);
    $("script,style,noscript,svg,form,nav,footer").remove();
    const title = $("title").first().text().trim();
    const text = cleanText($("body").text());
    if (!text) throw new Error("page contained no readable text");
    return { url: url.toString(), title, text };
  }
  throw new Error("too many redirects");
}

async function assertPublicUrl(url: URL) {
  if (!isSafeCitationUrl(url.toString())) {
    throw new Error("URL is not a public HTTP(S) URL");
  }
  const records = await lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) {
    throw new Error("URL resolves to a private or reserved address");
  }
}

export function isSafeCitationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (
      ["localhost", "0.0.0.0", "::1"].includes(url.hostname.toLowerCase()) ||
      /\.(?:local|internal)$/i.test(url.hostname) ||
      url.username ||
      url.password
    ) {
      return false;
    }
    if (ipaddr.isValid(stripAddressBrackets(url.hostname)) && isPrivateIp(url.hostname))
      return false;
    return true;
  } catch {
    return false;
  }
}

function isPrivateIp(address: string): boolean {
  try {
    let parsed = ipaddr.parse(stripAddressBrackets(address));
    if (
      parsed.kind() === "ipv6" &&
      (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    ) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed.range() !== "unicast";
  } catch {
    return true;
  }
}

function stripAddressBrackets(address: string) {
  return address.replace(/^\[|\]$/g, "").split("%")[0];
}

export function validatedResearchSources(
  sourceIds: string[],
  research: PublicResearch
): ResearchSource[] {
  const allowed = new Set(sourceIds);
  return research.sources.filter(
    (source) =>
      allowed.has(source.id) &&
      (source.kind === "SELLER_MATERIAL"
        ? Boolean(source.excerpt)
        : Boolean(source.url) && isSafeCitationUrl(source.url || ""))
  );
}

function dedupeSources(sources: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = canonicalUrl(source.url || source.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function sourceId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `src_${(hash >>> 0).toString(36)}`;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SOURCE_CHARS);
}
