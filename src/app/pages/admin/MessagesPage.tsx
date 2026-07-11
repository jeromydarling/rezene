import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState, LoadingTable } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";
import { MessageDecoder } from "../../components/MessageDecoder";

interface ThreadRow {
  threadId: string;
  supplierId: string;
  supplierName: string;
  supplierKind: string;
  contextType: string | null;
  contextLabel: string | null;
  unread: number;
  lastAt: string | null;
  snippet: string | null;
  lastFrom: string | null;
}
interface Msg {
  id: string;
  authorKind: "shop" | "supplier";
  authorName: string | null;
  body: string;
  via: string;
  context: string | null;
  createdAt: string;
}
interface ThreadDetail {
  supplier: { id: string; name: string; email: string | null; kind: string };
  context: { type: string; label: string | null } | null;
  messages: Msg[];
  configured: boolean;
}
interface Ctx {
  type: string;
  id: string;
  label: string;
}
type View =
  | { kind: "thread"; threadId: string }
  | { kind: "compose"; supplierId: string; supplierName: string; context: Ctx | null }
  | null;

const fmt = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z").toLocaleString() : "");

export function MessagesPage() {
  const toast = useToast();
  const inbox = useFetch<{ threads: ThreadRow[]; configured: boolean }>("/api/admin/messages");
  const suppliers = useFetch<{ id: string; name: string }[]>("/api/admin/suppliers");
  const [view, setView] = useState<View>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);

  // Deep link from a sample / PO / tech pack: open a context-scoped compose.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const supplierId = p.get("supplier");
    if (!supplierId) return;
    const type = p.get("ctxType");
    setView({
      kind: "compose",
      supplierId,
      supplierName: p.get("supplierName") || "Supplier",
      context: type ? { type, id: p.get("ctxId") || "", label: p.get("ctxLabel") || "" } : null,
    });
    if (p.get("draft")) setDraft(p.get("draft")!);
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    setLoadingThread(true);
    try {
      setThread(await api.get<ThreadDetail>(`/api/admin/messages/${threadId}`));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (view?.kind === "thread") void loadThread(view.threadId);
    else setThread(null);
  }, [view, loadThread]);

  async function send() {
    if (!view || !draft.trim()) return;
    setSending(true);
    try {
      let res: { emailed: boolean; hasEmail: boolean; threadId?: string };
      if (view.kind === "thread") {
        res = await api.post(`/api/admin/messages/${view.threadId}`, { body: draft.trim() });
      } else {
        res = await api.post(`/api/admin/messages/start`, {
          supplierId: view.supplierId,
          contextType: view.context?.type,
          contextId: view.context?.id,
          contextLabel: view.context?.label,
          body: draft.trim(),
        });
        if (res.threadId) setView({ kind: "thread", threadId: res.threadId });
      }
      setDraft("");
      if (view.kind === "thread") await loadThread(view.threadId);
      inbox.reload();
      toast.success(
        res.emailed ? "Sent" : "Saved",
        res.emailed
          ? "Emailed to the maker — their reply lands right here."
          : res.hasEmail
            ? "Recorded. Email sending isn't switched on yet, so the maker wasn't notified."
            : "Recorded. Add an email on this supplier to actually reach them.",
      );
    } catch (e) {
      toast.error("Couldn't send", e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  }

  const threads = inbox.data?.threads ?? [];
  const supplierName = suppliers.data?.find((s) => view?.kind === "compose" && s.id === view.supplierId)?.name;

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Maker Messages"
        description="One logged conversation per factory or supplier — and one per sample, PO, or tech pack when you need it. You work here; they just reply to email."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setPicking((v) => !v)}>
            New message
          </button>
        }
      />
      <div className="mb-4 flex justify-end">
        <MessageDecoder defaultKind="maker" />
      </div>

      {picking && (
        <div className="admin-card mb-4 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-warmgrey">Message a supplier</p>
          <div className="flex flex-wrap gap-2">
            {(suppliers.data ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                className="rounded-full border border-ink/15 px-3 py-1 text-sm hover:border-navy"
                onClick={() => {
                  setView({ kind: "compose", supplierId: s.id, supplierName: s.name, context: null });
                  setPicking(false);
                }}
              >
                {s.name}
              </button>
            ))}
            {(suppliers.data ?? []).length === 0 && (
              <p className="text-sm text-warmgrey">Add a supplier under Production → Factories & Suppliers first.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Inbox */}
        <div className="space-y-2">
          {inbox.loading && <LoadingTable rows={4} />}
          {!inbox.loading && threads.length === 0 && (
            <EmptyState title="No conversations yet" hint="Start one with “New message”." />
          )}
          {threads.map((t) => (
            <button
              key={t.threadId}
              type="button"
              onClick={() => setView({ kind: "thread", threadId: t.threadId })}
              className={`admin-card block w-full px-3 py-2.5 text-left transition ${
                view?.kind === "thread" && view.threadId === t.threadId ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.supplierName}</span>
                {t.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-terracotta px-1.5 py-0.5 text-[10px] font-semibold text-chalk">
                    {t.unread}
                  </span>
                )}
              </div>
              {t.contextLabel && (
                <span className="mt-0.5 inline-block rounded bg-navy/8 px-1.5 py-0.5 text-[10px] text-navy">
                  {t.contextLabel}
                </span>
              )}
              <p className="truncate text-xs text-warmgrey">
                {t.lastFrom === "supplier" ? "↩ " : ""}
                {t.snippet ?? "—"}
              </p>
            </button>
          ))}
        </div>

        {/* Conversation */}
        <div className="admin-card flex min-h-[520px] flex-col p-0">
          {!view ? (
            <div className="flex flex-1 items-center justify-center text-sm text-warmgrey">
              Pick a conversation, or start a new one.
            </div>
          ) : view.kind === "compose" ? (
            <>
              <div className="border-b border-ink/10 px-5 py-3">
                <p className="font-display text-lg font-light">{supplierName ?? view.supplierName}</p>
                {view.context?.label ? (
                  <span className="inline-block rounded bg-navy/8 px-1.5 py-0.5 text-[11px] text-navy">
                    {view.context.label}
                  </span>
                ) : (
                  <p className="text-xs text-warmgrey">New conversation</p>
                )}
              </div>
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-warmgrey">
                Write the first message below.
              </div>
              <Composer
                draft={draft}
                setDraft={setDraft}
                sending={sending}
                onSend={send}
                placeholder={`Message ${supplierName ?? view.supplierName}…`}
              />
            </>
          ) : loadingThread && !thread ? (
            <div className="p-5">
              <LoadingTable rows={4} />
            </div>
          ) : thread ? (
            <>
              <div className="border-b border-ink/10 px-5 py-3">
                <p className="font-display text-lg font-light">{thread.supplier.name}</p>
                <p className="text-xs text-warmgrey">
                  {thread.context?.label ? (
                    <span className="mr-2 rounded bg-navy/8 px-1.5 py-0.5 text-navy">{thread.context.label}</span>
                  ) : null}
                  {thread.supplier.email ?? "no email on file"} · {thread.supplier.kind.replace("_", " ")}
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {thread.messages.length === 0 && (
                  <p className="text-center text-sm text-warmgrey">No messages yet — say hello below.</p>
                )}
                {thread.messages.map((m) => {
                  const mine = m.authorKind === "shop";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          mine ? "bg-navy text-chalk" : "border border-ink/10 bg-cream/60"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-chalk/55" : "text-warmgrey/70"}`}>
                          {m.authorName ?? (mine ? "You" : thread.supplier.name)} · {fmt(m.createdAt)}
                          {m.via === "email" ? " · via email" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!thread.configured && (
                <p className="border-t border-amber-200 bg-amber-50 px-5 py-2 text-[11px] text-amber-700">
                  Two-way email isn't switched on yet — messages are recorded, and maker replies flow in once{" "}
                  <code>MAKER_INBOUND_DOMAIN</code> is configured.
                </p>
              )}
              <Composer
                draft={draft}
                setDraft={setDraft}
                sending={sending}
                onSend={send}
                placeholder={`Message ${thread.supplier.name}…`}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  sending,
  onSend,
  placeholder,
}: {
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  placeholder: string;
}) {
  return (
    <div className="border-t border-ink/10 p-3">
      <textarea
        className="input min-h-[70px] w-full text-sm"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend();
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-warmgrey">⌘/Ctrl + Enter to send</span>
        <button type="button" className="btn btn-primary" disabled={sending || !draft.trim()} onClick={onSend}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
