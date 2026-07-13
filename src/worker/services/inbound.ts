import { first, run } from "./db";
import { newId } from "../utils/id";
import { emit, type EmitOpts } from "./activity";

/**
 * Ingest — the shared create logic behind BOTH inbound paths: the token-URL
 * webhook (`routes/hooks.ts`, no app needed) and the bearer-authenticated
 * developer API (`routes/api-v1.ts`, the native Zapier app). One place so a
 * note/client/booking is created and emitted identically however it arrived.
 *
 * Every ingest is create-only, emits its domain event (so automations and
 * workflows react), and emits `inbound.received` (so a shop can build a
 * workflow that fires on "something arrived from outside"). `source` only
 * colours the activity-feed wording.
 */

export interface IngestClient {
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
}
export interface IngestBooking {
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  preferredAt?: string | null;
}
export interface IngestNote {
  subject?: string | null;
  body?: string | null;
  clientEmail?: string | null;
}

const sourceWord = (source: string) => (source === "zapier" ? "Zapier" : source === "api" ? "the API" : "a webhook");

async function emitInbound(db: D1Database, kind: string, title: string, opts: EmitOpts, extra?: Record<string, unknown>) {
  await emit(
    db,
    { kind: "inbound.received", entityType: "webhook", entityId: kind, title, payload: { inboundType: kind, ...extra } },
    opts,
  );
}

export async function ingestClient(
  db: D1Database,
  data: IngestClient,
  opts: EmitOpts,
  source = "api",
): Promise<{ id: string }> {
  const id = newId("client");
  const name = data.name.trim();
  await run(
    db,
    `INSERT INTO clients (id, name, email, phone, style_notes) VALUES (?, ?, ?, ?, ?)`,
    id,
    name,
    data.email?.trim() || null,
    data.phone?.trim() || null,
    data.note?.trim() || null,
  );
  await emit(
    db,
    {
      kind: "client.created",
      entityType: "client",
      entityId: id,
      title: `New client via ${sourceWord(source)}: ${name}`,
      payload: { clientId: id, name },
    },
    opts,
  );
  await emitInbound(db, "client", `Client added via ${sourceWord(source)}: ${name}`, opts);
  return { id };
}

export async function ingestBooking(
  db: D1Database,
  data: IngestBooking,
  opts: EmitOpts,
  source = "api",
): Promise<{ id: string }> {
  const id = newId("book");
  const name = data.name.trim();
  await run(
    db,
    `INSERT INTO booking_requests (id, name, email, phone, note, preferred_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    name,
    data.email?.trim() || null,
    data.phone?.trim() || null,
    data.note?.trim() || null,
    data.preferredAt?.trim() || null,
  );
  await emitInbound(db, "booking", `Consult request via ${sourceWord(source)}: ${name}`, opts);
  return { id };
}

export async function ingestNote(
  db: D1Database,
  data: IngestNote,
  opts: EmitOpts,
  source = "api",
): Promise<{ clientId: string | null }> {
  const subject = data.subject?.trim() || "Inbound note";
  const noteBody = data.body?.trim() || "";
  let clientId: string | null = null;
  if (data.clientEmail?.trim()) {
    const match = await first<{ id: string }>(
      db,
      `SELECT id FROM clients WHERE lower(email) = lower(?)`,
      data.clientEmail.trim(),
    ).catch(() => null);
    if (match) {
      clientId = match.id;
      await run(
        db,
        `INSERT INTO client_events (id, client_id, kind, subject, body_md, event_at)
         VALUES (?, ?, 'note', ?, ?, datetime('now'))`,
        newId("cev"),
        clientId,
        subject.slice(0, 200),
        noteBody || null,
      ).catch(() => {});
    }
  }
  await emitInbound(db, "note", subject.slice(0, 200), opts, { subject, body: noteBody, clientId, source });
  return { clientId };
}
