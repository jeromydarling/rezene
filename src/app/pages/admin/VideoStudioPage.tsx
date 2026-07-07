import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import { EmptyState, ErrorNote, LoadingTable, PageHeader, StatusBadge } from "../../components/admin/ui";

/**
 * Promo Video studio. The live preview IS the finished film, frame for frame —
 * the customer approves exactly what they'll pay for, so nobody is ever billed
 * for a version they hate. Rendering runs off-Worker (GitHub Actions); the wait
 * screen keeps the promise honest with a poster still, scene-by-scene progress,
 * "keep working, we'll email you", and charge-on-delivery.
 */

interface JobListRow {
  id: string;
  title: string;
  status: string;
  progress: number;
  progress_label: string | null;
  formats: string;
  poster_file_id: string | null;
  price_cents: number;
  paid_at: string | null;
  created_at: string;
}

interface JobDetail extends JobListRow {
  spec_json: string;
  outputs: string | null;
  error: string | null;
}

interface StudioConfig {
  priceCents: number;
  currency: string;
  renderEnabled: boolean;
  stripeEnabled: boolean;
  formats: string[];
}

interface Scenes {
  opener: string;
  collection: string;
  story: string;
  cta: string;
}

const FORMAT_LABELS: Record<string, string> = {
  "16:9": "Landscape · 16:9",
  "9:16": "Vertical · 9:16",
  "1:1": "Square · 1:1",
};

const SCENE_FIELDS: { key: keyof Scenes; label: string; hint: string; long?: boolean }[] = [
  { key: "opener", label: "Opening line", hint: "The hook over your hero shot — a few words" },
  { key: "collection", label: "Collection title", hint: "Season or collection name" },
  { key: "story", label: "Brand line", hint: "One evocative line over an editorial frame", long: true },
  { key: "cta", label: "Closing call to action", hint: "e.g. Shop the collection" },
];

