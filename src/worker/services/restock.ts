import { all, first, run } from "./db";
import { sendBuyerEmail } from "./buyer-email";
import { getEmailBrand, renderBrandedEmail } from "./email-template";
import type { Env } from "../types/env";

/**
 * Back-in-stock notifications. Called when a product's stock is replenished
 * (see inventory adjust). We email everyone still waiting on that product and
 * mark them notified so nobody is emailed twice. Best-effort: a mail failure
 * never blocks the inventory write that triggered it.
 */
export async function notifyRestock(env: Env, db: D1Database, productId: string, shopBase: string): Promise<void> {
  const pending = await all<{ id: string; email: string }>(
    db,
    `SELECT id, email FROM restock_subscriptions WHERE product_id = ? AND notified_at IS NULL`,
    productId,
  );
  if (pending.length === 0) return;

  const product = await first<{ name: string; slug: string }>(
    db,
    `SELECT name, slug FROM products WHERE id = ?`,
    productId,
  );
  if (!product) return;

  const link = `${shopBase}/products/${product.slug}`;
  let brand;
  try {
    brand = await getEmailBrand(env, db);
  } catch {
    brand = null;
  }

  for (const sub of pending) {
    try {
      const html = brand
        ? renderBrandedEmail({
            brand,
            preheader: `${product.name} is back in stock`,
            heading: `${product.name} is back`,
            bodyHtml:
              `<p style="margin:0 0 16px;">Good news — the piece you were waiting for is available again.</p>` +
              `<p style="margin:0 0 20px;"><a href="${link}" style="display:inline-block;background:#1c2b3a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;">Shop it now</a></p>` +
              `<p style="color:#6f695c;font-size:12px;margin:0;">Popular sizes go quickly.</p>`,
            footerNote: "You asked to be notified when this piece came back in stock.",
          })
        : undefined;
      await sendBuyerEmail(env, {
        to: sub.email,
        subject: `${product.name} is back in stock`,
        text: `Good news — ${product.name} is available again.\n\n${link}\n\nPopular sizes go quickly.`,
        html,
      });
      await run(db, `UPDATE restock_subscriptions SET notified_at = datetime('now') WHERE id = ?`, sub.id);
    } catch (err) {
      console.error("[restock] notify failed:", String(err).slice(0, 160));
    }
  }
}
