/**
 * DTO types shared between the Worker API and the React app.
 * These mirror the D1 schema (see migrations/0001_initial.sql) but are the
 * serialized shapes the API returns — not raw rows.
 */

// ---------- Public catalog ----------
export interface PublicProductSummary {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  gender: "mens" | "womens" | "unisex";
  category: string;
  basePriceCents: number;
  currency: string;
  availability: "draft" | "available" | "pre_order" | "sold_out" | "archived";
  imageUrl: string | null;
  imageAlt: string | null;
  collectionSlug: string | null;
}

export interface PublicCampaign {
  goalUnits: number;
  orderedUnits: number;
  maxUnits: number | null;
  cutoffDate: string | null;
  status: string;
}

export interface PublicSizeChart {
  unit: string;
  baseSize: string;
  sizes: string[];
  rows: { code: string; name: string; values: (number | null)[] }[];
}

export interface PublicProductDetail extends PublicProductSummary {
  /** Live pre-order campaign, when one exists. */
  campaign: PublicCampaign | null;
  /** Size chart computed from the linked style's production spec. */
  sizeChart: PublicSizeChart | null;
  description: string | null;
  editorialStory: string | null;
  fabricComposition: string | null;
  careSummary: string | null;
  originStatement: string | null;
  fitNotes: string | null;
  shippingNote: string | null;
  preOrderNote: string | null;
  images: { url: string; altText: string | null; colorwayName: string | null }[];
  variants: PublicVariant[];
  related: PublicProductSummary[];
}

export interface PublicVariant {
  id: string;
  colorwayName: string;
  size: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
  availableQty: number;
}

export interface PublicCollection {
  id: string;
  slug: string;
  name: string;
  season: string | null;
  description: string | null;
  editorialCopy: string | null;
  heroImageUrl: string | null;
}

export interface PublicJournalPost {
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd: string | null;
  heroImageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
}

export interface PublicPage {
  slug: string;
  title: string;
  bodyMd: string | null;
}

export interface PublicLookbook {
  slug: string;
  title: string;
  season: string | null;
  introCopy: string | null;
  images: {
    url: string;
    caption: string | null;
    productSlug: string | null;
    productName: string | null;
    productPriceCents: number | null;
  }[];
}

export interface BrandSettings {
  brandName: string;
  tagline: string;
  currency: string;
}

export type LeadKind =
  | "newsletter"
  | "waitlist"
  | "drop_notification"
  | "wholesale_inquiry"
  | "contact";

// ---------- Auth ----------
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

// ---------- Admin: product development ----------
export interface AdminStyle {
  id: string;
  styleCode: string;
  name: string;
  category: string;
  gender: string;
  season: string | null;
  collectionId: string | null;
  collectionName: string | null;
  status: string;
  description: string | null;
  fitNotes: string | null;
  fabricSummary: string | null;
  targetCostCents: number | null;
  targetRetailCents: number | null;
  currency: string;
  skuCount: number;
  hasTechPack: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSku {
  id: string;
  skuCode: string;
  styleId: string;
  styleName: string;
  colorwayName: string | null;
  size: string;
  status: string;
}

export interface AdminColorway {
  id: string;
  styleId: string;
  name: string;
  colorCode: string | null;
  isPrimary: boolean;
}

// ---------- Admin: commerce ----------
export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  styleId: string | null;
  collectionId: string | null;
  gender: string;
  category: string;
  basePriceCents: number;
  currency: string;
  availability: string;
  isPublished: boolean;
  variantCount: number;
  totalOnHand: number;
  updatedAt: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  email: string | null;
  customerName: string | null;
  totalCents: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  isPreOrder: boolean;
  shippingCountry: string | null;
  itemCount: number;
  placedAt: string | null;
  createdAt: string;
}

export interface AdminCustomer {
  id: string;
  email: string;
  name: string | null;
  country: string | null;
  stripeCustomerId: string | null;
  orderCount: number;
  totalSpentCents: number;
  createdAt: string;
}

export interface AdminInventoryRow {
  inventoryItemId: string;
  variantId: string;
  productName: string;
  colorwayName: string;
  size: string;
  skuCode: string | null;
  onHand: number;
  reserved: number;
  incoming: number;
  preOrderAllocated: number;
  lowStockThreshold: number;
  isLow: boolean;
}

// ---------- Admin: production ----------
export interface AdminSupplier {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  country: string | null;
  email: string | null;
  whatsapp: string | null;
  languages: string[];
  capabilities: string[];
  moqUnits: number | null;
  leadTimeDays: number | null;
  onTimeScore: number | null;
  qualityScore: number | null;
  isVerified: boolean;
  riskNotes: string | null;
  notes: string | null;
  contacts: AdminSupplierContact[];
}

export interface AdminSupplierContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  preferredLanguage: string | null;
}

