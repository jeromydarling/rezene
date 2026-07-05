import { z } from "zod";
import type { Context } from "hono";

/**
 * Zod schemas for request bodies + a parse helper that returns a typed body
 * or throws an HTTP 400 with field-level details.
 */

export class ValidationError extends Error {
  constructor(public details: unknown) {
    super("Validation failed");
  }
}

export async function parseBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError({ body: "Expected a JSON body" });
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError(result.error.flatten());
  return result.data;
}

// ---------- Auth ----------
export const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(8).max(200),
});

// ---------- Leads / public forms ----------
export const leadSchema = z.object({
  kind: z.enum(["newsletter", "waitlist", "drop_notification", "wholesale_inquiry", "contact"]),
  email: z.string().email().max(200),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  message: z.string().max(4000).optional(),
  productId: z.string().max(80).optional(),
  sourcePath: z.string().max(300).optional(),
});

export const analyticsEventSchema = z.object({
  event: z.enum([
    "page_view",
    "product_view",
    "add_to_cart",
    "checkout_started",
    "checkout_completed",
    "email_signup",
    "concept_created",
    "tech_pack_created",
    "production_stage_changed",
    "sample_approved",
    "order_fulfilled",
  ]),
  sessionKey: z.string().max(80).optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(80).optional(),
  path: z.string().max(300).optional(),
  referrer: z.string().max(500).optional(),
  properties: z.record(z.unknown()).optional(),
});

// ---------- Styles / SKUs ----------
export const styleCreateSchema = z.object({
  styleCode: z.string().min(3).max(40),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  gender: z.enum(["mens", "womens", "unisex"]),
  season: z.string().max(20).optional(),
  collectionId: z.string().max(80).nullable().optional(),
  status: z
    .enum(["concept", "design", "tech_pack", "sampling", "approved", "production", "discontinued"])
    .optional(),
  description: z.string().max(4000).optional(),
  fitNotes: z.string().max(2000).optional(),
  fabricSummary: z.string().max(1000).optional(),
  targetCostCents: z.number().int().nonnegative().nullable().optional(),
  targetRetailCents: z.number().int().nonnegative().nullable().optional(),
});
export const styleUpdateSchema = styleCreateSchema.partial();

export const skuCreateSchema = z.object({
  skuCode: z.string().min(3).max(60),
  styleId: z.string().min(1).max(80),
  colorwayId: z.string().max(80).nullable().optional(),
  size: z.string().min(1).max(20),
});

export const colorwayCreateSchema = z.object({
  name: z.string().min(1).max(80),
  colorCode: z.string().max(20).optional(),
  isPrimary: z.boolean().optional(),
});

// ---------- Products ----------
export const productUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).nullable().optional(),
  description: z.string().max(8000).nullable().optional(),
  editorialStory: z.string().max(8000).nullable().optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  availability: z.enum(["draft", "available", "pre_order", "sold_out", "archived"]).optional(),
  isPublished: z.boolean().optional(),
  preOrderNote: z.string().max(1000).nullable().optional(),
  shippingNote: z.string().max(1000).nullable().optional(),
  fitNotes: z.string().max(2000).nullable().optional(),
});

// ---------- Suppliers ----------
export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(["factory", "fabric_mill", "trim_supplier", "service", "logistics"]).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(10).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  website: z.string().max(300).optional(),
  languages: z.array(z.string().max(10)).optional(),
  capabilities: z.array(z.string().max(60)).optional(),
  moqUnits: z.number().int().nonnegative().nullable().optional(),
  leadTimeDays: z.number().int().nonnegative().nullable().optional(),
  riskNotes: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  isVerified: z.boolean().optional(),
});
export const supplierUpdateSchema = supplierCreateSchema.partial();

export const supplierInteractionSchema = z.object({
  kind: z.enum(["email", "call", "whatsapp", "visit", "quote", "sample_feedback", "other"]),
  direction: z.enum(["outbound", "inbound"]).optional(),
  subject: z.string().max(300).optional(),
  summary: z.string().max(4000).optional(),
  followUpDue: z.string().max(30).optional(),
  needsResponse: z.boolean().optional(),
});

