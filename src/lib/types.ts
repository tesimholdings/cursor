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
  | "STRONG_BUY"
  | "BUY_CONDITIONS"
  | "CONTINUE"
  | "RENEGOTIATE"
  | "PASS";

export type Role =
  | "CPA"
  | "Attorney"
  | "Financial Planner"
  | "Financial Diligence"
  | "Operator";

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
    financing: number;
    tax: number;
    legal: number;
    total: number;
  };
  finalDecision: FinalDecision;
  fatalRisks: string[];
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
  year1Deductions: number;
  year5Deductions: number;
  year10Deductions: number;
  beforeTaxReturn: number | null;
  afterTaxReturn: number | null;
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
  industry: string;
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
