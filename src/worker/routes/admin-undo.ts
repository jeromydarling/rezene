import { Hono } from "hono";
import { requireAdminWrite } from "../middleware/auth";
import { restore } from "../services/tombstone";
import type { AppContext } from "../types/env";

/** Undo — restores a soft-deleted row from its tombstone. The toast's Undo
 *  button posts here within the 30-day shelf life (practically: seconds). */
export const adminUndoRoutes = new Hono<AppContext>();

adminUndoRoutes.post("/:id", requireAdminWrite, async (c) => {
  const result = await restore(c.var.db, c.req.param("id"));
  if (!result.ok) return c.json({ error: result.error }, 410);
  return c.json({ ok: true });
});