// ---------- Production ----------
export const taskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  stageId: z.string().max(80).nullable().optional(),
  status: z.enum(["todo", "in_progress", "blocked", "done", "cancelled"]).optional(),
  owner: z.string().max(120).nullable().optional(),
  styleId: z.string().max(80).nullable().optional(),
  supplierId: z.string().max(80).nullable().optional(),
  dueDate: z.string().max(30).nullable().optional(),
  riskFlag: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
});
export const taskUpdateSchema = taskCreateSchema.partial();

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(300),
  kind: z.enum(["milestone", "window", "deadline"]).optional(),
  stageId: z.string().max(80).nullable().optional(),
  startsOn: z.string().min(8).max(30),
  endsOn: z.string().max(30).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const sampleCreateSchema = z.object({
  styleId: z.string().min(1).max(80),
  supplierId: z.string().max(80).nullable().optional(),
  round: z.number().int().positive().optional(),
  kind: z.enum(["proto", "fit", "sms", "pp", "top"]).optional(),
  status: z
    .enum([
      "requested",
      "in_progress",
      "shipped",
      "received",
      "in_review",
      "revisions_needed",
      "approved",
      "rejected",
    ])
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
});
export const sampleUpdateSchema = sampleCreateSchema.partial();

// ---------- Tech packs ----------
export const techPackCreateSchema = z.object({
  name: z.string().min(1).max(200),
  styleId: z.string().max(80).nullable().optional(),
  season: z.string().max(20).optional(),
  source: z.enum(["blank", "style", "photo", "prompt", "ai_concept", "previous_version"]).optional(),
  summary: z.string().max(2000).optional(),
});

export const techPackSectionUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.unknown().optional(),
});

// ---------- AI ----------
export const aiPromptCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  targetTool: z.enum(["claude", "midjourney", "firefly", "dalle", "clo3d", "other"]).optional(),
  promptText: z.string().min(1).max(8000),
  notes: z.string().max(2000).optional(),
});

export const aiConceptCreateSchema = z.object({
  title: z.string().min(1).max(200),
  brief: z.string().max(4000).optional(),
  promptId: z.string().max(80).nullable().optional(),
  styleId: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().max(40)).optional(),
});
export const aiConceptUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  brief: z.string().max(4000).nullable().optional(),
  status: z
    .enum(["exploring", "shortlisted", "converted_to_style", "converted_to_tech_pack", "archived"])
    .optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  tags: z.array(z.string().max(40)).optional(),
});

// ---------- 3D ----------
export const clo3dProjectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  styleId: z.string().max(80).nullable().optional(),
  tool: z.enum(["clo3d", "browzwear", "style3d", "other"]).optional(),
  notes: z.string().max(4000).optional(),
});
export const clo3dProjectUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z
    .enum(["not_started", "pattern_needed", "in_simulation", "fit_review", "approved"])
    .optional(),
  measurementsJson: z.string().max(20000).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

// ---------- Inventory ----------
export const inventoryAdjustSchema = z.object({
  inventoryItemId: z.string().min(1).max(80),
  kind: z.enum(["receive", "sell", "reserve", "release", "return", "damage", "adjust", "preorder_allocate"]),
  quantity: z.number().int(),
  note: z.string().max(1000).optional(),
});

// ---------- Cost sheets ----------
const cents = z.number().int().min(0).max(100_000_000);
export const costSheetUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  fabricCostCents: cents.optional(),
  trimCostCents: cents.optional(),
  cutSewMakeCents: cents.optional(),
  sampleAllocationCents: cents.optional(),
  packagingCents: cents.optional(),
  freightCents: cents.optional(),
  insuranceCents: cents.optional(),
  dutyCents: cents.optional(),
  paymentProcessingCents: cents.optional(),
  returnsReserveCents: cents.optional(),
  targetRetailCents: cents.nullable().optional(),
  actualRetailCents: cents.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ---------- Duty rules ----------
export const dutyRuleUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  qualifiesCondition: z.string().max(2000).nullable().optional(),
  dutyRateMin: z.number().min(0).max(2).optional(),
  dutyRateMax: z.number().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
});

// ---------- Settings ----------
export const settingsUpdateSchema = z.record(z.string().max(2000));

// ---------- CMS content ----------
const slugField = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only");

export const pageCreateSchema = z.object({
  slug: slugField,
  title: z.string().min(1).max(200),
  bodyMd: z.string().max(60000).optional(),
  isPublished: z.boolean().optional(),
});
export const pageUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyMd: z.string().max(60000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const journalCreateSchema = z.object({
  slug: slugField,
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional(),
  bodyMd: z.string().max(60000).optional(),
  author: z.string().max(120).optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  publishedAt: z.string().max(30).nullable().optional(),
  isPublished: z.boolean().optional(),
});
export const journalUpdateSchema = journalCreateSchema.partial().omit({ slug: true });

export const collectionUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  season: z.string().max(20).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  editorialCopy: z.string().max(8000).nullable().optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

export const lookbookUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  season: z.string().max(20).nullable().optional(),
  introCopy: z.string().max(4000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const lookbookImageCreateSchema = z.object({
  imageUrl: z.string().min(1).max(500),
  caption: z.string().max(300).optional(),
});
export const lookbookImageUpdateSchema = z.object({
  caption: z.string().max(300).nullable().optional(),
  sortOrder: z.number().int().optional(),
});
