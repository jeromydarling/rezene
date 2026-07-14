import { Hono } from "hono";
import { z } from "zod";
import { parseBody } from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import {
  listLookbooks,
  createLookbook,
  updateLookbook,
  deleteLookbook,
  resolveRenderModel,
  availableProducts,
} from "../services/lookbook";
import type { AppContext } from "../types/env";

/**
 * Lookbook builder: a shop's print-ready seasonal magazine, composed from its
 * own products + brand identity. Reads resolve product data live; the client
 * renders the print HTML and (Phase A) saves a preview PDF.
 */
export const adminLookbookRoutes = new Hono<AppContext>();

adminLookbookRoutes.get("/", async (c) => {
  const rows = await listLookbooks(c.var.db);
  return c.json(rows);
});

/** The pool of products available to add to a lookbook (published + sellable). */
adminLookbookRoutes.get("/catalog", async (c) => {
  return c.json(await availableProducts(c.var.db));
});

adminLookbookRoutes.get("/:id", async (c) => {
  const model = await resolveRenderModel(c.var.db, c.req.param("id"));
  if (!model) return c.json({ error: "Lookbook not found" }, 404);
  return c.json(model);
});

const createSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(200).optional(),
  intro: z.string().max(4000).optional(),
});

adminLookbookRoutes.post("/", requireAdminWrite, async (c) => {
  const body = await parseBody(c, createSchema);
  const created = await createLookbook(c.var.db, body);
  return c.json(created, 201);
});

const layoutEnum = z.enum(["hero", "editorial", "clean"]);
const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(200).nullable().optional(),
  intro: z.string().max(4000).nullable().optional(),
  template: z.string().max(40).optional(),
  spec: z
    .object({
      spreads: z
        .array(
          z.object({
            productId: z.string().max(64),
            layout: layoutEnum,
            caption: z.string().max(400).optional(),
          }),
        )
        .max(60),
    })
    .optional(),
});

adminLookbookRoutes.patch("/:id", requireAdminWrite, async (c) => {
  const body = await parseBody(c, updateSchema);
  const updated = await updateLookbook(c.var.db, c.req.param("id"), body);
  if (!updated) return c.json({ error: "Lookbook not found" }, 404);
  return c.json(updated);
});

adminLookbookRoutes.delete("/:id", requireAdminWrite, async (c) => {
  const ok = await deleteLookbook(c.var.db, c.req.param("id"));
  if (!ok) return c.json({ error: "Lookbook not found" }, 404);
  return c.json({ ok: true });
});
