# Knowledge Base screenshots

Chapter hero images live here as `<slug>.png` (referenced by each article's
`screenshot` field). They are captured, not committed by hand.

## Regenerate

```
npm i -D playwright-core   # if not present; Chromium is pre-installed on CI
KB_EMAIL=you@example.com KB_PASSWORD=... node scripts/capture-kb-screenshots.mjs
git add public/kb/shots && git commit -m "chore: refresh KB screenshots"
```

Run it from a machine with direct network access (a CI runner or your laptop).
Until the PNGs exist, the reader simply hides the hero image — no broken images.