export function VideoStudioPage() {
  const [params, setParams] = useSearchParams();
  const { data: jobs, loading, error, reload } = useFetch<JobListRow[]>("/api/admin/marketing/video");
  const { data: config } = useFetch<StudioConfig>("/api/admin/marketing/video/config");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Land on ?paid=<id> after Stripe returns.
  useEffect(() => {
    const paid = params.get("paid");
    if (paid) {
      setSelectedId(paid);
      reload();
      params.delete("paid");
      params.delete("cancelled");
      setParams(params, { replace: true });
    }
  }, [params, reload, setParams]);

  // Auto-select the first job once loaded.
  useEffect(() => {
    if (!selectedId && jobs && jobs.length > 0) setSelectedId(jobs[0].id);
  }, [jobs, selectedId]);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const { id } = await api.post<{ id: string }>("/api/admin/marketing/video");
      await reload();
      setSelectedId(id);
    } finally {
      setCreating(false);
    }
  }, [reload]);

  return (
    <div>
      <PageHeader
        title="Promo Video"
        help="promo-video"
        eyebrow="Marketing Suite"
        description="Compose a cinematic promo from your own products, preview the finished film in real time, and export only when you love it."
        actions={
          <button type="button" className="btn btn-primary" disabled={creating} onClick={() => void create()}>
            {creating ? "Creating…" : "New video"}
          </button>
        }
      />

      {loading && <LoadingTable />}
      {error && <ErrorNote message={error} />}

      {!loading && jobs && jobs.length === 0 && (
        <EmptyState
          title="No promos yet"
          hint="Start one and we'll draft the scenes from your catalog — then tweak every line and watch it play before you spend a cent."
          action={
            <button type="button" className="btn btn-primary" onClick={() => void create()}>
              Create your first promo
            </button>
          }
        />
      )}

      {jobs && jobs.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-2">
            {jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setSelectedId(j.id)}
                className={`admin-card w-full px-4 py-3 text-left transition ${
                  selectedId === j.id ? "!border-navy ring-1 ring-navy" : "hover:border-ink/25"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{j.title}</span>
                  <StatusBadge status={j.status} />
                </div>
                <p className="mt-1 text-xs text-warmgrey">{formatDate(j.created_at)}</p>
              </button>
            ))}
          </aside>

          <div>
            {selectedId ? (
              <VideoEditor
                key={selectedId}
                jobId={selectedId}
                config={config}
                onChanged={reload}
                onDeleted={() => {
                  setSelectedId(null);
                  void reload();
                }}
              />
            ) : (
              <EmptyState title="Pick a promo" hint="Select one on the left, or start a new video." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoEditor({
  jobId,
  config,
  onChanged,
  onDeleted,
}: {
  jobId: string;
  config: StudioConfig | null;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [scenes, setScenes] = useState<Scenes | null>(null);
  const [title, setTitle] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [formats, setFormats] = useState<string[]>(["16:9"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const load = useCallback(async () => {
    const j = await api.get<JobDetail>(`/api/admin/marketing/video/${jobId}`);
    setJob(j);
    setTitle(j.title);
    const spec = JSON.parse(j.spec_json) as { scenes: Scenes };
    setScenes(spec.scenes);
    try {
      setFormats(JSON.parse(j.formats) as string[]);
    } catch {
      setFormats(["16:9"]);
    }
    return j;
  }, [jobId]);

  const loadPreview = useCallback(async () => {
    const html = await api.getText(`/api/admin/marketing/video/${jobId}/preview`);
    setPreviewHtml(html);
  }, [jobId]);

  useEffect(() => {
    void load();
    void loadPreview();
  }, [load, loadPreview]);

  // Poll while the render is in flight so the wait screen stays live.
  const rendering = job ? ["queued", "rendering"].includes(job.status) : false;
  useEffect(() => {
    if (!rendering) return;
    const t = setInterval(() => {
      void load().then((j) => {
        if (!["queued", "rendering"].includes(j.status)) onChanged();
      });
    }, 4000);
    return () => clearInterval(t);
  }, [rendering, load, onChanged]);

  // Real-time playback (the render seeks the same clock).
  const play = useCallback(() => {
    const w = iframeRef.current?.contentWindow as (Window & { __play?: () => void }) | null;
    w?.__play?.();
  }, []);
  useEffect(() => {
    // Autoplay once the srcdoc is in.
    const id = setTimeout(play, 500);
    return () => clearTimeout(id);
  }, [previewHtml, play]);

  const save = useCallback(
    async (refresh = true) => {
      if (!scenes) return;
      setBusy("save");
      setErr(null);
      try {
        await api.patch(`/api/admin/marketing/video/${jobId}`, { title, scenes });
        if (refresh) await loadPreview();
        onChanged();
        setNotice("Saved — preview updated.");
      } catch (e) {
        setErr(e instanceof ApiRequestError ? e.message : "Couldn't save");
      } finally {
        setBusy(null);
      }
    },
    [scenes, title, jobId, loadPreview, onChanged],
  );

  const aiDraft = useCallback(async () => {
    setBusy("ai");
    setErr(null);
    try {
      const res = await api.post<{ scenes: Scenes }>(`/api/admin/marketing/video/${jobId}/draft`);
      setScenes(res.scenes);
      await loadPreview();
      setNotice("Drafted in your brand voice — edit anything you like.");
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "LLM drafting unavailable");
    } finally {
      setBusy(null);
    }
  }, [jobId, loadPreview]);

  const submit = useCallback(async () => {
    setBusy("submit");
    setErr(null);
    try {
      // Persist the current copy first so what renders == what's on screen.
      await api.patch(`/api/admin/marketing/video/${jobId}`, { title, scenes });
      const res = await api.post<{ checkoutUrl?: string; queued?: boolean }>(
        `/api/admin/marketing/video/${jobId}/submit`,
        { formats },
      );
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Couldn't start the render");
    } finally {
      setBusy(null);
    }
  }, [jobId, title, scenes, formats, load, onChanged]);

  const remove = useCallback(async () => {
    setBusy("delete");
    try {
      await api.delete(`/api/admin/marketing/video/${jobId}`);
      onDeleted();
    } catch (e) {
      setErr(e instanceof ApiRequestError ? e.message : "Couldn't delete");
      setBusy(null);
    }
  }, [jobId, onDeleted]);

  if (!job || !scenes) return <LoadingTable rows={4} />;

  const outputs = job.outputs ? (JSON.parse(job.outputs) as Record<string, { url: string }>) : {};
  const priceCents = config?.priceCents ?? job.price_cents ?? 1900;
  const isReady = job.status === "ready";
  const toggleFormat = (f: string) =>
    setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <div className="space-y-5">
      {/* Preview — the guardrail */}
      <div className="admin-card overflow-hidden p-0">
        <div className="relative aspect-video w-full bg-black">
          {previewHtml ? (
            <iframe
              ref={iframeRef}
              title="Promo preview"
              srcDoc={previewHtml}
              className="absolute inset-0 h-full w-full"
              style={{ border: 0 }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-chalk/60 text-sm">Loading preview…</div>
          )}
          <button
            type="button"
            onClick={play}
            className="absolute bottom-3 right-3 rounded-full bg-white/90 px-4 py-1.5 text-xs font-medium text-ink shadow hover:bg-white"
          >
            ▶ Replay
          </button>
        </div>
        <p className="bg-navy/[0.04] px-4 py-2 text-center text-xs text-warmgrey">
          This preview is the finished film, frame for frame. You’re only charged once you export a version you love.
        </p>
      </div>

      {err && <ErrorNote message={err} />}
      {notice && !err && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {rendering ? (
        <RenderWait job={job} />
      ) : isReady ? (
        <ReadyPanel job={job} outputs={outputs} onRedo={() => void submit()} redoing={busy === "submit"} />
      ) : (
        <>
          {/* Scene editor */}
          <div className="admin-card space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-light">Script</h2>
              <button type="button" className="btn btn-secondary !py-1.5 text-xs" disabled={busy === "ai"} onClick={() => void aiDraft()}>
                {busy === "ai" ? "Drafting…" : "✦ Draft with LLM"}
              </button>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-warmgrey">Video title (internal)</span>
              <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {SCENE_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-warmgrey">{f.label}</span>
                {f.long ? (
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={scenes[f.key]}
                    onChange={(e) => setScenes({ ...scenes, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="input w-full"
                    value={scenes[f.key]}
                    onChange={(e) => setScenes({ ...scenes, [f.key]: e.target.value })}
                  />
                )}
                <span className="mt-0.5 block text-[11px] text-warmgrey/80">{f.hint}</span>
              </label>
            ))}
            <button type="button" className="btn btn-secondary w-full" disabled={busy === "save"} onClick={() => void save()}>
              {busy === "save" ? "Saving…" : "Save & refresh preview"}
            </button>
          </div>

          {/* Export */}
          <div className="admin-card space-y-4 p-5">
            <h2 className="font-display text-lg font-light">Export</h2>
            <div>
              <span className="mb-2 block text-xs font-medium text-warmgrey">Formats</span>
              <div className="flex flex-wrap gap-2">
                {(config?.formats ?? ["16:9", "9:16", "1:1"]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormat(f)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      formats.includes(f) ? "border-navy bg-navy text-chalk" : "border-ink/15 text-ink/70 hover:border-ink/40"
                    }`}
                  >
                    {FORMAT_LABELS[f] ?? f}
                  </button>
                ))}
              </div>
            </div>

            {config && !config.renderEnabled ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Rendering isn’t switched on for this store yet. The live preview above is fully available — exporting a
                downloadable MP4 unlocks once the render backend is connected.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md bg-navy/[0.04] px-3 py-2 text-sm">
                  <span className="text-warmgrey">
                    {config?.stripeEnabled ? "One-time export" : "Export"} · {formats.length} format{formats.length > 1 ? "s" : ""}
                  </span>
                  <span className="font-medium">
                    {config?.stripeEnabled ? formatMoney(priceCents, config?.currency ?? "USD") : "Included"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={busy === "submit" || formats.length === 0}
                  onClick={() => void submit()}
                >
                  {busy === "submit"
                    ? "Starting…"
                    : config?.stripeEnabled
                      ? `Export — pay ${formatMoney(priceCents, config?.currency ?? "USD")} on delivery`
                      : "Export video"}
                </button>
                <p className="text-center text-[11px] text-warmgrey">
                  {config?.stripeEnabled
                    ? "Your card is authorized now and only charged when the finished video is delivered. A failed render is never billed."
                    : "We’ll render the video and email you when it’s ready."}
                </p>
              </>
            )}

            <button
              type="button"
              className="w-full text-center text-xs text-warmgrey hover:text-red-700 hover:underline"
              disabled={busy === "delete"}
              onClick={() => void remove()}
            >
              Delete this promo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Wait screen — the whole point of "help the user with the WAIT." */