export interface AdminSupplierInteraction {
  id: string;
  supplierId: string;
  kind: string;
  direction: string | null;
  subject: string | null;
  summary: string | null;
  followUpDue: string | null;
  needsResponse: boolean;
  createdAt: string;
}

export interface AdminProductionStage {
  id: string;
  name: string;
  sortOrder: number;
  description: string | null;
}

export interface AdminProductionTask {
  id: string;
  title: string;
  stageId: string | null;
  stageName: string | null;
  status: "todo" | "in_progress" | "blocked" | "done" | "cancelled";
  owner: string | null;
  styleId: string | null;
  styleName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  dueDate: string | null;
  riskFlag: boolean;
  notes: string | null;
}

export interface AdminCalendarEvent {
  id: string;
  title: string;
  kind: "milestone" | "window" | "deadline";
  stageId: string | null;
  stageName: string | null;
  startsOn: string;
  endsOn: string | null;
  notes: string | null;
}

export interface AdminSample {
  id: string;
  styleId: string;
  styleName: string;
  supplierName: string | null;
  round: number;
  kind: string;
  status: string;
  requestedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
}

export interface AdminProductionOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  currency: string;
  totalCostCents: number | null;
  exFactoryDate: string | null;
  incoterms: string | null;
  itemCount: number;
}

// ---------- Admin: tech packs ----------
export interface AdminTechPackSummary {
  id: string;
  code: string;
  name: string;
  styleId: string | null;
  styleName: string | null;
  version: number;
  status: string;
  season: string | null;
  source: string;
  updatedAt: string;
}

export interface AdminTechPackSection {
  id: string;
  kind: string;
  title: string;
  content: unknown;
  sortOrder: number;
}

export interface AdminTechPackDetail extends AdminTechPackSummary {
  summary: string | null;
  coverImageUrl: string | null;
  sections: AdminTechPackSection[];
  constructionNotes: {
    id: string;
    area: string;
    note: string;
    noteFr: string | null;
  }[];
  stitchDetails: {
    id: string;
    operation: string;
    stitchClass: string | null;
    spi: string | null;
    thread: string | null;
    note: string | null;
  }[];
  labelsPackaging: {
    id: string;
    item: string;
    placement: string | null;
    material: string | null;
    note: string | null;
  }[];
}

// ---------- Admin: costing ----------
export interface AdminCostSheet {
  id: string;
  styleId: string;
  styleName: string;
  name: string;
  currency: string;
  fabricCostCents: number;
  trimCostCents: number;
  cutSewMakeCents: number;
  sampleAllocationCents: number;
  packagingCents: number;
  freightCents: number;
  insuranceCents: number;
  dutyCents: number;
  paymentProcessingCents: number;
  returnsReserveCents: number;
  targetRetailCents: number | null;
  actualRetailCents: number | null;
  totalCostCents: number;
  grossMarginPct: number | null;
  scenarios: AdminLandedCostScenario[];
}

export interface AdminLandedCostScenario {
  id: string;
  name: string;
  destinationRegion: string;
  dutyRateUsed: number;
  landedCostCents: number | null;
  retailPriceCents: number | null;
  grossMarginPct: number | null;
  notes: string | null;
}

export interface AdminDutyRule {
  id: string;
  name: string;
  destinationRegion: string;
  originCountry: string;
  hsCategory: string | null;
  qualifiesCondition: string | null;
  dutyRateMin: number;
  dutyRateMax: number;
  isPreferential: boolean;
  isActive: boolean;
  disclaimer: string;
}

// ---------- Admin: AI / bridges ----------
export interface AdminAiPrompt {
  id: string;
  name: string;
  category: string;
  targetTool: string;
  promptText: string;
  version: number;
  isPreset: boolean;
  notes: string | null;
}

export interface AdminAiConcept {
  id: string;
  title: string;
  brief: string | null;
  promptId: string | null;
  styleId: string | null;
  styleName: string | null;
  status: string;
  rating: number | null;
  tags: string[];
  createdAt: string;
}

export interface AdminClo3dProject {
  id: string;
  name: string;
  styleId: string | null;
  styleName: string | null;
  status: string;
  tool: string;
  notes: string | null;
  updatedAt: string;
}

export interface AdminFile {
  id: string;
  r2Key: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  entityType: string | null;
  entityId: string | null;
  isPublic: boolean;
  createdAt: string;
}

// ---------- Admin: dashboard ----------
export interface DashboardSummary {
  revenueCents: number;
  currency: string;
  orderCount: number;
  paidOrderCount: number;
  openSampleCount: number;
  lateTaskCount: number;
  lowStockCount: number;
  stylesMissingTechPack: number;
  stylesWithMarginRisk: number;
  pendingFactoryResponses: number;
  productionStageCounts: { stage: string; count: number }[];
  upcomingMilestones: { title: string; startsOn: string; kind: string }[];
}

// ---------- API envelope ----------
export interface ApiError {
  error: string;
  details?: unknown;
}
