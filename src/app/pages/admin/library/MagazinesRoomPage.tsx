import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { PageHeader, EmptyState } from "../../../components/admin/ui";
import { api, ApiRequestError } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import { RoomNav, ItemGrid, ItemDrawer, type LibraryItem } from "./shared";

/** The Magazines room: the great runs, browsed shelf → year → issue. */

interface Magazine {
  key: string;
  title: string;
  publisher: string;
  years: [number, number];
  about: string;
}

export function MagazinesRoomPage() {
  const { magKey, year } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [mags, setMags] = useState<Magazine[]>([]);
  const [issues, setIssues] = useState<LibraryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<LibraryItem | null>(null);

  useEffect(() => {
    api.get<Magazine[]>("/api/admin/library/magazines").then(setMags).catch(() => {});
  }, []);

  const mag = useMemo(() => mags.find((m) => m.key === magKey) || null, [mags, magKey]);

  useEffect(() => {
    setIssues(null);
    if (!magKey || !year) return;
    setBusy(true);
    api
      .get<{ items: LibraryItem[] }>(`/api/admin/library/magazines/${magKey}/${year}`)
      .then((r) => setIssues(r.items))
      .catch((err) => toast.error(err instanceof ApiRequestError ? err.message : "The archive isn't answering — try again."))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magKey, year]);

  const iaIdOf = (item: LibraryItem) => item.key.replace(/^ia:/, "");

  return (
    <div>
      <PageHeader
        title="Magazines"
        eyebrow="Timeless Library"
        description="The runs that defined the century's eye — every issue scanned, every page readable. Pick a shelf, pick a year, open an issue."
        help="timeless-library"
      />
      <RoomNav active="magazines" />

      {/* Shelves */}
      <div className="grid gap-4 sm:grid-cols-2">
        {mags.map((m) => (
          <button
            key={m.key}
            onClick={() => navigate(`/admin/library/magazines/${m.key}/${m.key === magKey ? year || m.years[1] : m.years[1]}`)}
            className={`rounded-2xl border p-4 text-left transition-shadow hover:shadow-md ${
              m.key === magKey ? "border-navy bg-navy/[0.04]" : "border-ink/10 bg-white"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-light text-ink">{m.title}</h2>
              <span className="text-xs text-warmgrey">
                {m.years[0]}–{m.years[1]}
              </span>
            </div>
            <p className="mt-1 text-sm text-warmgrey">{m.about}</p>
          </button>
        ))}
      </div>

      {/* Year strip */}
      {mag && (
        <div className="mt-5 flex flex-wrap gap-1">
          {Array.from({ length: mag.years[1] - mag.years[0] + 1 }, (_, i) => mag.years[0] + i).map((y) => (
            <button
              key={y}
              onClick={() => navigate(`/admin/library/magazines/${mag.key}/${y}`)}
              className={`rounded px-2 py-0.5 text-xs tabular-nums ${
                String(y) === year ? "bg-navy text-white" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Issues */}
      <div className="mt-5">
        {busy && <div className="skeleton h-48 rounded-xl" />}
        {issues && issues.length === 0 && !busy && (
          <EmptyState title="No issues on this shelf for that year" hint="Some years are thin in the scan runs — try the year on either side." />
        )}
        {issues && issues.length > 0 && <ItemGrid items={issues} onOpen={setOpen} />}
      </div>

      <ItemDrawer
        item={open}
        room="magazines"
        onClose={() => setOpen(null)}
        readerLink={(item) => `/admin/library/read/${iaIdOf(item)}`}
      />
    </div>
  );
}
