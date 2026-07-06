import { useState, type FormEvent } from "react";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import { MarketingGraphic } from "../../components/admin/MarketingGraphic";
import type { AdminProduct } from "../../../shared/types";

/**
 * Marketing suite: campaigns → AI-written multi-channel kits (social,
 * email, blog, press, ads), a lightweight posting calendar, brand-styled
 * graphics, subscriber email sends, and SEO content ideas.
 */

interface CampaignRow {
  id: string;
  name: string;
  objective: string;
  subject: string | null;
  key_message: string | null;
  audience: string | null;
  product_id: string | null;
  collection_id: string | null;
  product_name: string | null;
  collection_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  asset_count: number;
  posted_count: number;
  next_scheduled: string | null;
}

interface AssetRow {
  id: string;
  channel: string;
  kind: string;
  title: string | null;
  content: string;
  meta_json: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
}

interface ChannelOption {
  channel: string;
  label: string;
}

const OBJECTIVES = ["launch", "drop", "sale", "seasonal", "evergreen", "press"];

export function MarketingPage() {
  const { data, loading, error, reload } = useFetch<CampaignRow[]>("/api/admin/marketing/campaigns");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [graphicsOpen, setGraphicsOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const selected = data?.find((cp) => cp.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Marketing"
        title="Campaigns"
        description="Describe a campaign once — AI writes the whole kit in your brand voice: social posts, email, blog draft, press release, ad copy. Edit, schedule, send. Uses your Anthropic key when set, otherwise built-in Llama."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIdeasOpen(true)}>
              Content ideas
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setGraphicsOpen(true)}>
              Graphics studio
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              New campaign
            </button>
          </>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && (
        <>
          <UpcomingStrip />
          {data.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              hint="Start with your next drop, a seasonal push, or an evergreen brand campaign — the kit takes about a minute to generate."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                  Create the first campaign
                </button>
              }
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
              <div className="space-y-1.5">
                {data.map((campaign) => (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedId(campaign.id)}
                    className={`admin-card w-full p-3 text-left transition-colors ${
                      selectedId === campaign.id ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{campaign.name}</p>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p className="text-xs text-warmgrey">
                      {titleCase(campaign.objective)} · {campaign.posted_count}/{campaign.asset_count} posted
                      {campaign.next_scheduled && ` · next ${formatDate(campaign.next_scheduled)}`}
                    </p>
                  </button>
                ))}
              </div>
              <div>
                {selected ? (
                  <CampaignDetail key={selected.id} campaign={selected} onChanged={reload} />
                ) : (
                  <EmptyState title="Pick a campaign" hint="Generate its kit, edit each piece, schedule, and send." />
                )}
              </div>
            </div>
          )}
        </>
      )}
      <SlideOver open={createOpen} title="New campaign" onClose={() => setCreateOpen(false)}>
        <CampaignCreateForm
          onCreated={(id) => {
            setCreateOpen(false);
            setSelectedId(id);
            reload();
          }}
        />
      </SlideOver>
      <SlideOver open={graphicsOpen} title="Graphics studio" onClose={() => setGraphicsOpen(false)}>
        <MarketingGraphic />
      </SlideOver>
      <SlideOver open={ideasOpen} title="Content ideas" onClose={() => setIdeasOpen(false)}>
        <ContentIdeasPanel />
      </SlideOver>
    </div>
  );
}

// ---------- Upcoming schedule strip ----------

interface CalendarRow {
  id: string;
  channel: string;
  title: string | null;
  scheduled_for: string;
  posted_at: string | null;
  campaign_name: string;
}

function UpcomingStrip() {
  const { data } = useFetch<CalendarRow[]>("/api/admin/marketing/calendar");
  const upcoming = data?.filter((r) => !r.posted_at).slice(0, 6) ?? [];
  if (upcoming.length === 0) return null;
  return (
    <div className="admin-card mb-5 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Coming up</p>
      <div className="flex flex-wrap gap-3">
        {upcoming.map((r) => (
          <div key={r.id} className="rounded border border-ink/10 px-3 py-1.5 text-xs">
            <span className="font-semibold">{formatDate(r.scheduled_for)}</span> · {titleCase(r.channel)} ·{" "}
            <span className="text-warmgrey">{r.campaign_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Campaign create ----------

function CampaignCreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { data: products } = useFetch<AdminProduct[]>("/api/admin/products");
  const [form, setForm] = useState({
    name: "",
    objective: "launch",
    subject: "",
    keyMessage: "",
    audience: "",
    productId: "",
    startsOn: "",
    endsOn: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>("/api/admin/marketing/campaigns", {
        name: form.name,
        objective: form.objective,
        subject: form.subject || null,
        keyMessage: form.keyMessage || null,
        audience: form.audience || null,
        productId: form.productId || null,
        startsOn: form.startsOn || null,
        endsOn: form.endsOn || null,
      });
      onCreated(res.id);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Campaign name *</label>
        <input required className="input" placeholder="SS27 pre-order launch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Objective</label>
        <select className="input" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
          {OBJECTIVES.map((o) => (
            <option key={o} value={o}>
              {titleCase(o)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">What's it about?</label>
        <textarea rows={3} className="input" placeholder="The story, the moment, why now — in your own words." value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
      </div>
      <div>
        <label className="label">The one message every piece must land</label>
        <input className="input" placeholder="e.g. Pre-orders fund the run — first 150 pieces only." value={form.keyMessage} onChange={(e) => setForm({ ...form, keyMessage: e.target.value })} />
      </div>
      <div>
        <label className="label">Audience</label>
        <input className="input" placeholder="Who is this talking to?" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} />
      </div>
      <div>
        <label className="label">Featured product (optional — pulls fabric, price, story)</label>
        <select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
          <option value="">—</option>
          {products?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Starts</label>
          <input type="date" className="input" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
        </div>
        <div>
          <label className="label">Ends</label>
          <input type="date" className="input" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}

// ---------- Campaign detail ----------

function CampaignDetail({ campaign, onChanged }: { campaign: CampaignRow; onChanged: () => void }) {
  const { data: detail, reload } = useFetch<CampaignRow & { assets: AssetRow[] }>(
    `/api/admin/marketing/campaigns/${campaign.id}`,
  );
  const { data: channels } = useFetch<ChannelOption[]>("/api/admin/marketing/channels");
  const [picked, setPicked] = useState<string[]>([
    "instagram",
    "story",
    "tiktok",
    "email",
    "blog",
  ]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      await api.post(`/api/admin/marketing/campaigns/${campaign.id}/generate`, { channels: picked });
      reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(status: string) {
    await api.patch(`/api/admin/marketing/campaigns/${campaign.id}`, { status });
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete campaign “${campaign.name}” and all its content?`)) return;
    await api.delete(`/api/admin/marketing/campaigns/${campaign.id}`);
    onChanged();
  }

  const assets = detail?.assets ?? [];

  return (
    <div className="space-y-4">
      <div className="admin-card p-5">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-light">{campaign.name}</p>
            <p className="text-xs text-warmgrey">
              {titleCase(campaign.objective)}
              {campaign.product_name && ` · ${campaign.product_name}`}
              {campaign.starts_on && ` · ${formatDate(campaign.starts_on)}${campaign.ends_on ? ` → ${formatDate(campaign.ends_on)}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select className="rounded border border-ink/15 bg-white px-2 py-1 text-xs" value={campaign.status} onChange={(e) => void setStatus(e.target.value)}>
              {["draft", "active", "done", "archived"].map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
            <button type="button" className="text-xs text-warmgrey hover:text-red-700 hover:underline" onClick={() => void remove()}>
              Delete
            </button>
          </div>
        </div>
        {campaign.key_message && (
          <p className="mb-3 rounded bg-cream px-3 py-2 text-sm">“{campaign.key_message}”</p>
        )}
        <div className="flex flex-wrap gap-2">
          {channels?.map((ch) => (
            <label
              key={ch.channel}
              className={`cursor-pointer rounded border px-2.5 py-1 text-xs ${
                picked.includes(ch.channel) ? "border-navy bg-navy text-chalk" : "border-ink/15 text-ink/70 hover:border-ink/40"
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={picked.includes(ch.channel)}
                onChange={(e) =>
                  setPicked(e.target.checked ? [...picked, ch.channel] : picked.filter((p) => p !== ch.channel))
                }
              />
              {ch.label}
            </label>
          ))}
        </div>
        {error && <p className="field-error mt-3">{error}</p>}
        <button type="button" className="btn btn-primary mt-4" disabled={generating || picked.length === 0} onClick={() => void generate()}>
          {generating
            ? "Writing the kit… (~30-60s)"
            : assets.length > 0
              ? "Regenerate selected channels"
              : "✨ Generate the kit"}
        </button>
        {assets.length > 0 && (
          <p className="mt-2 text-xs text-warmgrey">
            Regenerating replaces unposted drafts for the selected channels only — posted pieces are never touched.
          </p>
        )}
      </div>

      {assets.map((asset) => (
        <AssetCard key={asset.id} campaignId={campaign.id} asset={asset} onChanged={reload} />
      ))}
    </div>
  );
}

// ---------- Asset card ----------

const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram post",
  story: "Story",
  tiktok: "TikTok / Reel",
  pinterest: "Pinterest",
  x: "X (Twitter)",
  facebook: "Facebook",
  email: "Email",
  blog: "Blog draft",
  press: "Press release",
  ad_google: "Google ads",
  ad_meta: "Meta ads",
};

function parseMeta(json: string | null): Record<string, unknown> {
  try {
    return json ? (JSON.parse(json) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function AssetCard({
  campaignId,
  asset,
  onChanged,
}: {
  campaignId: string;
  asset: AssetRow;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(asset.title ?? "");
  const [content, setContent] = useState(asset.content);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const meta = parseMeta(asset.meta_json);
  const dirty = title !== (asset.title ?? "") || content !== asset.content;

  async function save() {
    setBusy("save");
    setError(null);
    try {
      await api.patch(`/api/admin/marketing/assets/${asset.id}`, { title: title || null, content });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regen");
    setError(null);
    try {
      await api.post(`/api/admin/marketing/assets/${asset.id}/regenerate`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Regenerate failed");
    } finally {
      setBusy(null);
    }
  }

  async function schedule(date: string) {
    await api.patch(`/api/admin/marketing/assets/${asset.id}`, { scheduledFor: date || null });
    onChanged();
  }

  async function togglePosted() {
    await api.patch(`/api/admin/marketing/assets/${asset.id}`, { posted: !asset.posted_at });
    onChanged();
  }

  function copyAll() {
    const hashtags = Array.isArray(meta.hashtags) ? "\n\n" + (meta.hashtags as string[]).map((h) => `#${h}`).join(" ") : "";
    void navigator.clipboard.writeText(`${content}${hashtags}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="admin-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{CHANNEL_LABELS[asset.channel] ?? titleCase(asset.channel)}</p>
        <div className="flex items-center gap-3 text-xs">
          <input
            type="date"
            className="rounded border border-ink/15 px-1.5 py-0.5"
            title="Schedule"
            value={asset.scheduled_for ?? ""}
            onChange={(e) => void schedule(e.target.value)}
          />
          <button type="button" className="link-quiet" onClick={() => void togglePosted()}>
            {asset.posted_at ? "Posted ✓" : "Mark posted"}
          </button>
          <button type="button" className="link-quiet" disabled={busy !== null} onClick={() => void regenerate()}>
            {busy === "regen" ? "Rewriting…" : "↻ Regenerate"}
          </button>
          <button type="button" className="link-quiet" onClick={copyAll}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      {(asset.title !== null || asset.channel === "email") && (
        <input
          className="input mb-2 font-medium"
          placeholder={asset.channel === "email" ? "Subject line" : "Title / hook"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}
      <textarea
        rows={Math.min(14, Math.max(4, content.split("\n").length + 1))}
        className="input !text-[0.85rem] leading-relaxed"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {Array.isArray(meta.hashtags) && (
        <p className="mt-2 text-xs text-warmgrey">{(meta.hashtags as string[]).map((h) => `#${h}`).join(" ")}</p>
      )}
      {Array.isArray(meta.altSubjects) && (
        <p className="mt-2 text-xs text-warmgrey">Alt subjects: {(meta.altSubjects as string[]).join(" · ")}</p>
      )}
      {Array.isArray(meta.headlines) && (
        <div className="mt-2 text-xs text-warmgrey">
          <p>Headlines: {(meta.headlines as string[]).join(" | ")}</p>
          {Array.isArray(meta.descriptions) && <p>Descriptions: {(meta.descriptions as string[]).join(" | ")}</p>}
        </div>
      )}
      {Array.isArray(meta.variants) && (
        <div className="mt-2 space-y-1 text-xs text-warmgrey">
          {(meta.variants as { primaryText?: string; headline?: string; description?: string }[]).map((v, i) => (
            <p key={i}>
              <span className="font-semibold">{v.headline}</span> — {v.primaryText} <em>{v.description}</em>
            </p>
          ))}
        </div>
      )}
      {asset.channel === "email" && <EmailSendPanel campaignId={campaignId} asset={asset} onSent={onChanged} />}
      {error && <p className="field-error mt-2">{error}</p>}
      {dirty && (
        <button type="button" className="btn btn-primary mt-3" disabled={busy !== null} onClick={() => void save()}>
          {busy === "save" ? "Saving…" : "Save edits"}
        </button>
      )}
    </div>
  );
}

// ---------- Email send panel ----------

function EmailSendPanel({
  campaignId,
  asset,
  onSent,
}: {
  campaignId: string;
  asset: AssetRow;
  onSent: () => void;
}) {
  const { data } = useFetch<{ configured: boolean; counts: Record<string, number> }>(
    "/api/admin/marketing/email-audience",
  );
  const [audience, setAudience] = useState("newsletter");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const count =
    audience === "all"
      ? Object.values(data?.counts ?? {}).reduce((a, b) => a + b, 0)
      : (data?.counts?.[audience] ?? 0);

  async function send() {
    if (!window.confirm(`Send “${asset.title ?? "this email"}” to ${count} subscriber(s)? This cannot be undone.`)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<{ recipients: number }>(
        `/api/admin/marketing/campaigns/${campaignId}/send-email`,
        { assetId: asset.id, audience },
      );
      setResult(`Sent to ${res.recipients} subscriber(s) ✓`);
      onSent();
    } catch (err) {
      setResult(err instanceof ApiRequestError ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-cream px-3 py-2">
      {data.configured ? (
        <>
          <select className="rounded border border-ink/15 bg-white px-2 py-1 text-xs" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="newsletter">Newsletter ({data.counts.newsletter ?? 0})</option>
            <option value="waitlist">Waitlist ({data.counts.waitlist ?? 0})</option>
            <option value="all">Everyone ({Object.values(data.counts).reduce((a, b) => a + b, 0)})</option>
          </select>
          <button type="button" className="btn btn-primary !px-3 !py-1 text-xs" disabled={busy || count === 0 || Boolean(asset.posted_at)} onClick={() => void send()}>
            {busy ? "Sending…" : asset.posted_at ? "Already sent" : `Send to ${count}`}
          </button>
          <span className="text-xs text-warmgrey">Includes an unsubscribe link automatically.</span>
        </>
      ) : (
        <span className="text-xs text-warmgrey">
          Email sending isn't configured yet — onboard a sending domain and set BUYER_EMAIL_FROM (see README).
        </span>
      )}
      {result && <span className="text-xs">{result}</span>}
    </div>
  );
}

// ---------- Content ideas ----------

interface Idea {
  title: string;
  slug: string;
  angle: string;
  keywords: string[];
}

function ContentIdeasPanel() {
  const [theme, setTheme] = useState("");
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ ideas: Idea[] }>("/api/admin/marketing/content-ideas", {
        theme: theme || undefined,
      });
      setIdeas(res.ideas);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Idea generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(idea: Idea) {
    setError(null);
    try {
      await api.post("/api/admin/content/journal", {
        slug: idea.slug.slice(0, 80),
        title: idea.title,
        excerpt: idea.angle,
        bodyMd: `> Angle: ${idea.angle}\n> Keywords: ${idea.keywords.join(", ")}\n\n_Draft it in the Journal editor — the ✨ buttons are there._`,
        isPublished: false,
      });
      setCreatedSlug(idea.slug);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not create the draft");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-warmgrey">
        Article ideas that can rank in search and still sound like you — mixed evergreen (care,
        materials, fit) and brand-building (process, place, people).
      </p>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Optional theme — e.g. summer linen care" value={theme} onChange={(e) => setTheme(e.target.value)} />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void generate()}>
          {busy ? "Thinking…" : "Generate"}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="space-y-3">
        {ideas?.map((idea) => (
          <div key={idea.slug} className="rounded border border-ink/10 p-3">
            <p className="text-sm font-medium">{idea.title}</p>
            <p className="mt-1 text-xs text-warmgrey">{idea.angle}</p>
            <p className="mt-1 text-xs text-warmgrey">Keywords: {idea.keywords?.join(", ")}</p>
            <button
              type="button"
              className="link-quiet mt-2 text-xs"
              disabled={createdSlug === idea.slug}
              onClick={() => void createDraft(idea)}
            >
              {createdSlug === idea.slug ? "Draft created ✓ (see Journal)" : "Create draft post →"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
