import { useState } from "react";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { RoomNav, ItemGrid, ItemDrawer, SearchBar, type LibraryItem } from "./shared";

/** The Plates room: live search over the Met's CC0 collection. */

const STARTERS = ["fashion plate", "evening dress 1920s", "corset", "silk gown", "embroidery sample", "kimono", "tailored coat"];

export function PlatesRoomPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [costumeOnly, setCostumeOnly] = useState(false);

  const search = async (query = q) => {
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await api.get<{ items: LibraryItem[] }>(
        `/api/admin/library/search?room=plates&q=${encodeURIComponent(query.trim())}${costumeOnly ? "&dept=8" : ""}`,
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
        title="Plates"
        eyebrow="Timeless Library"
        description="The Metropolitan Museum's open collection — every result is CC0, free to pin, quote, and print. First search pays the trip; the library remembers."
        help="timeless-library"
      />
      <RoomNav active="plates" />

      <SearchBar value={q} onChange={setQ} onSearch={() => search()} busy={busy} placeholder="Search the Met — 'fashion plate', 'evening dress 1925', 'brocade'…" />
      <label className="-mt-2 mb-4 flex items-center gap-2 text-xs text-ink/70">
        <input type="checkbox" checked={costumeOnly} onChange={(e) => setCostumeOnly(e.target.checked)} />
        Costume Institute only — garments and accessories, no paintings
      </label>

      {items === null && (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQ(s);
                void search(s);
              }}
              className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/70 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {items !== null && items.length === 0 && !busy && (
        <EmptyState title="Nothing in the open collection for that" hint="Try broader words — period terms ('walking suit', 'toilette') often find more than modern ones." />
      )}
      {items && items.length > 0 && <ItemGrid items={items} onOpen={setOpen} />}

      <ItemDrawer item={open} room="plates" onClose={() => setOpen(null)} />
    </div>
  );
}
