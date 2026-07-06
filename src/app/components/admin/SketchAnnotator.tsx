import { useRef, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import type { SketchAnnotation } from "../TechPackContent";

/**
 * Flat-sketch annotator: upload a technical flat, click to drop numbered
 * callout pins, type each note. Pins are stored as percent coordinates on
 * the flat_sketch section so they render identically in the tech pack
 * view, the print/PDF, and the factory portal. This is the point-callout
 * workflow Techpacker/Backbone lock inside their editors — here it's the
 * same document everyone already sees.
 */
export function SketchAnnotator({
  techPackId,
  initialImageUrl,
  initialAnnotations,
  initialCaption,
  onSaved,
}: {
  techPackId: string;
  initialImageUrl: string | null;
  initialAnnotations: SketchAnnotation[];
  initialCaption: string | null;
  onSaved?: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [annotations, setAnnotations] = useState<SketchAnnotation[]>(initialAnnotations);
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [selected, setSelected] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  async function uploadSketch(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("entityType", "tech_pack");
      form.set("entityId", techPackId);
      form.set("isPublic", "1"); // factory portal is unauthenticated
      const res = await api.upload<{ id: string }>("/api/admin/files/upload", form);
      setImageUrl(`/media/${res.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addPin(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    const n = annotations.length ? Math.max(...annotations.map((a) => a.n)) + 1 : 1;
    setAnnotations([...annotations, { n, x, y, text: "" }]);
    setSelected(n);
    setSaved(false);
  }

  function updateText(n: number, text: string) {
    setAnnotations(annotations.map((a) => (a.n === n ? { ...a, text } : a)));
    setSaved(false);
  }

  function removePin(n: number) {
    // Renumber so the legend stays 1..N contiguous.
    const kept = annotations.filter((a) => a.n !== n).sort((a, b) => a.n - b.n);
    setAnnotations(kept.map((a, i) => ({ ...a, n: i + 1 })));
    setSelected(null);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/admin/tech-packs/${techPackId}/sections/flat_sketch`, {
        content: {
          imageUrl,
          caption: caption || undefined,
          annotations: annotations.filter((a) => a.text.trim()),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...annotations].sort((a, b) => a.n - b.n);

  return (
    <div className="space-y-4">
      {error && <p className="field-error">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Canvas */}
        <div>
          {imageUrl ? (
            <div className="relative inline-block max-w-full select-none">
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Flat sketch"
                onClick={addPin}
                className="max-h-[70vh] w-auto cursor-crosshair rounded border border-ink/15"
              />
              {sorted.map((a) => (
                <button
                  key={a.n}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(a.n);
                  }}
                  className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[0.7rem] font-bold shadow ${
                    selected === a.n ? "border-navy bg-navy text-white" : "border-white bg-terracotta text-white"
                  }`}
                  style={{ left: `${a.x}%`, top: `${a.y}%` }}
                >
                  {a.n}
                </button>
              ))}
            </div>
          ) : (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-ink/20 text-center text-sm text-warmgrey hover:border-navy">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void uploadSketch(e.target.files[0])}
              />
              {uploading ? "Uploading…" : "Upload a technical flat (front, back, details)"}
            </label>
          )}
          {imageUrl && (
            <p className="mt-1.5 text-xs text-warmgrey">
              Click the image to drop a numbered callout.{" "}
              <label className="cursor-pointer underline">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && void uploadSketch(e.target.files[0])}
                />
                Replace image
              </label>
            </p>
          )}
        </div>

        {/* Callouts */}
        <div className="space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-warmgrey">
            Callouts ({sorted.length})
          </p>
          {sorted.length === 0 && <p className="text-sm text-warmgrey">Click the flat to add the first callout.</p>}
          {sorted.map((a) => (
            <div
              key={a.n}
              className={`rounded border p-2 ${selected === a.n ? "border-navy bg-cream/50" : "border-ink/10"}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terracotta text-[0.65rem] font-bold text-white">
                  {a.n}
                </span>
                <input
                  autoFocus={selected === a.n && !a.text}
                  className="input !py-1 text-sm"
                  placeholder="e.g. Bartack at pocket mouth"
                  value={a.text}
                  onChange={(e) => updateText(a.n, e.target.value)}
                  onFocus={() => setSelected(a.n)}
                />
                <button
                  type="button"
                  onClick={() => removePin(a.n)}
                  className="shrink-0 text-xs text-warmgrey hover:text-red-700"
                  aria-label="Remove callout"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {imageUrl && (
            <div className="pt-2">
              <label className="label">Caption (optional)</label>
              <input
                className="input !py-1 text-sm"
                placeholder="Front & back flat, SS27"
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {imageUrl && (
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save sketch & callouts"}
        </button>
      )}
    </div>
  );
}
