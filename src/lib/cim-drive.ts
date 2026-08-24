import type { Deal, DocumentRecord } from "./types";

const DRIVE_FILE_ID =
  /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([a-zA-Z0-9_-]+)/i;

const DUMP_PREFIX = /^(tavily-|ais-tight-copy-|ais[_-]tight)/i;

export interface KnownCimDriveFile {
  fileId: string;
  fileName: string;
  dealHints: string[];
}

/** Real broker CIMs on TESIM Drive. Never map tavily / AIS / extract dumps. */
export const KNOWN_CIM_DRIVE_FILES: KnownCimDriveFile[] = [
  { fileId: "1Bsmr0fTz2GmqwfCWTMRE-RjW3FfvbD_o", fileName: "UCT_CIM_6326.pdf", dealHints: ["Uniquecoat Technologies"] },
  { fileId: "1ERjZVtsuOGTdPHNKroIUrBriIEcVZXZr", fileName: "TechLED Confidential Information Memorandum-4.pdf", dealHints: ["TechLED"] },
  { fileId: "1VdPz5u_NzD4tGYC_aoNHc91lnsfr_aFQ", fileName: "Nusens USA CIM.pdf", dealHints: ["Nusens USA"] },
  { fileId: "1vgX3OzecPjqdSWkEaokK1eJ_z9KresPe", fileName: "9525-576784 CIM Rich Moe Enterprises 7.3.26.pdf", dealHints: ["Rich Moe Enterprises"] },
  { fileId: "1NS4QkSZqTtJzXMuq4FHZqlVMxJus_Sbd", fileName: "Mighty Molding & Manufacturing - Executive Summary.pdf", dealHints: ["Mighty Molding"] },
  { fileId: "1eXLQgEj2WFTHbMxBQ-NufAQQLivK9lCu", fileName: "SE Painting_30+ Yr Old _ Southeast Commercial & Multifamily Painting Contractor Full Executive Summary.pdf", dealHints: ["SE Painting"] },
  { fileId: "1-VhEopWUfmvDCazPdnjCsY0qgQf15Q0v", fileName: "Merged Profile On Prieto Landscaping.pdf", dealHints: ["Prieto Landscaping"] },
  { fileId: "1AUgLcoDBGPZKFBuH21Fl7t8PfVie8ysA", fileName: "EE_-_CIM_-_AA_Contracting.pdf", dealHints: ["A&A Contracting"] },
  { fileId: "1Xp4aL6aQtXgAj9uy1uWvMM702eTvwXMZ", fileName: "Cayenne Express - CIM.pdf", dealHints: ["Cayenne Express"] },
  { fileId: "1mqA0m-x7Gnam0X7c13eULJbq79YJIUbC", fileName: "Limbaugh Construction Co., Inc. - CIM.pdf", dealHints: ["Limbaugh Construction"] },
  { fileId: "10TBgHGdnhlVnDuOUO-Ela8zo6t4vinSX", fileName: "CIM - SPT.pdf", dealHints: ["Southern Post Tension"] },
  { fileId: "19S_ZpzrgEEdnvCF9yQnEgY7v207UrxLr", fileName: "CIM-Summary-Regional Expedited Trucking-KY.pdf", dealHints: ["Regional Expedited Trucking"] },
  { fileId: "1wr9V_WjtTDpqgS6Uk87SZ7BfiWHYS-WF", fileName: "CIM.pdf", dealHints: ["DP and Company"] },
  { fileId: "1-ILcPf93c5iH5AnylXkTZJX2pPFCu0sH", fileName: "GoForth Express - CIM.pdf", dealHints: ["Goforth Express"] },
  { fileId: "1XQ9gr_ovTKqOmyE4GZruG1ErwDtgFEQ4", fileName: "eFootwear CIM.pdf", dealHints: ["eFootwear"] },
  { fileId: "1IUwimqNfDcBQz0ujs7cEuYN6ynyK3-1c", fileName: "1 MO Platinum Aero Structures CIM BP1.pdf", dealHints: ["Platinum Aerostructures"] },
  { fileId: "1l2Z9vyzABL57XE-zCd-OzkP34HtNpynd", fileName: "Energy-Improvements-CIM_(7)_SHARE.pdf", dealHints: ["Energy Improvements"] },
  { fileId: "1fYf0n3VUsgaCBawxCsRjVV0UlK3Eah-W", fileName: "CIM 2- 4- 26.pdf", dealHints: ["Signs For You"] },
  { fileId: "1X6I5earDV77uys255-D0_q8EkUqGe1Jw", fileName: "1. Enywhey Services - CIM.pdf", dealHints: ["Enywhey Services"] },
  { fileId: "1mTY2PWxYvxu8D6yqLycGmD2kFNxL_jjx", fileName: "CIM Project Building v5.26.pdf", dealHints: ["Diamond State Pole Buildings"] },
  { fileId: "1krrg5R0m8zi0ll1lHg55HaLNhydAHBbg", fileName: "Austin Airworks CIM.pdf", dealHints: ["Austin Airworks"] },
  { fileId: "12x4jocEMCZa4EQUCDUxwD905jJ1KkCbR", fileName: "Loftis Robbins Inc - CIM.pdf", dealHints: ["Loftis Robbins"] },
  { fileId: "1iExioSO_Bkvs2bsweTMTEXVQlpW5W8O5", fileName: "sandstar_ar_homes_cim.pdf", dealHints: ["Sandstar Homes"] },
  { fileId: "1gAVoIssZp5iFQ9xFiRMg-UM3Qho0bV0B", fileName: "Series C2 CIM 06.18.2026 (1).pdf", dealHints: ["AAC Florida", "Probitas Ventures"] },
  { fileId: "1Zw5ax7UkChhheChmnMLHc6HePHLIT5h7", fileName: "Blue Star Distributors, Corp (CIM).pdf", dealHints: ["Blue Star Distributors"] },
  { fileId: "1EncJhTJcWEePoZjeWl6GtvA2LuqDB-J5", fileName: "PBB - Outback Rentals & Landscape Supplies - CIM.pdf", dealHints: ["Outback Rentals"] },
  { fileId: "16ceTJrv621YmJYNlTOp2l4DjrtM19r09", fileName: "CascadeAviationServices_CIM_JUNE_2026_003a.pdf", dealHints: ["Cascade Aviation"] },
  { fileId: "1HnSnzrnr6NYb0k6pXczAptMO-jGqPBP2", fileName: "1 - 1504 Lighting CIM - 6-23-26.pdf", dealHints: ["1504 Lighting", "Integrated Lighting"] },
  { fileId: "1-pMYSaHnkCGjzelmWXMFXM59JkpKO252", fileName: "CIM MIDWEST ELECTRICAL CONSTRUCTION.pdf", dealHints: ["Commercial & Industrial Electrical"] },
  { fileId: "1mLe4hK7dxpR_QgNpSEDPn9D8WfYWBsel", fileName: "Sunbelt - CIM -Kuersten Construction- 03-03-2026.pdf", dealHints: ["Kuersten Construction"] },
  { fileId: "1t4YNIToiwCLpzB0KFLfNcqV8IFbpNTrW", fileName: "Hoerner_Boxes_CIM_John_Priest.pdf", dealHints: ["Hoerner Boxes"] },
  { fileId: "1odNEW_6NM7-HVmCR_nJqe2z0ij337cAJ", fileName: "CIM FINAL great sports.pdf", dealHints: ["Great Sports"] },
  { fileId: "15fe2zchzuyvsHoyIcMLqQyZRXtlWeAih", fileName: "CIM - Material Handling and Storage.pdf", dealHints: ["Material Handling and Storage"] },
  { fileId: "1r2Nf-AuBnSAttNkAHZCLZYlVJ3qoYaVR", fileName: "AFMS-CIM.pdf", dealHints: ["Alaska Fence"] },
  { fileId: "14B7Dpqb051uc9JRzk3WkgC5uCYvdvdp9", fileName: "Billsby CIM 0526.pdf", dealHints: ["Billsby Lumber"] },
  { fileId: "1t4GsIwmfsPwbXiU6QNKAzZZjJK8tV0vU", fileName: "CBR - Triple L Transport 4-22-2025.pdf", dealHints: ["Triple L Transport"] },
  { fileId: "1CexrcV9m56xLghBYHzxNWjTjf0Pkui3w", fileName: "73939 Colom Construction CBR.pdf", dealHints: ["Colom Construction"] },
];

