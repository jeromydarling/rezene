import type { KbArticle } from "../types";

export const library: KbArticle[] = [
  {
    slug: "timeless-library",
    title: "The Timeless Library — plates, magazines, books and patterns",
    summary: "A public-domain archive of the craft that builds itself as you search — the Met's plates, the great Vogue and Harper's runs, the school's books, and patterns you can cut from.",
    part: "design",
    moduleRoute: "/admin/library",
    screenshot: "/kb/shots/library.png",
    keywords: "library archive vogue harpers bazar met museum plates magazines books patterns public domain cc0 pin trend board citation racinet hughes vintage historic reference",
    updated: "2026-07-12",
    body: `# The Timeless Library

**Studio → Timeless Library** is the archive of the craft, opened inside your studio: the Metropolitan Museum's open collection, the complete early runs of *Vogue* (1892–1929) and *Harper's Bazar* (1867–1929), the books the Verto School teaches from, and historic patterns you can actually cut. Everything in it is **public domain** — published before 1931 or released CC0 by its museum — so you can pin it, quote it, print it, and design from it freely.

## How it works

The library doesn't store the archive; it **fetches on request and remembers**. The first person to search "1924 cloche" pays the trip to the source; every search after that — from any shop — reads the cache. There is nothing to configure, no key, and no quota: the sources are free public APIs.

## The rooms

- **Plates** — search the Met's open collection. Every result is CC0 with a high-resolution image. Period words find more: try *toilette*, *walking suit*, *promenade dress*.
- **Magazines** — pick a shelf (*Vogue* or *Harper's Bazar*), pick a year, open an issue, and read it **page by page** — arrow keys turn pages. Any page can be pinned.
- **Books** — the school's source shelf (read Madison, Vincent, Picken, Nystrom cover to cover) plus the Archive's searchable pre-1931 stacks.
- **Patterns** — Hughes's measured diagrams cut from surviving garments, Racinet's *Coupes et Patrons*, LACMA's free pattern project, and the era's drafting books.

## Pins and citations

Pinning saves an item to **your shop's library** with its credit line attached — title, date, source, license. From any pin, one click sends it to a **trend board** in R&D, and the citation rides along automatically. That's the method from [The Language of Costume](/admin/school/language-of-costume): *a board whose directions cite their plates briefs a design team with precision no adjective reaches.*

> [!NOTE]
> Images in the reader are served live by the Internet Archive; a slow page usually just needs a second. Pinned items keep their own copies of the reference URLs, so your library outlives any source hiccup.

## Why pre-1931?

US publications from before 1931 have fully entered the public domain (the line rolls forward every January 1). The library enforces that line in its searches — everything you find here is yours to use, commercially, without asking anyone.`,
  },
];
