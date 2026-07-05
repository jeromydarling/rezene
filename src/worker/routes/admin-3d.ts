import { Hono } from "hono";
import { all, first, run, writeAudit } from "../services/db";
import {
  clo3dProjectCreateSchema,
  clo3dProjectUpdateSchema,
  parseBody,
} from "../services/validators";
import { requireAdminWrite } from "../middleware/auth";
import { newId } from "../utils/id";
import type { AppContext } from "../types/env";
import type { AdminClo3dProject } from "../../shared/types";

export const admin3dRoutes = new Hono<AppContext>();

const PROJECT_SELECT = `
  SELECT p.*, s.name AS style_name FROM clo3d_projects p
  LEFT JOIN styles s ON s.id = p.style_id`;

function mapProject(row: Record<string, unknown>): AdminClo3dProject {
  return {
    id: row.id as string,
    name: row.name as string,
    styleId: (row.style_id as string) ?? null,
    styleName: (row.style_name as string) ?? null,
    status: row.status as string,
    tool: row.tool as string,
    notes: (row.notes as string) ?? null,
    updatedAt: row.updated_at as string,
  };
}

admin3dRoutes.get("/projects", async (c) => {
  const rows = await all(c.var.db, `${PROJECT_SELECT} ORDER BY p.updated_at DESC`);
  return c.json(rows.map(mapProject));
});

admin3dRoutes.get("/projects/:id", async (c) => {
  const row = await first<Record<string, unknown>>(
    c.var.db,
    `${PROJECT_SELECT} WHERE p.id = ?`,
    c.req.param("id"),
  );
  if (!row) return c.json({ error: "Project not found" }, 404);
  const files = await all(
    c.var.db,
    `SELECT sf.id, sf.kind, sf.label, sf.created_at, f.filename, f.r2_key, f.content_type
     FROM simulation_files sf LEFT JOIN files f ON f.id = sf.file_id
     WHERE sf.project_id = ? ORDER BY sf.created_at DESC`,
    row.id,
  );
  return c.json({ ...mapProject(row), measurementsJson: row.measurements_json, files });
});

admin3dRoutes.post("/projects", requireAdminWrite, async (c) => {
  const body = await parseBody(c, clo3dProjectCreateSchema);
  const id = newId("c3d");
  await run(
    c.var.db,
    `INSERT INTO clo3d_projects (id, name, style_id, tool, notes) VALUES (?, ?, ?, ?, ?)`,
    id,
    body.name,
    body.styleId ?? null,
    body.tool ?? "clo3d",
    body.notes ?? null,
  );
  const row = await first(c.var.db, `${PROJECT_SELECT} WHERE p.id = ?`, id);
  return c.json(mapProject(row!), 201);
});

admin3dRoutes.patch("/projects/:id", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, clo3dProjectUpdateSchema);
  const existing = await first(c.var.db, `SELECT id FROM clo3d_projects WHERE id = ?`, id);
  if (!existing) return c.json({ error: "Project not found" }, 404);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) {
    sets.push(`name = ?`);
    params.push(body.name);
  }
  if (body.status !== undefined) {
    sets.push(`status = ?`);
    params.push(body.status);
  }
  if (body.measurementsJson !== undefined) {
    sets.push(`measurements_json = ?`);
    params.push(body.measurementsJson);
  }
  if (body.notes !== undefined) {
    sets.push(`notes = ?`);
    params.push(body.notes);
  }
  if (sets.length === 0) return c.json({ error: "No fields to update" }, 400);
  sets.push(`updated_at = datetime('now')`);
  await run(c.var.db, `UPDATE clo3d_projects SET ${sets.join(", ")} WHERE id = ?`, ...params, id);
  await writeAudit(c.var.db, c.var.userId, "clo3d_project.update", "clo3d_project", id, body);
  return c.json({ ok: true });
});

/** File a sample-revision task from a fit issue found in simulation. */
admin3dRoutes.post("/projects/:id/fit-issue-task", requireAdminWrite, async (c) => {
  const id = c.req.param("id");
  const project = await first<{ id: string; name: string; style_id: string | null }>(
    c.var.db,
    `SELECT id, name, style_id FROM clo3d_projects WHERE id = ?`,
    id,
  );
  if (!project) return c.json({ error: "Project not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { issue?: string };
  const issue = typeof body.issue === "string" ? body.issue.slice(0, 500) : "Fit issue from 3D simulation";
  const taskId = newId("task");
  await run(
    c.var.db,
    `INSERT INTO production_tasks (id, title, stage_id, status, style_id, notes)
     VALUES (?, ?, 'stage_sample_review', 'todo', ?, ?)`,
    taskId,
    `Sample revision: ${issue}`,
    project.style_id,
    `Created from 3D project "${project.name}".`,
  );
  return c.json({ taskId }, 201);
});
