import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

/**
 * The Verto Directory (private-first) and the makers' front door.
 *
 * /directory — every listed studio, searchable by craft and place, each card
 * linking to a LIVING storefront (no stale profiles: the listing is the
 * shop). Verto Certified badges are the trust layer. Until the network has
 * density, the page serves a tasteful teaser — flip DIRECTORY_PUBLIC to
 * open it.
 *
 * /makers — the other half of every Verto transaction: the factories,
 * ateliers and mills our shops work with. A waitlist today; the workspace
 * (receive tech packs, quote line-by-line, get found) grows from this list.
 */

interface Listing {
  slug: string;
  name: string;
  craft: string;
  specialties: string | null;
  city: string | null;
  country: string | null;
  blurb: string | null;
  certCount: number;
  certBest: string | null;
}

const CRAFT_LABELS: Record<string, string> = {
  label: "Label",
  tailor: "Tailor",
  seamstress: "Seamstress",
  stylist: "Stylist",
  boutique: "Boutique",
};

export function VertoDirectory() {
  const [params] = useSearchParams();
  const [data, setData] = useState<{ open: boolean; listings: Listing[] } | null>(null);
  const [q, setQ] = useState("");
  const [craft, setCraft] = useState<string>("");
  const [certifiedOnly, setCertifiedOnly] = useState(false);

  useEffect(() => {
    const preview = params.get("preview");
    fetch(`/api/verto/directory${preview ? `?preview=${encodeURIComponent(preview)}` : ""}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ open: false, listings: [] }));
  }, [params]);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.listings.filter((l) => {
      if (craft && l.craft !== craft) return false;
      if (certifiedOnly && l.certCount === 0) return false;
      if (!needle) return true;
      return [l.name, l.specialties, l.city, l.country, l.blurb]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [data, q, craft, certifiedOnly]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow">The Verto Directory</p>
      <h1 className="mt-2 font-display text-4xl font-light text-ink">Real studios, living storefronts</h1>
      <p className="mt-3 max-w-2xl text-warmgrey">
        Every listing here is a working shop on Verto — tailors, labels, seamstresses, stylists and boutiques — and
        every card opens their actual storefront, not a stale profile. The ◈ mark is a{" "}
        <a href="/features" className="text-navy underline">
          Verto School
        </a>{" "}
        credential, publicly verifiable.
      </p>

      {data === null && <div className="skeleton mt-10 h-40 rounded-xl" />}

      {data && !data.open && (
        <div className="mt-10 rounded-2xl border border-ink/10 bg-white p-10 text-center">
          <p className="font-display text-2xl font-light text-ink">The directory is warming up.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-warmgrey">
            Studios on Verto are adding their listings now — shop owners, yours is one toggle away in{" "}
            <span className="font-medium">Settings → Verto Directory</span>. We'll open the doors when the room is
            full enough to be worth the visit.
          </p>
          <Link to="/signup" className="mt-5 inline-block rounded bg-navy px-5 py-2.5 text-sm text-white">
            Start a shop on Verto
          </Link>
        </div>
      )}

      {data?.open && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, specialty, or place…"
              className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm sm:max-w-xs"
            />
            {Object.entries(CRAFT_LABELS).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setCraft(craft === k ? "" : k)}
                className={`rounded-full px-3 py-1 text-xs ${craft === k ? "bg-navy text-white" : "border border-ink/15 text-ink/70"}`}
              >
                {label}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-ink/70">
              <input type="checkbox" checked={certifiedOnly} onChange={(e) => setCertifiedOnly(e.target.checked)} />
              ◈ Certified only
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="mt-10 text-sm text-warmgrey">No studios match that yet — the directory grows every week.</p>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((l) => (
                <a
                  key={l.slug}
                  href={`/${l.slug}`}
                  className="group rounded-2xl border border-ink/10 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-xl font-light text-ink group-hover:text-navy">{l.name}</h2>
                    <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-ink/60">
                      {CRAFT_LABELS[l.craft] ?? l.craft}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-warmgrey">
                    {[l.city, l.country].filter(Boolean).join(", ") || "—"}
                    {l.certCount > 0 && (
                      <span className="ml-2 text-navy" title="Verto School certified">
                        ◈ {l.certBest === "studio" ? "Certified Studio" : `${l.certCount} certificate${l.certCount === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </p>
                  {l.blurb && <p className="mt-2 line-clamp-3 text-sm text-ink/75">{l.blurb}</p>}
                  {l.specialties && <p className="mt-2 text-xs text-warmgrey">{l.specialties}</p>}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function VertoMakers() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", craft: "", city: "", country: "", website: "", note: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async () => {
    if (form.name.trim().length < 2 || !form.email.includes("@")) return;
    setState("busy");
    try {
      const res = await fetch("/api/verto/maker-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, invitedByShop: params.get("from") ?? undefined }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow">For makers</p>
      <h1 className="mt-2 font-display text-4xl font-light text-ink">You make it. Let the labels find you.</h1>
      <p className="mt-4 text-warmgrey">
        Verto is where independent labels, tailors and boutiques run their studios — and every one of them is looking
        for good hands: cut &amp; sew, knitwear, leather, embroidery, mills and finishers. The maker workspace is
        coming: <span className="text-ink">receive tech packs directly, quote them line by line, show your capacity,
        and get found</span> by the shops already here.
      </p>
      <p className="mt-3 text-warmgrey">
        Join the list now and you're first in when it opens — founding makers get their listing free.
        {params.get("from") && (
          <span className="mt-1 block text-sm text-navy">You were invited by {params.get("from")} — they already work the Verto way.</span>
        )}
      </p>

      {state === "done" ? (
        <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <p className="font-display text-2xl font-light text-ink">You're on the list.</p>
          <p className="mt-2 text-sm text-warmgrey">We'll write when the workspace opens — founding makers first.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 rounded-2xl border border-ink/10 bg-white p-6 sm:grid-cols-2">
          <input className="rounded border border-ink/15 px-3 py-2 text-sm" placeholder="Workshop / company name *" value={form.name} onChange={set("name")} />
          <input className="rounded border border-ink/15 px-3 py-2 text-sm" placeholder="Email *" type="email" value={form.email} onChange={set("email")} />
          <input className="rounded border border-ink/15 px-3 py-2 text-sm" placeholder="What you make — 'cut & sew, wovens'" value={form.craft} onChange={set("craft")} />
          <input className="rounded border border-ink/15 px-3 py-2 text-sm" placeholder="Website / Instagram" value={form.website} onChange={set("website")} />
          <input className="rounded border border-ink/15 px-3 py-2 text-sm" placeholder="City" value={form.city} onChange={set("city")} />
          <input className="rounded border border-ink/15 px-3 py-2 text-sm" placeholder="Country" value={form.country} onChange={set("country")} />
          <textarea className="rounded border border-ink/15 px-3 py-2 text-sm sm:col-span-2" rows={3} placeholder="Anything we should know — minimums, specialties, languages…" value={form.note} onChange={set("note")} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button onClick={submit} disabled={state === "busy"} className="rounded bg-navy px-5 py-2.5 text-sm text-white disabled:opacity-50">
              {state === "busy" ? "Joining…" : "Join the makers' list"}
            </button>
            {state === "error" && <p className="text-sm text-terracotta">Couldn't save that — try again in a moment.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
