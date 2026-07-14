import { Hono } from "hono";
import type { AppContext } from "../types/env";

/**
 * Public unsubscribe for HQ marketing email. Two entrances, one outcome:
 *  - POST: RFC 8058 one-click (Gmail/Yahoo call this directly from the
 *    List-Unsubscribe-Post header) and the confirm button below.
 *  - GET: a human landing from the email's footer link — shows a one-button
 *    confirm page rather than unsubscribing on GET, because inbox link
 *    scanners prefetch GETs and would silently unsubscribe everyone.
 * The token is an HMAC of the address, so links can't be forged or enumerated.
 */
export const marketingPublicRoutes = new Hono<AppContext>();

function page(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verto</title></head>
<body style="margin:0;font-family:Georgia,serif;background:#faf7f2;color:#1f2933;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:26rem;padding:2.5rem;text-align:center;">${body}</div></body></html>`;
}

marketingPublicRoutes.get("/unsubscribe", async (c) => {
  const email = (c.req.query("e") ?? "").toLowerCase();
  const token = c.req.query("t") ?? "";
  const { verifyUnsubscribeToken } = await import("../services/hq-marketing");
  if (!email || !(await verifyUnsubscribeToken(c.env, email, token))) {
    return c.html(page(`<h1 style="font-weight:400;">This link isn't valid.</h1><p style="color:#6f695c;">It may have been trimmed by your mail client — try copying the full link.</p>`), 400);
  }
  return c.html(
    page(
      `<h1 style="font-weight:400;">Unsubscribe from Verto email?</h1>
       <p style="color:#6f695c;">We'll stop sending news and updates to <strong>${email.replace(/</g, "&lt;")}</strong>. Account and receipt email still arrives.</p>
       <form method="post" action="/api/public/marketing/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}">
         <button type="submit" style="background:#1d2735;color:#fff;border:0;padding:0.75rem 1.75rem;font-size:1rem;cursor:pointer;">Unsubscribe</button>
       </form>`,
    ),
  );
});

marketingPublicRoutes.post("/unsubscribe", async (c) => {
  const email = (c.req.query("e") ?? "").toLowerCase();
  const token = c.req.query("t") ?? "";
  const { verifyUnsubscribeToken, suppress } = await import("../services/hq-marketing");
  if (!email || !(await verifyUnsubscribeToken(c.env, email, token))) {
    return c.json({ error: "invalid token" }, 400);
  }
  await suppress(c.env, email, "unsubscribed", "link");
  // One-click callers (mail clients) just need the 200; humans get a page.
  const accept = c.req.header("accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(page(`<h1 style="font-weight:400;">You're unsubscribed.</h1><p style="color:#6f695c;">No more marketing email from Verto. Changed your mind? Just reply to any of our messages.</p>`));
  }
  return c.json({ ok: true });
});
