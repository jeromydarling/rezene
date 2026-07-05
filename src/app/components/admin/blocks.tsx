import { useState } from "react";
import { ImageField } from "./cms";
import type { PageSection, SectionType } from "../../../shared/types";

/**
 * Block stack editor: add / reorder / delete / edit typed sections.
 * Each block type declares its fields; the editor renders them generically,
 * so adding a block type means one entry in SECTION_DEFS plus a renderer in
 * PageBlocks — no bespoke form code.
 */

type FieldKind = "text" | "textarea" | "markdown" | "image" | "boolean" | "select" | "number";

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  hint?: string;
}

interface SectionDef {
  type: SectionType;
  label: string;
  description: string;
  fields: FieldDef[];
  /** list sub-editors (gallery images, FAQ items) */
  list?: { key: string; itemLabel: string; fields: FieldDef[] };
}

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "home_hero",
    label: "Homepage hero",
    description: "The site hero, edited via the “Homepage hero” card — this block just places it.",
    fields: [],
  },
  {
    type: "hero",
    label: "Hero banner",
    description: "Full-width statement with optional background image and button.",
    fields: [
      { key: "eyebrow", label: "Kicker", kind: "text" },
      { key: "heading", label: "Heading", kind: "text" },
      { key: "subheading", label: "Subheading", kind: "textarea" },
      { key: "imageUrl", label: "Background image", kind: "image" },
      { key: "imageAlt", label: "Image alt text", kind: "text" },
      { key: "ctaLabel", label: "Button label", kind: "text" },
      { key: "ctaHref", label: "Button link", kind: "text" },
    ],
  },
  {
    type: "prose",
    label: "Text",
    description: "A markdown text column — the workhorse.",
    fields: [{ key: "markdown", label: "Text", kind: "markdown" }],
  },
  {
    type: "image_text",
    label: "Image + text",
    description: "Split section: image one side, copy the other.",
    fields: [
      { key: "imageUrl", label: "Image", kind: "image" },
      { key: "imageAlt", label: "Image alt text", kind: "text" },
      {
        key: "imageSide",
        label: "Image side",
        kind: "select",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      { key: "eyebrow", label: "Kicker", kind: "text" },
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Body (markdown)", kind: "markdown" },
      { key: "ctaLabel", label: "Link label", kind: "text" },
      { key: "ctaHref", label: "Link", kind: "text" },
      { key: "dark", label: "Dark (navy) background", kind: "boolean" },
    ],
  },
  {
    type: "product_grid",
    label: "Product grid",
    description: "Live products — featured or from one collection.",
    fields: [
      { key: "eyebrow", label: "Kicker", kind: "text" },
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "source",
        label: "Products from",
        kind: "select",
        options: [
          { value: "featured", label: "Featured (newest published)" },
          { value: "collection", label: "A collection" },
        ],
      },
      { key: "collectionSlug", label: "Collection slug", kind: "text", hint: "Only when “A collection” is chosen" },
      { key: "limit", label: "How many", kind: "number" },
      { key: "ctaLabel", label: "Corner link label", kind: "text" },
      { key: "ctaHref", label: "Corner link", kind: "text" },
    ],
  },
  {
    type: "collection_strip",
    label: "Collection strip",
    description: "Navy band promoting a collection (name, copy, image pulled live).",
    fields: [
      { key: "collectionSlug", label: "Collection slug", kind: "text", hint: "Empty = newest collection" },
    ],
  },
  {
    type: "gallery",
    label: "Image gallery",
    description: "A grid of captioned images.",
    fields: [
      {
        key: "columns",
        label: "Columns",
        kind: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ],
      },
    ],
    list: {
      key: "images",
      itemLabel: "Image",
      fields: [
        { key: "url", label: "Image", kind: "image" },
        { key: "alt", label: "Alt text", kind: "text" },
        { key: "caption", label: "Caption", kind: "text" },
      ],
    },
  },
  {
    type: "quote",
    label: "Quote",
    description: "A pull quote with attribution.",
    fields: [
      { key: "text", label: "Quote", kind: "textarea" },
      { key: "attribution", label: "Attribution", kind: "text" },
    ],
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Expandable questions and answers.",
    fields: [{ key: "heading", label: "Heading", kind: "text" }],
    list: {
      key: "items",
      itemLabel: "Question",
      fields: [
        { key: "q", label: "Question", kind: "text" },
        { key: "a", label: "Answer (markdown)", kind: "markdown" },
      ],
    },
  },
  {
    type: "cta_band",
    label: "Call-to-action band",
    description: "A centered call to action on a colored band.",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Body", kind: "textarea" },
      { key: "ctaLabel", label: "Button label", kind: "text" },
      { key: "ctaHref", label: "Button link", kind: "text" },
      { key: "dark", label: "Dark (navy) background", kind: "boolean" },
    ],
  },
  {
    type: "newsletter",
    label: "Email signup",
    description: "Newsletter or waitlist capture band.",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Body", kind: "textarea" },
      {
        key: "kind",
        label: "List",
        kind: "select",
        options: [
          { value: "newsletter", label: "Newsletter" },
          { value: "waitlist", label: "Waitlist" },
        ],
      },
    ],
  },
];

function sectionDef(type: string): SectionDef | undefined {
  return SECTION_DEFS.find((d) => d.type === type);
}

