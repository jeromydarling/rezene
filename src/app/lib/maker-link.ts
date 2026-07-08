// Deep link into Maker Messages, pre-scoped to a sample / PO / tech pack.
// MessagesPage reads these params and opens a context-scoped compose.

export type MakerContextType = "sample" | "po" | "tech_pack";

export function makerMessageHref(opts: {
  supplierId: string;
  supplierName?: string | null;
  contextType?: MakerContextType;
  contextId?: string;
  contextLabel?: string;
  draft?: string;
}): string {
  const p = new URLSearchParams({ supplier: opts.supplierId });
  if (opts.supplierName) p.set("supplierName", opts.supplierName);
  if (opts.contextType) p.set("ctxType", opts.contextType);
  if (opts.contextId) p.set("ctxId", opts.contextId);
  if (opts.contextLabel) p.set("ctxLabel", opts.contextLabel);
  if (opts.draft) p.set("draft", opts.draft);
  return `/admin/messages?${p.toString()}`;
}
