export type EvidenceKind =
  | "VERIFIED"
  | "SELLER_PROVIDED"
  | "AI_CALCULATION"
  | "ASSUMPTION"
  | "NOT_PROVIDED"
  | "CONFLICT"
  | "ESTIMATE"
  | "EXTERNAL_RESEARCH";

export type TrafficLight = "green" | "yellow" | "red" | "critical";

export type PipelineStatus =
  | "imported"
  | "screening"
  | "screened"
  | "nda_requested"
  | "waiting_packet"
  | "packet_review"
  | "diligence"
  | "loi"
  | "financing"
  | "closing"
  | "acquired"
  | "passed";

export type PreNdaDecision = "REQUEST_NDA" | "MAYBE" | "PASS";
export type PacketDecision =
  | "ADVANCE_LOI"
  | "ASK_FOLLOWUP"
  | "RENEGOTIATE"
  | "PASS";
export type FinalDecision =
  | "STRONG BUY"
  | "BUY SUBJECT TO CONDITIONS"
  | "CONTINUE DILIGENCE"
  | "RENEGOTIATE"
  | "PASS";

export type Role =
  | "CPA"
  | "Attorney"
  | "Financial Planner"
  | "Financial Diligence"
  | "Operator";

export type BusinessCategory =
  | "Gas / C-store"
  | "Car wash"
  | "RV / MH park"
  | "Laundromat / lube"
  | "Plastic / injection molding"
  | "Metal / fabrication / machine shop"
  | "Painting / coatings"
  | "Construction / trades"
  | "Trucking / logistics"
  | "Distribution / wholesale"
  | "Industrial equipment / manufacturing other"
  | "Other"
  | "Unknown";

export type OperatingStyle = "Hands-off" | "Hands-on" | "Mixed";
export type RiskSnapshot = "Safer" | "Mixed" | "Riskier" | "Unknown";
export type AssetProfile = "Asset-heavy" | "Asset-light" | "Unknown";
export type BoxFit =
  | "In-box"
  | "Stretch"
  | "Too small"
  | "Too big"
  | "Unknown";
export type EarningsQuality = "Tax-tied" | "Recast" | "Unverified";
export type RecordTag = "Live" | "Seed / Demo";

export interface BoardSubScore {
  score: number;
  why: string;
  unknown: boolean;
}

export interface BoardScores {
  average: number;
  financials: BoardSubScore;
  owner: BoardSubScore;
  growth: BoardSubScore;
  handsOff: BoardSubScore;
  safety: BoardSubScore;
  assets: BoardSubScore;
}

export interface Fact<T = string | number | boolean | null> {
  value: T;
  kind: EvidenceKind;
  note?: string;
  documentId?: string;
  page?: string;
  sheet?: string;
  cell?: string;
  uploadedAt?: string;
  confidence?: number;
}

export interface EvidencePoint {
  label: string;
  listingValue?: string | null;
  packetValue?: string | null;
  taxValue?: string | null;
  kind: EvidenceKind;
  difference?: string;
  source?: string;
  documentId?: string;
  page?: number;
  sheet?: string;
  cell?: string;
}

export interface ScreeningQuestion {
  id: number;
  title: string;
  answer: string;
  why: string;
  known: string[];
  unknown: string[];
  next: string;
  details?: string;
  light: TrafficLight;
  kind: EvidenceKind;
}

export interface Prospect {
  company: string;
  industry: string;
  revenue?: string;
  location: string;
  whyFit: string;
  potentialOffering: string;
  fit: "High" | "Medium" | "Low";
  barrier?: string;
}

export type OwnerQuestionSection =
  | "business"
  | "customers"
  | "growth"
  | "capacity_assets"
  | "people_risk"
  | "industry_valuation"
  | "decision";

export type OwnerDecision =
  | "HIGH_PRIORITY_REQUEST_NDA"
  | "REQUEST_NDA"
  | "MAYBE"
  | "PASS";

export interface ResearchSource {
  id: string;
  title: string;
  url?: string;
  accessedAt: string;
  kind: "LISTING" | "COMPANY_WEBSITE" | "PUBLIC_SOURCE" | "INDUSTRY_SOURCE" | "SELLER_MATERIAL";
  excerpt?: string;
  query?: string;
}

export interface PublicResearch {
  status: "complete" | "unavailable" | "error";
  provider: "tavily" | "direct_only" | "none";
  searchedAt: string;
  reason?: string;
  companyWebsiteUrl?: string;
  sources: ResearchSource[];
}

