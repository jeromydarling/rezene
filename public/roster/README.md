# Verto model roster

`<id>.jpg` — the shared, platform-wide cast of models the Look Studio tries
garments onto (served at `/roster/<id>.jpg`, listed by `GET /api/admin/fitting/roster`).

## What they are

28 fixed personas (16 women, 12 men) spanning build, skin tone, and age. Each
was generated **once** against a single locked lighting/camera/pose template
(`HOUSE_STYLE` in `src/shared/fitting-models.ts`) wearing a neutral heather-grey
base outfit on a seamless warm-grey backdrop — so the whole cast reads like one
photoshoot and every try-on sits in a consistent frame.

The persona list, seeds, and the exact prompt builder live in
`src/shared/fitting-roster.ts` (`ROSTER`, `rosterModelPrompt`), so the cast is
reproducible and extendable.

## Provenance & license

Generated with an AI image model (Google's nano-banana / Gemini image, via the
Higgsfield API). They are synthetic people — not photographs of real
individuals — and are used under the generating service's commercial-use terms.
Re-render or extend the roster from `fitting-roster.ts` rather than editing these
JPEGs by hand.
