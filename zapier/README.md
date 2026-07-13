# Verto — Zapier integration

The native Zapier app for Verto. Triggers, actions and search over the Verto
developer API (`/api/v1`), authenticated with a personal access token.

> **Status: scaffold (unverified).** This package was authored to the official
> Zapier Platform CLI structure but has **not** yet been run through
> `zapier test` / `zapier push` against a live Zapier account. Before shipping,
> run the steps below and fix anything the validator flags.

## What's here

- **Auth** (`authentication.js`) — custom API-key auth. The user pastes a Verto
  PAT (minted in Verto → Account → Settings → API keys); `test` hits
  `GET /api/v1/me` and labels the connection with the shop name. A
  `beforeRequest` injects `Authorization: Bearer <key>`.
- **Triggers** (`triggers/hooks.js`) — REST Hooks for every Verto event
  (subscribe → `POST /api/v1/subscriptions`, unsubscribe →
  `DELETE /api/v1/subscriptions/:id`, instant `perform`, and a `performList`
  polling fallback over `GET /api/v1/events`). Catalog mirrors
  `src/shared/workflows.ts` `WORKFLOW_TRIGGERS`.
- **Creates** (`creates/`) — Create Client / Booking / Note.
- **Search** (`searches/`) — Find Client by email (pairs as search-or-create).

## Ship from CI (no local terminal)

The `.github/workflows/zapier.yml` workflow runs the whole CLI headlessly.
From the repo's **Actions** tab → **Zapier deploy** → **Run workflow**:

1. One-time setup (Settings → Secrets and variables → Actions):
   - Secret **`ZAPIER_DEPLOY_KEY`** — from the Zapier developer dashboard
     (developer.zapier.com → account → Deploy Keys). The only credential to fetch.
   - Optional: **`ZAPIER_TEST_API_KEY`** (a live Verto PAT) and
     **`ZAPIER_TEST_BASE_URL`** for an end-to-end test.
2. Run with **mode = register** once → it creates the CLI app and prints/uploads
   `.zapierapprc`; copy its numeric `id` into an Actions **Variable**
   `ZAPIER_APP_ID`.
3. Run with **mode = push** to validate, test, and upload a new version.
   Run **mode = validate** any time for a dry check.

Then finish in the Zapier web UI: open the integration, add a test Zap, connect
with a PAT, and share the private invite link.

## Or develop locally

```bash
cd zapier
npm install
npm install -g zapier-platform-cli   # if you don't have it
zapier login
zapier register "Verto"              # first time only — creates the app
zapier validate                      # schema + style checks
zapier test                          # runs test/ (needs a real PAT, see below)
zapier push                          # uploads a new version
```

### Testing against a real shop

`zapier test` and the auth flow need a live Verto PAT. Point at a real (or
staging) shop:

```bash
export API_KEY="vrto_<shop>_<id>.<secret>"
export BASE_URL="https://verto.style"    # or your staging host
npm test
```

### Private beta vs. public listing

- **Private (do this first):** after `zapier push`, the app is private. Share an
  **invite link** (`zapier users:add` / the developer dashboard) — up to 100
  users, or an unlimited public invite link. No Zapier review needed.
- **Public listing (later):** requires Zapier's review — a publicly-launched
  (non-beta) integration, all-HTTPS, no hardcoded creds, every trigger/action/
  search with passing test-Zap history, and a non-expiring test account shared
  with `integration-testing@zapier.com`.

## Keeping in sync with Verto

The trigger catalog in `triggers/hooks.js` must match
`src/shared/workflows.ts` `WORKFLOW_TRIGGERS`. When Verto adds a trigger there,
add the matching entry to `EVENTS` here.