export interface OwnerQuestion {
  id: number;
  section: OwnerQuestionSection;
  title: string;
  answer: string;
  result?: string;
  light: TrafficLight;
  kind: EvidenceKind;
  known: string[];
  unknown: string[];
  why: string;
  next: string;
  details?: string;
  sources: ResearchSource[];
}

export interface OwnerQuestionSectionResult {
  id: OwnerQuestionSection;
  title: string;
  questionIds: number[];
  light: TrafficLight;
  summary: string;
}

export interface OwnerQuestionReport {
  completedAt: string;
  status: "complete";
  questions: OwnerQuestion[];
  sections: OwnerQuestionSectionResult[];
  prospects: Prospect[];
  whatWeLike: string[];
  concerns: string[];
  unanswered: string[];
  score: number;
  decision: OwnerDecision;
  decisionWhy: string;
  researchStatus?: PublicResearch["status"];
  companyBrief?: string;
}

export interface EquipmentItem {
  name: string;
  manufacturer?: string;
  model?: string;
  year?: string;
  capability?: string;
  limitations?: string;
  utilization?: string;
  fmv?: number | null;
  replacementUsed?: number | null;
  replacementNew?: number | null;
  kind: EvidenceKind;
}

export interface Stage1Screening {
  researchedAt: string;
  researchMode: "listing_and_industry" | "ai_enriched";
  questions: ScreeningQuestion[];
  icp: string;
  prospects: Prospect[];
  valuationLabel: "Cheap" | "Reasonable" | "Expensive" | "Unknown";
  taxAttractiveness: "Low" | "Moderate" | "High";
  industryQuality: number;
  growthScore: number;
  assetsScore: number;
  preNdaScore: number;
  decision: PreNdaDecision;
  decisionWhy: string;
  whatWeKnow: string;
  whatWeDont: string;
  whyItMatters: string;
  whatNext: string;
}

export interface PacketReview {
  reviewedAt: string;
  score: number;
  decision: PacketDecision;
  decisionWhy: string;
  answers: Record<string, { answer: string; light: TrafficLight; kind: EvidenceKind }>;
  topQuestions: string[];
  fullDiligenceQuestions: string[];
  evidence: EvidencePoint[];
  whatWeKnow: string;
  whatWeDont: string;
  whyItMatters: string;
  whatNext: string;
  reasonsToBuy: string[];
  reasonsToPass: string[];
}

export interface FinancialLine {
  name: string;
  listing?: number | null;
  packet?: number | null;
  taxReturn?: number | null;
  gl?: number | null;
  normalized?: number | null;
  kind: EvidenceKind;
  note?: string;
}

export interface CustomerRow {
  name: string;
  revenue: number;
  share: number;
  tenure?: string;
  interviewQuestions?: string[];
  source?: {
    documentId: string;
    sheet?: string;
    cell?: string;
  };
}

export interface DiligencePack {
  analyzedAt: string;
  financials: FinancialLine[];
  sellerSde?: number | null;
  buyerSde?: number | null;
  normalizedEbitda?: number | null;
  questionableAddbacks: string[];
  customers: CustomerRow[];
  concentrationFlag: "HIGH" | "MEDIUM_HIGH" | "PREFERABLE" | "UNKNOWN";
  concentrationNote: string;
  customerInterviewQuestions: string[];
  equipment: EquipmentItem[];
  maxRevenueOnCurrentEquipment?: string;
  realEstateNotes: string;
  growthPlan: {
    keepSafe: string[];
    first100: string[];
    year1: string[];
    years2to3: string[];
    years4to5: string[];
  };
  scores: {
    financial: number;
    customer: number;
    operations: number;
    growth: number;
    assets: number;
    dealStructure: number;
    tax: number;
    legal: number;
    total: number;
  };
  finalDecision: FinalDecision;
  fatalRisks: string[];
  findings: {
    sellerClaims: string[];
    verifiedFacts: string[];
    inferences: string[];
    unanswered: string[];
  };
  recommendationWhy: string[];
  maxPrice: {
    value: number | null;
    basis: string;
    kind: EvidenceKind;
  };
  preferredStructure: string[];
  sellerProtections: string[];
  top10BeforeLoi: string[];
  top10BeforeClose: string[];
  walkTriggers: string[];
  exceptionalConditions: string[];
  whatWeKnow: string;
  whatWeDont: string;
  whyItMatters: string;
  whatNext: string;
}

