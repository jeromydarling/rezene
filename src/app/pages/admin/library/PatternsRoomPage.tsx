import { useState } from "react";
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { RoomNav, ItemGrid, ItemDrawer, SearchBar, type LibraryItem } from "./shared";

/**
 * The Patterns room: period drafts you can actually cut from. Hughes's
 * measured diagrams from surviving garments, LACMA's free pattern project
 * (hand-drafted from pieces in their costume collection), and the Archive's
 * drafting books.
 */

const LACMA_PATTERNS = [
  { title: "LACMA Pattern Project — the collection", url: "https://www.lacma.org/patternproject", note: "Free sewing patterns drafted from garments in LACMA's Costume & Textiles collection — download, print, make." },
];

const HUGHES_SHELF = [
  { title: "Hughes — pattern diagrams, cut from surviving garments (1920)", iaId: "dressdesignaccou0000unse", note: "The back of Dress Design: five centuries of measured pattern diagrams." },
  { title: "Racinet — Coupes et Patrons (1888)", iaId: "gri_33125008521722", note: "The pattern plates from Le Costume Historique's text volume." },
];

export function PatternsRoomPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<LibraryItem | null>(null);

  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await api.get<{ items: LibraryItem[] }>(
        `/api/admin/library/search?room=patterns&q=${encodeURIComponent(q.trim())}`,
      );
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "The archive isn't answering — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Patterns"
        eyebrow="Timeless Library"
        description="Drafts you can cut from: patterns taken off surviving garments, free museum pattern projects, and the era's drafting books."
        help="timeless-library"
      />
      <RoomNav active="patterns" />

      <div className="mb-8 grid gap-2 sm:grid-cols-2">
        {LACMA_PATTERNS.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 transition-shadow hover:shadow-md">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              {p.title} <ExternalLink size={12} className="text-warmgrey" />
            </p>
            <p className="mt-0.5 text-xs text-warmgrey">{p.note}</p>
          </a>
        ))}
        {HUGHES_SHELF.map((b) => (
          <div key={b.iaId} className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink" title={b.title}>
                {b.title}
              </p>
              <p className="text-[0.68rem] text-warmgrey">{b.note}</p>
            </div>
            <Link to={`/admin/library/read/${b.iaId}`} className="shrink-0 rounded bg-navy px-2.5 py-1 text-xs text-white">
              Read
            </Link>
          </div>
        ))}
      </div>

      <p className="section-head mb-3 text-ink/70">Search the drafting stacks</p>
      <SearchBar value={q} onChange={setQ} onSearch={search} busy={busy} placeholder="'trouser drafting', 'skirt pattern', 'sleeve system'…" />
      {items !== null && items.length === 0 && !busy && (
        <EmptyState title="No drafts found" hint="Period words work best — 'garment cutting', 'drafting system', 'tailor system'." />
      )}
      {items && items.length > 0 && <ItemGrid items={items} onOpen={setOpen} />}

      <ItemDrawer item={open} room="patterns" onClose={() => setOpen(null)} readerLink={(i) => `/admin/library/read/${i.key.replace(/^ia:/, "")}`} />
    </div>
  );
}
