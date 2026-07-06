import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useFetch } from "../../lib/useFetch";
import { api, ApiRequestError } from "../../lib/api";
import { formatMoney, titleCase } from "../../lib/format";
import {
  EmptyState,
  ErrorNote,
  LoadingTable,
  PageHeader,
  SlideOver,
  StatusBadge,
} from "../../components/admin/ui";
import type { AdminSku, AdminStyle } from "../../../shared/types";

export function StylesPage() {
  const { data, loading, error, reload } = useFetch<AdminStyle[]>("/api/admin/styles");
  const [createOpen, setCreateOpen] = useState(false);
  const [tpBusy, setTpBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  async function createTechPack(style: AdminStyle) {
    setTpBusy(style.id);
    try {
      const res = await api.post<{ id: string }>("/api/admin/tech-packs", {
        styleId: style.id,
        name: `${style.name} — tech pack`,
        source: "style",
      });
      navigate(`/admin/tech-packs/${res.id}`);
    } catch {
      setTpBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Styles"
        description="The design master list — every silhouette from concept through production."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            New style
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No styles yet"
          hint="Start with the hero: a high-waisted linen trouser."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              Create the first style
            </button>
          }
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Gender</th>
                <th>Season</th>
                <th>Status</th>
                <th>Target retail</th>
                <th>SKUs</th>
                <th>Tech pack</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.styleCode}</td>
                  <td className="font-medium">{s.name}</td>
                  <td>{titleCase(s.category)}</td>
                  <td>{titleCase(s.gender)}</td>
                  <td>{s.season ?? "—"}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
                    {s.targetRetailCents ? formatMoney(s.targetRetailCents, s.currency) : "—"}
                  </td>
                  <td>{s.skuCount}</td>
                  <td>
                    {s.hasTechPack ? (
                      "✓"
                    ) : (
                      <button
                        type="button"
                        disabled={tpBusy === s.id}
                        onClick={() => void createTechPack(s)}
                        className="text-xs text-terracotta-deep hover:underline"
                        title="Create a tech pack from this style"
                      >
                        {tpBusy === s.id ? "Creating…" : "+ Create"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver open={createOpen} title="New style" onClose={() => setCreateOpen(false)}>
        <StyleCreateForm
          onCreated={() => {
            setCreateOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function StyleCreateForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    styleCode: "",
    name: "",
    category: "trouser",
    gender: "mens",
    season: "SS27",
    targetRetail: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/styles", {
        styleCode: form.styleCode,
        name: form.name,
        category: form.category,
        gender: form.gender,
        season: form.season || undefined,
        targetRetailCents: form.targetRetail
          ? Math.round(parseFloat(form.targetRetail) * 100)
          : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Style code *</label>
        <input
          required
          className="input"
          placeholder="MA-M-TRS-009"
          value={form.styleCode}
          onChange={(e) => setForm({ ...form, styleCode: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Name *</label>
        <input
          required
          className="input"
          placeholder="Agadir Trouser"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {["trouser", "polo", "overshirt", "dress", "top", "set", "coverup", "accessory"].map(
              (cat) => (
                <option key={cat} value={cat}>
                  {titleCase(cat)}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="label">Gender</label>
          <select
            className="input"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="mens">Men's</option>
            <option value="womens">Women's</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Season</label>
          <input
            className="input"
            value={form.season}
            onChange={(e) => setForm({ ...form, season: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Target retail (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="195"
            value={form.targetRetail}
            onChange={(e) => setForm({ ...form, targetRetail: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy ? "Creating…" : "Create style"}
      </button>
    </form>
  );
}

export function SkusPage() {
  const { data, loading, error, reload } = useFetch<AdminSku[]>("/api/admin/styles/skus/all");
  const [addOpen, setAddOpen] = useState(false);

  async function remove(k: AdminSku) {
    if (!confirm(`Delete SKU ${k.skuCode}?`)) return;
    await api.delete(`/api/admin/styles/skus/${k.id}`);
    reload();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="SKUs"
        description="The design-pipeline unit master — style × colorway × size. (Sellable colours & sizes live on each product.)"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
            Add SKU
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingTable />}
      {data && data.length === 0 && (
        <EmptyState
          title="No SKUs yet"
          hint="Add a SKU against a style, or create sellable colours & sizes directly on a product."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              Add SKU
            </button>
          }
        />
      )}
      {data && data.length > 0 && (
        <div className="admin-card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>SKU code</th>
                <th>Style</th>
                <th>Colorway</th>
                <th>Size</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((k) => (
                <tr key={k.id}>
                  <td className="font-mono text-xs">{k.skuCode}</td>
                  <td>{k.styleName}</td>
                  <td>{k.colorwayName ?? "—"}</td>
                  <td>{k.size}</td>
                  <td>
                    <StatusBadge status={k.status} />
                  </td>
                  <td>
                    <button type="button" className="text-xs text-warmgrey hover:text-red-700 hover:underline" onClick={() => void remove(k)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SlideOver open={addOpen} title="Add SKU" onClose={() => setAddOpen(false)}>
        <SkuCreateForm
          onCreated={() => {
            setAddOpen(false);
            reload();
          }}
        />
      </SlideOver>
    </div>
  );
}

function SkuCreateForm({ onCreated }: { onCreated: () => void }) {
  const { data: styles } = useFetch<AdminStyle[]>("/api/admin/styles");
  const [styleId, setStyleId] = useState("");
  const [colorwayId, setColorwayId] = useState("");
  const [size, setSize] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: detail } = useFetch<{ colorways?: { id: string; name: string }[] }>(
    styleId ? `/api/admin/styles/${styleId}` : null,
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/styles/skus", {
        styleId,
        colorwayId: colorwayId || null,
        size,
        skuCode,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't create SKU");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-warmgrey">Style</span>
        <select className="input" value={styleId} onChange={(e) => { setStyleId(e.target.value); setColorwayId(""); }}>
          <option value="">Choose a style…</option>
          {(styles ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.styleCode})
            </option>
          ))}
        </select>
      </label>
      {detail?.colorways && detail.colorways.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Colorway (optional)</span>
          <select className="input" value={colorwayId} onChange={(e) => setColorwayId(e.target.value)}>
            <option value="">— none —</option>
            {detail.colorways.map((cw) => (
              <option key={cw.id} value={cw.id}>
                {cw.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">Size</span>
          <input className="input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="M / 32 / OS" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-warmgrey">SKU code</span>
          <input className="input font-mono" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} placeholder="MA-M-TRS-001-M" />
        </label>
      </div>
      {error && <ErrorNote message={error} />}
      <button type="button" className="btn btn-primary w-full" disabled={busy || !styleId || !size || !skuCode} onClick={() => void submit()}>
        {busy ? "Creating…" : "Create SKU"}
      </button>
    </div>
  );
}
