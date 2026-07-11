# Knowledge Base screenshots

Chapter hero images live here as `<slug>.png` (referenced by each article's
`screenshot` field). They are captured, not committed by hand.

## Regenerate

```
npm i -D playwright-core   # if not present; Chromium is pre-installed on CI
node scripts/capture-kb-screenshots.mjs
git add public/kb/shots && git commit -m "chore: refresh KB screenshots"
```

No credentials needed: the script signs into the public demo shop
(verto.style/maison) with its well-known read-only login. Set
KB_EMAIL / KB_PASSWORD / KB_BASE to photograph a different shop.

Run it from a machine with direct network access (a CI runner or your laptop).
Until the PNGs exist, the reader simply hides the hero image — no broken images.

## Staleness

Shots refresh themselves: the capture workflow re-runs after every successful
"Migrate & secrets" run on main and weekly (Mon 07:00 UTC) as a backstop. A
perceptual gate only rewrites a PNG when >0.3% of pixels changed, so dates and
counters don't churn commits — a shot updates when the page actually moved.
Dispatch the workflow manually with force=true for a full rewrite.