export function foldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function driveFileIdFromUrl(url?: string | null) {
  if (!url) return null;
  const match = url.match(DRIVE_FILE_ID);
  return match?.[1] || null;
}

export function driveViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function normalizeDriveViewUrl(url?: string | null) {
  const id = driveFileIdFromUrl(url);
  return id ? driveViewUrl(id) : null;
}

export function persistableCimDriveUrl(url?: string | null) {
  if (url == null) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  return normalizeDriveViewUrl(trimmed) || trimmed;
}

export function isHttpUrl(url?: string | null) {
  if (!url) return false;
  return /^(https?:)?\/\//i.test(url);
}

export function isInternalDocumentViewerUrl(url?: string | null) {
  if (!url) return false;
  return /\/api\/deals\/[^/]+\/documents\/[^/]+/i.test(url);
}

export function isDumpDocumentName(name?: string | null) {
  const value = (name || "").trim();
  if (!value) return false;
  const base = value.split(/[\\/]/).pop() || value;
  if (/^tavily-/i.test(base)) return true;
  if (/^ais-tight-copy-/i.test(base)) return true;
  if (/^ais[_-]tight/i.test(base)) return true;
  if (/extract/i.test(base) && /\.pdf$/i.test(base)) return true;
  return DUMP_PREFIX.test(base);
}