function RenderWait({ job }: { job: JobDetail }) {
  const pct = Math.max(2, Math.min(100, job.progress || 0));
  return (
    <div className="admin-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-light">Rendering your film</h2>
        <StatusBadge status={job.status} />
      </div>
      {job.poster_file_id && (
        <img
          src={`/media/${job.poster_file_id}`}
          alt="First frame"
          className="aspect-video w-full rounded-md object-cover"
        />
      )}
      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-navy transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-warmgrey">
          <span>{job.progress_label || "Queued — warming up"}</span>
          <span>{pct}%</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm text-warmgrey">
        <li>· A cinematic render takes a few minutes — you don’t have to wait here.</li>
        <li>· Keep working anywhere in Verto; we’ll email you the moment it’s ready.</li>
        <li>· You’re only charged when the finished video lands — never for a render that fails.</li>
      </ul>
    </div>
  );
}

function ReadyPanel({
  job,
  outputs,
  onRedo,
  redoing,
}: {
  job: JobDetail;
  outputs: Record<string, { url: string }>;
  onRedo: () => void;
  redoing: boolean;
}) {
  const entries = Object.entries(outputs);
  return (
    <div className="admin-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-light">Ready to publish</h2>
        <StatusBadge status={job.status} />
      </div>
      {job.paid_at && <p className="text-xs text-warmgrey">Exported {formatDate(job.paid_at)}.</p>}
      {entries.length === 0 ? (
        <p className="text-sm text-warmgrey">Finishing the upload…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(([fmt, o]) => (
            <div key={fmt} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-warmgrey">
                <span>{FORMAT_LABELS[fmt] ?? fmt}</span>
                <a href={o.url} download className="link-quiet">
                  Download
                </a>
              </div>
              <video src={o.url} controls playsInline className="w-full rounded-md bg-black" poster={job.poster_file_id ? `/media/${job.poster_file_id}` : undefined} />
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-secondary" disabled={redoing} onClick={onRedo}>
        {redoing ? "Starting…" : "Make another cut"}
      </button>
    </div>
  );
}