/** One-line summary of a block for the collapsed view. */
function summarize(section: PageSection): string {
  const s = (k: string) => (typeof section[k] === "string" ? (section[k] as string) : "");
  return (
    s("heading") ||
    s("text") ||
    s("markdown").split("\n")[0] ||
    (Array.isArray(section.items) ? `${(section.items as unknown[]).length} item(s)` : "") ||
    (Array.isArray(section.images) ? `${(section.images as unknown[]).length} image(s)` : "")
  ).slice(0, 70);
}

function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (def.kind) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {def.label}
        </label>
      );
    case "select":
      return (
        <div>
          <label className="label">{def.label}</label>
          <select
            className="input"
            value={String(value ?? def.options?.[0]?.value ?? "")}
            onChange={(e) => onChange(def.key === "columns" || def.key === "limit" ? Number(e.target.value) : e.target.value)}
          >
            {def.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {def.hint && <p className="mt-1 text-xs text-warmgrey">{def.hint}</p>}
        </div>
      );
    case "number":
      return (
        <div>
          <label className="label">{def.label}</label>
          <input
            type="number"
            min={1}
            max={12}
            className="input"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      );
    case "textarea":
      return (
        <div>
          <label className="label">{def.label}</label>
          <textarea
            rows={2}
            className="input"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "markdown":
      return (
        <div>
          <label className="label">{def.label}</label>
          <textarea
            rows={6}
            className="input font-mono !text-[0.8rem]"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "image":
      return (
        <div>
          <label className="label">{def.label}</label>
          <ImageField value={String(value ?? "")} onChange={(url) => onChange(url)} />
        </div>
      );
    default:
      return (
        <div>
          <label className="label">{def.label}</label>
          <input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
          {def.hint && <p className="mt-1 text-xs text-warmgrey">{def.hint}</p>}
        </div>
      );
  }
}

function ListEditor({
  def,
  items,
  onChange,
}: {
  def: NonNullable<SectionDef["list"]>;
  items: Record<string, unknown>[];
  onChange: (next: Record<string, unknown>[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded border border-ink/10 bg-cream/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-warmgrey">
            <span>
              {def.itemLabel} {i + 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="link-quiet disabled:opacity-30"
                disabled={i === 0}
                onClick={() => {
                  const next = [...items];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="link-quiet disabled:opacity-30"
                disabled={i === items.length - 1}
                onClick={() => {
                  const next = [...items];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  onChange(next);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="text-red-700 hover:underline"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {def.fields.map((field) => (
              <Field
                key={field.key}
                def={field}
                value={item[field.key]}
                onChange={(v) => {
                  const next = [...items];
                  next[i] = { ...next[i], [field.key]: v };
                  onChange(next);
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary !px-3 !py-1.5 !text-[0.68rem]"
        onClick={() => onChange([...items, {}])}
      >
        Add {def.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

export function BlockEditor({
  sections,
  onChange,
}: {
  sections: PageSection[];
  onChange: (next: PageSection[]) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const update = (i: number, patch: Record<string, unknown>) => {
    const next = [...sections];
    next[i] = { ...next[i], ...patch } as PageSection;
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpenIndex(null);
  };

  return (
    <div className="space-y-2">
      {sections.map((section, i) => {
        const def = sectionDef(section.type);
        const open = openIndex === i;
        return (
          <div key={i} className="rounded border border-ink/15 bg-white">
            <div className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => setOpenIndex(open ? null : i)}
              >
                <span className="text-sm font-medium">{def?.label ?? section.type}</span>
                <span className="ml-2 text-xs text-warmgrey">{summarize(section)}</span>
              </button>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" className="link-quiet disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="link-quiet disabled:opacity-30"
                  disabled={i === sections.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-warmgrey hover:text-red-700"
                  onClick={() => {
                    onChange(sections.filter((_, j) => j !== i));
                    setOpenIndex(null);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {open && def && (
              <div className="space-y-3 border-t border-ink/10 px-3 py-3">
                <p className="text-xs text-warmgrey">{def.description}</p>
                {def.fields.map((field) => (
                  <Field
                    key={field.key}
                    def={field}
                    value={section[field.key]}
                    onChange={(v) => update(i, { [field.key]: v })}
                  />
                ))}
                {def.list && (
                  <ListEditor
                    def={def.list}
                    items={(Array.isArray(section[def.list.key]) ? section[def.list.key] : []) as Record<string, unknown>[]}
                    onChange={(items) => update(i, { [def.list!.key]: items })}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="rounded border border-ink/15 bg-white p-3">
          <p className="label">Add a block</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTION_DEFS.map((def) => (
              <button
                key={def.type}
                type="button"
                className="rounded border border-ink/10 px-3 py-2 text-left hover:border-navy"
                onClick={() => {
                  onChange([...sections, { type: def.type } as PageSection]);
                  setOpenIndex(sections.length);
                  setAdding(false);
                }}
              >
                <p className="text-sm font-medium">{def.label}</p>
                <p className="text-xs text-warmgrey">{def.description}</p>
              </button>
            ))}
          </div>
          <button type="button" className="link-quiet mt-2 text-xs" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary w-full" onClick={() => setAdding(true)}>
          + Add block
        </button>
      )}
    </div>
  );
}
