import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageHeader } from "../../../components/admin/ui";
import { api } from "../../../lib/api";
import { RoomNav, type LibraryPin } from "./shared";

/** The Timeless Library's foyer: four rooms and the shop's recent pins.
 *  Room cards wear plates the school already curated — the library and the
 *  school are the same archive, entered from different doors. */

interface Overview {
  rooms: { room: string; pins: number }[];
  magazines: { key: string; title: string; years: [number, number]; about: string }[];
  recentPins: LibraryPin[];
}

const ROOM_CARDS = [
  {
    room: "plates",
    title: "Plates",
    blurb: "Search the Met's open collection — fashion plates, garments, drawings, all CC0.",
    art: "/school/language-of-costume/lesson0-racinet-court-dress-france-17th-century.jpg",
  },
  {
    room: "magazines",
    title: "Magazines",
    blurb: "Vogue from its first issue (1892) and six decades of Harper's Bazar — read page by page.",
    art: "/school/fashion-drawing/lesson3-steinmetz-parasol-etching.jpg",
  },
  {
    room: "books",
    title: "Books",
    blurb: "The school's source shelf and the Archive's pre-1931 stacks, searchable.",
    art: "/school/the-trouser/lesson0-walking-trousers-draft.jpg",
  },
  {
    room: "patterns",
    title: "Patterns",
    blurb: "Historic drafts and free period patterns — Hughes's diagrams, LACMA's pattern project.",
    art: "/school/language-of-costume/lesson2-hughes-corset-patterns-1620-1705.jpg",
  },
];

export function LibraryHomePage() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    api.get<Overview>("/api/admin/library/overview").then(setData).catch(() => {});
  }, []);
  const pinsFor = (room: string) => data?.rooms.find((r) => r.room === room)?.pins ?? 0;

  return (
    <div>
      <PageHeader
        title="The Timeless Library"
        eyebrow="School & Library"
        description="The public-domain archive of the craft — the Met's plates, the great magazine runs, the books the school teaches from. It builds itself as you search; what you pin is yours, citation included."
        help="timeless-library"
      />
      <RoomNav active="" />

      <div className="grid gap-4 sm:grid-cols-2">
        {ROOM_CARDS.map((card) => (
          <Link
            key={card.room}
            to={`/admin/library/${card.room}`}
            className="group overflow-hidden rounded-2xl border border-ink/10 bg-white transition-shadow hover:shadow-md"
          >
            <div className="h-44 overflow-hidden bg-ink/[0.04]">
              <img
                src={card.art}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
            <div className="p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-light text-ink">{card.title}</h2>
                {pinsFor(card.room) > 0 && (
                  <span className="text-xs text-warmgrey">{pinsFor(card.room)} pinned</span>
                )}
              </div>
              <p className="mt-1 text-sm text-warmgrey">{card.blurb}</p>
            </div>
          </Link>
        ))}
      </div>

      {data && data.recentPins.length > 0 && (
        <div className="mt-8">
          <p className="section-head mb-3 text-ink/70">Recently pinned</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {data.recentPins.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                title={`${p.title} — ${p.credit}`}
                className="block overflow-hidden rounded-lg border border-ink/10 bg-white"
              >
                <div className="aspect-[3/4] bg-ink/[0.04]">
                  {p.thumb && <img src={p.thumb} alt={p.title} loading="lazy" className="h-full w-full object-cover" />}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-warmgrey">
        Everything here is public domain — published before 1931, or released CC0 by its museum. Every pin keeps its
        credit line, and sending a pin to a trend board carries the citation with it (the method from{" "}
        <Link to="/admin/school/language-of-costume" className="text-navy underline">
          The Language of Costume
        </Link>
        ).
      </p>
    </div>
  );
}
