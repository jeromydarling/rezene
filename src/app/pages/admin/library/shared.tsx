import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ExternalLink, Pin, X } from "lucide-react";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";

/** Shared pieces of the Timeless Library rooms: the item model mirrors the
 *  worker's LibraryItem; the drawer handles pinning and the trend-board
 *  hand-off (always with the citation attached — the school's method). */

export interface LibraryItem {
  key: string;
  source: "met" | "ia";
  kind: "plate" | "issue" | "book";
  title: string;
  creator: string | null;
  date: string | null;
  thumb: string | null;
  image: string | null;
  url: string;
  credit: string;
}

export interface LibraryPin {
  id: string;
  itemKey: string;
  room: string;
  title: string;
  creator: string | null;
  date: string | null;
  thumb: string | null;
  image: string | null;
  url: string;
  credit: string;
  note: string | null;
  createdAt: string;
}

export const iaPage = (iaId: string, leaf: number, width = 880): string =>
  `https://iiif.archive.org/iiif/${encodeURIComponent(iaId)}$${leaf}/full/${width},/0/default.jpg`;

export function RoomNav({ active }: { active: string }) {
  const rooms = [
    ["", "The Library"],
    ["plates", "Plates"],
    ["magazines", "Magazines"],
    ["books", "Books"],
    ["patterns", "Patterns"],
  ] as const;
  return (
    <nav className="mb-5 flex flex-wrap gap-1.5">
      {rooms.map(([slug, label]) => (
        <Link
          key={slug}
          to={`/admin/library${slug ? `/${slug}` : ""}`}
          className={`rounded-full px-3 py-1 text-xs ${
            active === slug ? "bg-navy text-white" : "border border-ink/15 text-ink/70 hover:text-ink"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ItemGrid({ items, onOpen }: { items: LibraryItem[]; onOpen: (i: LibraryItem) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onOpen(it)}
          className="group overflow-hidden rounded-xl border border-ink/10 bg-white text-left transition-shadow hover:shadow-md"
        >
          <div className="aspect-[3/4] overflow-hidden bg-ink/[0.04]">
            {it.thumb && (
              <img
                src={it.thumb}
                alt={it.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            )}
          </div>
          <div className="p-2.5">
            <p className="line-clamp-2 text-xs font-medium text-ink">{it.title}</p>
            <p className="mt-0.5 truncate text-[0.68rem] text-warmgrey">
              {[it.creator, it.date].filter(Boolean).join(" · ")}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

interface TrendBoardLite {
  id: string;
  title: string;
}

/** Item drawer: big view, credit, open-at-source, pin, and send-to-board. */
export function ItemDrawer({
  item,
  room,
  onClose,
  readerLink,
}: {
  item: LibraryItem | null;
  room: string;
  onClose: () => void;
  /** For magazine issues: link into the reader instead of showing a flat image. */
  readerLink?: (item: LibraryItem) => string;
}) {
  const toast = useToast();
  const [pin, setPin] = useState<LibraryPin | null>(null);
  const [boards, setBoards] = useState<TrendBoardLite[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPin(null);
    setBoards(null);
  }, [item?.key]);

  if (!item) return null;

  const doPin = async () => {
    setBusy(true);
    try {
      const created = await api.post<LibraryPin>("/api/admin/library/pins", {
        itemKey: item.key,
        room,
        title: item.title,
        creator: item.creator,
        date: item.date,
        thumb: item.thumb,
        image: item.image,
        url: item.url,
        credit: item.credit,
      });
      setPin(created);
      toast.success("Pinned to your library.");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Couldn't pin that.");
    } finally {
      setBusy(false);
    }
  };

  const loadBoards = async () => {
    try {
      const rows = await api.get<TrendBoardLite[]>("/api/admin/research/trends");
      setBoards(rows);
    } catch {
      setBoards([]);
    }
  };

  const sendToBoard = async (boardId: string) => {
    if (!pin) return;
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; board: string }>(
        `/api/admin/library/pins/${pin.id}/to-trend/${boardId}`,
        {},
      );
      toast.success(`On the board — "${res.board}", citation included.`);
      setBoards(null);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Couldn't reach the board.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-light text-ink">{item.title}</h2>
            <p className="text-xs text-warmgrey">{[item.creator, item.date].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink/60 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {item.image && (
          <img src={item.image} alt={item.title} className="max-h-[55vh] w-full rounded-lg border border-ink/10 bg-ink/[0.03] object-contain" />
        )}

        <p className="mt-2 text-[0.7rem] italic text-warmgrey">{item.credit}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {readerLink && item.source === "ia" && (
            <Link to={readerLink(item)} className="rounded bg-navy px-3 py-1.5 text-sm text-white">
              Read this issue →
            </Link>
          )}
          {!pin ? (
            <button
              onClick={doPin}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                readerLink && item.source === "ia" ? "border border-ink/15 text-ink/80" : "bg-navy text-white"
              } disabled:opacity-50`}
            >
              <Pin size={14} /> Pin to my library
            </button>
          ) : boards === null ? (
            <button
              onClick={loadBoards}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/80"
            >
              Send to a trend board…
            </button>
          ) : boards.length ? (
            <select
              className="rounded border border-ink/15 bg-white px-2 py-1.5 text-sm"
              defaultValue=""
              onChange={(e) => e.target.value && sendToBoard(e.target.value)}
            >
              <option value="" disabled>
                Choose a board — the citation rides along
              </option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-warmgrey">No trend boards yet — start one in R&D → Trends.</span>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/80"
          >
            <ExternalLink size={14} /> View at the source
          </a>
        </div>
      </div>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder: string;
  busy: boolean;
}) {
  return (
    <div className="mb-4 flex gap-2 rounded-xl border border-ink/10 bg-white p-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded border border-ink/15 px-2.5 py-1.5 text-sm"
      />
      <button onClick={onSearch} disabled={busy} className="rounded bg-navy px-4 py-1.5 text-sm text-white disabled:opacity-50">
        {busy ? "Searching…" : "Search"}
      </button>
    </div>
  );
}