export interface FinancingInputs {
  purchasePrice: number;
  buyerEquity: number;
  bankDebt: number;
  sbaDebt: number;
  realEstateDebt: number;
  sellerNote: number;
  equipmentFinancing: number;
  earnout: number;
  holdback: number;
  interestRate: number;
  termYears: number;
  sellerRate: number;
  sellerYears: number;
}

export interface FinancingResult {
  annualDebtService: number;
  dscr: number | null;
  cashAfterDebt: number | null;
  cashOnCash: number | null;
  equityRequired: number;
  notes: string[];
}

export interface TaxResult {
  structure: "asset" | "stock";
  year1Deductions: number | null;
  year5Deductions: number | null;
  year10Deductions: number | null;
  beforeTaxReturn: number | null;
  afterTaxReturn: number | null;
  permanentSavings: string[];
  deferralBenefits: string[];
  eligibilityChecks: {
    acquisitionEntityIdentity: "UNVERIFIED";
    section469PassiveActivity: "UNVERIFIED";
    taxBasis: "UNVERIFIED";
    atRiskLimitations: "UNVERIFIED";
  };
  canOffsetTesimIncome: "UNVERIFIED";
  propertyTreatment: string[];
  notes: string[];
  disclaimer: string;
}

export interface DownsideCase {
  name: string;
  ebitda: number;
  cashFlow: number;
  dscr: number | null;
  equityReturn: number | null;
  light: TrafficLight;
}

export interface DocumentRecord {
  id: string;
  dealId: string;
  name: string;
  category:
    | "listing"
    | "cim"
    | "financials"
    | "tax"
    | "customers"
    | "employees"
    | "equipment"
    | "real_estate"
    | "legal"
    | "other";
  stage: 1 | 2 | 3;
  uploadedAt: string;
  size: number;
  textExcerpt?: string;
  extraction?: DocumentExtraction;
}

export interface DocumentEvidenceChunk {
  text: string;
  page?: number;
  sheet?: string;
  cell?: string;
}

export interface ExtractedTableRow {
  rowNumber: number;
  values: Record<string, string | number | boolean | null>;
  cells: Record<string, string>;
}

export interface ExtractedTable {
  sheet: string;
  range: string;
  headers: string[];
  rows: ExtractedTableRow[];
}

export interface DocumentExtraction {
  status: "complete" | "failed" | "unsupported";
  extractedAt: string;
  error?: string;
  chunks: DocumentEvidenceChunk[];
  tables?: ExtractedTable[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  specialty: string;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export interface AssignedQuestion {
  id: string;
  question: string;
  assigneeId: string;
  status: "open" | "in_progress" | "done";
}

export interface Deal {
  id: string;
  batchId: string;
  name: string;
  listingUrl?: string;
  websiteUrl?: string;
  industry: string;
  businessCategory?: BusinessCategory;
  operatingStyleTags?: OperatingStyle[];
  riskSnapshot?: RiskSnapshot;
  assetProfile?: AssetProfile;
  boxFit?: BoxFit;
  earningsQuality?: EarningsQuality;
  recordTag?: RecordTag;
  boardScores?: BoardScores;
  location: string;
  state?: string;
  askingPrice?: number | null;
  revenue?: number | null;
  ebitda?: number | null;
  sde?: number | null;
  employees?: number | null;
  realEstateIncluded: boolean | null;
  ffe?: number | null;
  sellerFinancing: boolean | null;
  notes?: string;
  broker?: string;
  source?: string;
  status: PipelineStatus;
  researchStatus: "pending" | "running" | "complete" | "error";
  researchError?: string;
  createdAt: string;
  updatedAt: string;
  teamId?: string;
  publicResearch?: PublicResearch;
  ownerQuestions?: OwnerQuestionReport;
  screening?: Stage1Screening;
  packet?: PacketReview;
  diligence?: DiligencePack;
  financing?: { inputs: FinancingInputs; result: FinancingResult };
  tax?: TaxResult;
  downside?: DownsideCase[];
  documents: DocumentRecord[];
  assignedQuestions: AssignedQuestion[];
  fatalRisks: string[];
}

export interface Store {
  deals: Deal[];
  teams: Team[];
  batches: { id: string; name: string; createdAt: string; total: number }[];
}
