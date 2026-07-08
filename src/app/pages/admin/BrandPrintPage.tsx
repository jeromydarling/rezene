import { useEffect, useMemo, useState } from "react";
import { PageHeader, LoadingTable } from "../../components/admin/ui";
import { useFetch } from "../../lib/useFetch";
import { useToast } from "../../lib/toast";
import type { BrandSettings } from "../../../shared/types";
import { typePairing } from "../../../shared/brand-identity";
import {
  TEMPLATES,
  template as getTemplate,
  collateralBrand,
  buildPrintDoc,
  EMPTY_FIELDS,
  type CollateralFields,
} from "../../lib/collateral";

const FIELD_META: Record<keyof CollateralFields, { label: string; placeholder?: string; area?: boolean }> = {
  personName: { label: "Name" },
  personTitle: { label: "Title / role", placeholder: "Founder" },
  email: { label: "Email" },
  phone: { label: "Phone" },
  message: { label: "Message", area: true },
  composition: { label: "Fibre composition", placeholder: "100% organic cotton" },
  care: { label: "Care instructions", area: true },
  madeIn: { label: "Made in", placeholder: "Portugal" },
};

export function BrandPrintPage() {
  const toast = useToast();
  const settings = useFetch<BrandSettings>("/api/public/settings");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [fields, setFields] = useState<CollateralFields>(EMPTY_FIELDS);

  const t = getTemplate(templateId);
  const website = typeof window !== "undefined" ? window.location.host : "yourlabel.com";
  const brand = useMemo(
    () => (settings.data ? collateralBrand(settings.data, website) : null),
    [settings.data, website],
  );

  // Load the pairing's web fonts so the preview renders truthfully.
  useEffect(() => {
    const p = typePairing(settings.data?.typography?.pairing);
    if (!p.googleUrl) return;
    const id = `brand-font-${p.key}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = p.googleUrl;
    document.head.appendChild(link);
  }, [settings.data?.typography?.pairing]);

  function printIt() {
    if (!brand) return;
    const doc = buildPrintDoc(t, brand, fields);
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up blocked", "Allow pop-ups for this site to open the print sheet.");
      return;
    }
    w.document.write(doc);
    w.document.close();
  }

  if (settings.loading || !brand) return <LoadingTable rows={6} />;

  // Preview scaled to fit ~360px wide.
  const scale = Math.min(360 / (t.w * 96), 460 / (t.h * 96));
  const boxW = t.w * 96 * scale;
  const boxH = t.h * 96 * scale;

  return (
    <div>
      <PageHeader
        eyebrow="Brand"
        title="Print Shop"
        description="Print-ready collateral, composed from your brand identity. Pick a piece, fill in the details, and Save as PDF at the exact trim size — hand it straight to a printer."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Controls */}
        <div className="space-y-5">
          <div className="admin-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-warmgrey">Choose a piece</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-md border p-3 text-left ${templateId === tpl.id ? "border-navy ring-1 ring-navy" : "border-ink/15 hover:border-ink/40"}`}
                >
                  <p className="text-sm font-medium">{tpl.label}</p>
                  <p className="text-[11px] text-warmgrey">{tpl.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          {t.fields.length > 0 && (
            <div className="admin-card space-y-3 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warmgrey">Details</h2>
              {t.fields.map((key) => {
                const meta = FIELD_META[key];
                return (
                  <label key={key} className="block">
                    <span className="mb-1 block text-xs font-medium text-warmgrey">{meta.label}</span>
                    {meta.area ? (
                      <textarea
                        className="input min-h-[70px] text-sm"
                        value={fields[key]}
                        placeholder={meta.placeholder}
                        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                      />
                    ) : (
                      <input
                        className="input text-sm"
                        value={fields[key]}
                        placeholder={meta.placeholder}
                        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={printIt}>
            Print / Save as PDF
          </button>
          <p className="max-w-md text-[11px] text-warmgrey">
            Opens a print sheet sized to {t.w}″ × {t.h}″ with a full-bleed background. In the print dialog choose
            “Save as PDF”, set margins to <strong>None</strong>, and it's ready for a printer. Uploaded logos and
            your palette + type come straight from the Brand Studio.
          </p>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warmgrey">Preview</p>
          <div className="flex justify-center rounded-xl border border-ink/10 bg-cream/50 p-6">
            <div
              style={{ width: boxW, height: boxH }}
              className="overflow-hidden rounded shadow-[0_10px_40px_-12px_rgba(0,0,0,0.4)]"
            >
              <div
                className="[&_*]:max-w-full [&_*]:[overflow-wrap:break-word]"
                style={{
                  width: `${t.w}in`,
                  height: `${t.h}in`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
                dangerouslySetInnerHTML={{ __html: t.render(brand, fields) }}
              />
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-warmgrey">
            {t.label} · {t.w}″ × {t.h}″ trim
          </p>
        </div>
      </div>
    </div>
  );
}