export function isDumpDocument(
  document: Pick<DocumentRecord, "name"> & { url?: string }
) {
  if (isDumpDocumentName(document.name)) return true;
  const urlName = (document.url || "").split("?")[0].split("/").pop() || "";
  return isDumpDocumentName(urlName);
}

export function storedDocumentUrl(document: DocumentRecord) {
  const drive =
    normalizeDriveViewUrl(document.url) ||
    normalizeDriveViewUrl(document.blobUrl);
  if (drive) return drive;
  for (const candidate of [document.blobUrl, document.url]) {
    if (
      candidate &&
      isHttpUrl(candidate) &&
      !isInternalDocumentViewerUrl(candidate)
    ) {
      return candidate;
    }
  }
  return undefined;
}

export function isOpenableCimDocument(document: DocumentRecord) {
  if (document.category !== "cim") return false;
  if (isDumpDocument(document)) return false;
  return Boolean(storedDocumentUrl(document));
}

export function knownCimDriveFor(deal: Pick<Deal, "name" | "documents">) {
  const byFile = deal.documents
    .filter((document) => !isDumpDocument(document))
    .map((document) =>
      KNOWN_CIM_DRIVE_FILES.find(
        (known) => foldName(known.fileName) === foldName(document.name)
      )
    )
    .find(Boolean);
  if (byFile) return byFile;
  const foldedDeal = foldName(deal.name);
  return (
    KNOWN_CIM_DRIVE_FILES.find((known) =>
      known.dealHints.some((hint) => {
        const foldedHint = foldName(hint);
        return (
          foldedDeal.includes(foldedHint) || foldedHint.includes(foldedDeal)
        );
      })
    ) || null
  );
}

export function openCimUrl(deal: Deal) {
  const fromDeal = persistableCimDriveUrl(deal.cimDriveUrl);
  if (fromDeal && (normalizeDriveViewUrl(fromDeal) || isHttpUrl(fromDeal))) {
    if (!isDumpDocumentName(fromDeal)) return fromDeal;
  }
  const fallback = deal.documents.find(isOpenableCimDocument);
  if (fallback) return storedDocumentUrl(fallback) || null;
  const known = knownCimDriveFor(deal);
  return known ? driveViewUrl(known.fileId) : null;
}

export function attachKnownCimDriveUrl(deal: Deal) {
  let changed = false;
  const known = knownCimDriveFor(deal);
  const normalizedStored = persistableCimDriveUrl(deal.cimDriveUrl);
  if (normalizedStored && normalizedStored !== deal.cimDriveUrl) {
    deal.cimDriveUrl = normalizedStored;
    changed = true;
  }
  if (!persistableCimDriveUrl(deal.cimDriveUrl) && known) {
    deal.cimDriveUrl = driveViewUrl(known.fileId);
    changed = true;
  }
  const href = openCimUrl(deal);
  if (href && normalizeDriveViewUrl(href)) {
    const cimDoc = deal.documents.find(
      (document) =>
        document.category === "cim" &&
        !isDumpDocument(document) &&
        !storedDocumentUrl(document)
    );
    if (cimDoc) {
      cimDoc.url = href;
      changed = true;
    }
  }
  return changed;
}
