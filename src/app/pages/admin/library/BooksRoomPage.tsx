import { useState } from "react";
import { Link } from "react-router";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { RoomNav, ItemGrid, ItemDrawer, SearchBar, type LibraryItem } from "./shared";

/**
 * The Books room. Two shelves: the school's own sources (the books the nine
 * courses are taught from — read them cover to cover in the reader), and the
 * open stacks (the Archive's pre-1931 texts, searchable).
 */

const SCHOOL_SHELF: { iaId: string; title: string; note: string }[] = [
  { iaId: "elementsofgarmen00madi", title: "Madison — Elements of Garment Cutting (1878)", note: "Foundations of Cutting" },
  { iaId: "historyofartofcu00gile", title: "Giles — The Art of Cutting in England (1887)", note: "Foundations of Cutting" },
  { iaId: "cutters-practical-guide-trousers", title: "Vincent — The Cutter's Practical Guide: Trousers (c. 1905)", note: "The Trouser" },
  { iaId: "grandeditionofsu00croo", title: "Croonborg — Supreme System (1907)", note: "The Trouser" },
  { iaId: "cutters-prac-guide-jacket-cutting", title: "Vincent — CPG: Jacket Cutting (1897)", note: "The Jacket & Coat" },
  { iaId: "copelandmethodco00cope", title: "The Copeland Method (1908)", note: "Pressing" },
  { iaId: "cu31924105503068", title: "Woman's Institute — Essential Stitches and Seams (1922)", note: "Stitches & Seams" },
  { iaId: "newdressmakerwit00butt", title: "Butterick — The New Dressmaker (1921)", note: "Stitches & Seams" },
  { iaId: "draping-and-designing-with-scissors-and-cloth", title: "WI — Draping with Scissors and Cloth (1924)", note: "Drafting & Draping" },
  { iaId: "dressmaking00fale", title: "Fales — Dressmaking (1917)", note: "Drafting & Draping" },
  { iaId: "DressmakingPerfectioninDetails", title: "Picken — Perfection in Details (1927)", note: "Dressmaking in Detail" },
  { iaId: "dressdesignaccou0000unse", title: "Hughes — Dress Design (1920)", note: "Language of Costume" },
  { iaId: "gri_33125008496388", title: "Racinet — Le Costume Historique, vol. 5 (1888)", note: "Language of Costume" },
  { iaId: "studentsmanualof00younrich", title: "Young — Manual of Fashion Drawing (1919)", note: "Fashion Drawing" },
  { iaId: "costumedesignill00trap", title: "Traphagen — Costume Design and Illustration (1918)", note: "Fashion Drawing" },
  { iaId: "economics-of-fashion-1928-paul-nystrom", title: "Nystrom — Economics of Fashion (1928)", note: "Economics of Fashion" },
];

export function BooksRoomPage() {
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
        `/api/admin/library/search?room=books&q=${encodeURIComponent(q.trim())}`,
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
        title="Books"
        eyebrow="Timeless Library"
        description="The school's source shelf, readable cover to cover — and the Archive's open stacks behind it (pre-1931, public domain)."
        help="timeless-library"
      />
      <RoomNav active="books" />

      <p className="section-head mb-3 text-ink/70">The school's shelf</p>
      <div className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SCHOOL_SHELF.map((b) => (
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

      <p className="section-head mb-3 text-ink/70">The open stacks</p>
      <SearchBar value={q} onChange={setQ} onSearch={search} busy={busy} placeholder="Search pre-1931 books — 'millinery', 'corset making', 'textile design'…" />
      {items !== null && items.length === 0 && !busy && (
        <EmptyState title="Nothing on that shelf" hint="Try the craft's period name — 'gown' over 'dress', 'costume' over 'fashion'." />
      )}
      {items && items.length > 0 && <ItemGrid items={items} onOpen={setOpen} />}

      <ItemDrawer item={open} room="books" onClose={() => setOpen(null)} readerLink={(i) => `/admin/library/read/${i.key.replace(/^ia:/, "")}`} />
    </div>
  );
}
