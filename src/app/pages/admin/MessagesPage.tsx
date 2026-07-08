import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState, LoadingTable } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast";

interface ThreadRow {
  supplierId: string;
  supplierName: string;
  supplierKind: string;
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
  messages: Msg[];
  configured: boolean;
}

const fmt = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z").toLocaleString() : "");

export function MessagesPage() {
  const toast = useToast();
  const inbox = useFetch<{ threads: ThreadRow[]; totalUnread: number }>("/api/admin/messages");
  const suppliers = useFetch<{ id: string; name: string }[]>("/api/admin/suppliers");
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);

  const loadThread = useCallback(async (supplierId: string) => {
    setLoadingThread(true);
    try {
      setThread(await api.get<ThreadDetail>(`/api/admin/messages/${supplierId}`));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadThread(selected);
  }, [selected, loadThread]);

  async function send() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const res = await api.post<{ emailed: boolean; hasEmail: boolean }>(`/api/admin/messages/${selected}`, {
        body: draft.trim(),
      });
      setDraft("");
      await loadThread(selected);
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

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Maker Messages"
        description="One logged conversation with each factory and supplier. You work here; they just reply to email. Every message — both ways — is kept on the record."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setPicking((p) => !p)}>
            New message
          </button>
        }
      />

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
                  setSelected(s.id);
                  setPicking(false);
                }}
              >
                {s.name}
              </button>
            ))}
            {(suppliers.data ?? []).length === 0 && (
              <p className="text-sm text-warmgrey">
                No suppliers yet — add one under Production → Factories & Suppliers.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Inbox list */}
        <div className="space-y-2">
          {inbox.loading && <LoadingTable rows={4} />}
          {!inbox.loading && threads.length === 0 && (
            <EmptyState title="No conversations yet" hint="Start one with “New message”." />
          )}
          {threads.map((t) => (
            <button
              key={t.supplierId}
              type="button"
              onClick={() => setSelected(t.supplierId)}
              className={`admin-card block w-full px-3 py-2.5 text-left transition ${
                selected === t.supplierId ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
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
              <p className="truncate text-xs text-warmgrey">
                {t.lastFrom === "supplier" ? "↩ " : ""}
                {t.snippet ?? "—"}
              </p>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="admin-card flex min-h-[520px] flex-col p-0">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-warmgrey">
              Pick a conversation, or start a new one.
            </div>
          ) : loadingThread && !thread ? (
            <div className="p-5">
              <LoadingTable rows={4} />
            </div>
          ) : thread ? (
            <>
              <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
                <div>
                  <p className="font-display text-lg font-light">{thread.supplier.name}</p>
                  <p className="text-xs text-warmgrey">
                    {thread.supplier.email ?? "no email on file"} · {thread.supplier.kind.replace("_", " ")}
                  </p>
                </div>
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
                        {m.context && (
                          <p className={`mb-1 text-[10px] uppercase tracking-wider ${mine ? "text-chalk/60" : "text-warmgrey"}`}>
                            {m.context}
                          </p>
                        )}
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
                  Two-way email isn't switched on yet — messages are recorded, and the maker's replies will flow in
                  once <code>MAKER_INBOUND_DOMAIN</code> is configured. Ask your platform admin.
                </p>
              )}

              <div className="border-t border-ink/10 p-3">
                <textarea
                  className="input min-h-[70px] w-full text-sm"
                  placeholder={`Message ${thread.supplier.name}…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-warmgrey">⌘/Ctrl + Enter to send</span>
                  <button type="button" className="btn btn-primary" disabled={sending || !draft.trim()} onClick={() => void send()}>
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
