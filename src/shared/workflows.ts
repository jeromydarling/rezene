/**
 * The vocabulary of the no-code Workflow Builder — shared by the worker engine
 * (which validates and runs) and the admin UI (which renders the dropdowns).
 * A workflow is: WHEN <trigger>, IF <conditions>, THEN <actions>.
 *
 * Triggers are real shop events already on the event spine (see services/
 * activity.ts emit sites). Conditions filter on the fields that event carries.
 * Actions are create-only, so a workflow can never edit or destroy — the worst
 * it can do is file a task you delete.
 */

export interface TriggerField {
  key: string; // matches a key in the event payload
  label: string;
  type: "string" | "number";
}

export interface WorkflowTrigger {
  event: string; // event kind
  label: string; // "When a commission changes stage"
  noun: string; // for sentence previews
  fields: TriggerField[];
  /** Event carries a clientId → client-scoped actions are available. */
  hasClient?: boolean;
}

export const WORKFLOW_TRIGGERS: WorkflowTrigger[] = [
  {
    event: "client.created",
    label: "A new client is added",
    noun: "a new client is added",
    hasClient: true,
    fields: [{ key: "name", label: "Client name", type: "string" }],
  },
  {
    event: "commission.stage_changed",
    label: "A commission changes stage",
    noun: "a commission changes stage",
    hasClient: true,
    fields: [
      { key: "stage", label: "New stage (key)", type: "string" },
      { key: "stageLabel", label: "New stage (name)", type: "string" },
      { key: "title", label: "Commission title", type: "string" },
      { key: "clientName", label: "Client name", type: "string" },
    ],
  },
  {
    event: "deposit.paid",
    label: "A payment is marked paid",
    noun: "a payment is marked paid",
    hasClient: true,
    fields: [
      { key: "label", label: "Payment label", type: "string" },
      { key: "amountCents", label: "Amount (in cents)", type: "number" },
    ],
  },
  {
    event: "product.published",
    label: "A product is published",
    noun: "a product is published",
    fields: [{ key: "name", label: "Product name", type: "string" }],
  },
  {
    event: "inventory.low",
    label: "A product runs low on stock",
    noun: "a product runs low",
    fields: [{ key: "name", label: "Product name", type: "string" }],
  },
  {
    event: "inventory.restocked",
    label: "A product is restocked",
    noun: "a product is restocked",
    fields: [{ key: "name", label: "Product name", type: "string" }],
  },
  {
    event: "inventory.sold_out",
    label: "A product sells out",
    noun: "a product sells out",
    fields: [{ key: "name", label: "Product name", type: "string" }],
  },
  {
    event: "review.created",
    label: "A customer leaves a review",
    noun: "a customer leaves a review",
    fields: [
      { key: "productName", label: "Product name", type: "string" },
      { key: "rating", label: "Star rating", type: "number" },
    ],
  },
  {
    event: "research.trend_adopted",
    label: "A trend is adopted into the studio",
    noun: "a trend is adopted",
    fields: [{ key: "trendTitle", label: "Trend title", type: "string" }],
  },
  {
    event: "sample.approved",
    label: "A sample is approved",
    noun: "a sample is approved",
    fields: [{ key: "styleName", label: "Style name", type: "string" }],
  },
];

export function triggerByEvent(event: string): WorkflowTrigger | undefined {
  return WORKFLOW_TRIGGERS.find((t) => t.event === event);
}

export const CONDITION_OPS = [
  { op: "equals", label: "is" },
  { op: "not_equals", label: "is not" },
  { op: "contains", label: "contains" },
  { op: "gt", label: "is greater than" },
  { op: "lt", label: "is less than" },
] as const;

export type ConditionOp = (typeof CONDITION_OPS)[number]["op"];

export interface WorkflowCondition {
  field: string;
  op: ConditionOp;
  value: string;
}

export interface ActionParam {
  key: string;
  label: string;
  kind: "text" | "longtext" | "number";
  placeholder?: string;
  optional?: boolean;
}

export interface WorkflowActionDef {
  type: string;
  label: string;
  help: string;
  /** Needs the trigger to carry a clientId. */
  needsClient?: boolean;
  /** Needs an external network path (AI / webhook) — offered, degrades cleanly. */
  needsNetwork?: boolean;
  params: ActionParam[];
}

export const WORKFLOW_ACTIONS: WorkflowActionDef[] = [
  {
    type: "create_task",
    label: "Create a task",
    help: "Files a to-do on your Production board. Use {field} to drop in details from the trigger, e.g. {clientName}.",
    params: [
      { key: "title", label: "Task title", kind: "text", placeholder: "Follow up with {clientName}" },
      { key: "dueInDays", label: "Due in (days)", kind: "number", placeholder: "7", optional: true },
    ],
  },
  {
    type: "activity_note",
    label: "Post a note to your activity feed",
    help: "Drops a heads-up line in your activity feed. Nothing else happens — a gentle nudge.",
    params: [{ key: "title", label: "Note", kind: "text", placeholder: "Say hello to {clientName}" }],
  },
  {
    type: "timeline_note",
    label: "Add a note to the client's timeline",
    help: "Writes a note onto the client's timeline in the Client Book.",
    needsClient: true,
    params: [{ key: "subject", label: "Note", kind: "text", placeholder: "Reached a milestone" }],
  },
  {
    type: "draft_client_message",
    label: "Draft a message to the client",
    help: "Verto writes a warm note in your voice and files it in the client's outbox to review and send. Never sends on its own.",
    needsClient: true,
    needsNetwork: true,
    params: [
      {
        key: "situation",
        label: "What it's about",
        kind: "longtext",
        placeholder: "Their piece is ready to collect — invite them to come in.",
      },
    ],
  },
  {
    type: "webhook",
    label: "Send to a webhook (Zapier, Make, your own)",
    help: "POSTs the event's details as JSON to a URL you paste — the bridge to Zapier, Make, or any tool that accepts a webhook. Connect Gmail, Sheets, Slack and more without leaving Verto.",
    needsNetwork: true,
    params: [
      { key: "url", label: "Webhook URL", kind: "text", placeholder: "https://hooks.zapier.com/hooks/catch/…" },
    ],
  },
];

export function actionByType(type: string): WorkflowActionDef | undefined {
  return WORKFLOW_ACTIONS.find((a) => a.type === type);
}

export interface WorkflowAction {
  type: string;
  params: Record<string, string>;
}
