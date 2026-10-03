"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Garment from "@/components/Garment";
import ArrowRight from "@/components/icons/ArrowRight";
import { formatUSD } from "@/lib/pricing";
import { ORDER_STATUSES, type OrderStatus, type Product, type ProductKind } from "@/lib/types";
import type {
  AdminOrder,
  AdminOrderDetail,
  CustomerRow,
  DashboardStats,
  SiteSettings,
} from "@/lib/catalog-types";

type Tab = "overview" | "orders" | "products" | "customers" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products" },
  { id: "customers", label: "Customers" },
  { id: "settings", label: "Settings" },
];

const KIND_OPTIONS: { value: ProductKind; label: string }[] = [
  { value: "tee", label: "T-shirt" },
  { value: "longsleeve", label: "Long sleeve" },
  { value: "hoodie", label: "Hoodie" },
  { value: "crew", label: "Crewneck" },
  { value: "cap", label: "Cap" },
  { value: "mug", label: "Mug" },
  { value: "tote", label: "Tote bag" },
];

interface AdminData {
  stats: DashboardStats;
  orders: AdminOrder[];
  products: Product[];
  categories: { id: number; name: string; slug: string; description: string; sortOrder: number }[];
  customers: CustomerRow[];
  settings: SiteSettings;
  paymentsLive: boolean;
}

export default function AdminDashboard({
  data,
  initialTab,
  orderDetail,
}: {
  data: AdminData;
  initialTab: Tab;
  orderDetail: AdminOrderDetail | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(`/admin?tab=${next}`, { scroll: false });
  }

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    setSignedOut(true);
    window.location.reload();
  }

  if (signedOut) {
    return <p className="muted" role="status">Signing you out…</p>;
  }

  return (
    <div className="admin">
      <div className="admin-bar">
        <nav aria-label="Dashboard sections" className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`admin-tab${tab === t.id ? " is-active" : ""}`}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => selectTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="admin-bar-right">
          <Link href="/" className="link">
            View storefront
            <ArrowRight />
          </Link>
          <button type="button" className="btn btn-light btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {!data.paymentsLive ? (
        <p className="banner-note" role="status">
          Card payments are not connected on this deployment, so orders arrive as
          invoice requests. Add the Stripe keys to enable checkout.
        </p>
      ) : null}

      {tab === "overview" ? <Overview data={data} onOpenOrder={() => selectTab("orders")} /> : null}
      {tab === "orders" ? (
        <Orders data={data} detail={orderDetail} />
      ) : null}
      {tab === "products" ? <ProductsPanel data={data} /> : null}
      {tab === "customers" ? <Customers data={data} /> : null}
      {tab === "settings" ? <SettingsPanel settings={data.settings} categories={data.categories} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Overview
   ------------------------------------------------------------------------- */

function Overview({
  data,
  onOpenOrder,
}: {
  data: AdminData;
  onOpenOrder: () => void;
}) {
  const { stats, orders } = data;
  const needsAction = orders.filter((o) => o.status === "pending");

  return (
    <section aria-label="Overview">
      <dl className="stat-grid">
        <Stat label="Orders" value={String(stats.orders)} />
        <Stat label="Garments ordered" value={String(stats.garments)} />
        <Stat label="Paid revenue" value={formatUSD(stats.revenue)} />
        <Stat label="Awaiting action" value={String(needsAction.length)} />
      </dl>

      {needsAction.length ? (
        <div className="admin-block">
          <h2 className="h3">Needs action</h2>
          <p className="small muted">
            These orders have not been marked paid yet.
          </p>
          <button type="button" className="link" onClick={onOpenOrder}>
            Review all orders
            <ArrowRight />
          </button>
        </div>
      ) : null}

      <div className="admin-block">
        <h2 className="h3">Recent orders</h2>
        {orders.length ? (
          <OrderTable orders={orders.slice(0, 8)} />
        ) : (
          <EmptyState
            title="No orders yet"
            body="Orders appear here as soon as someone checks out."
          />
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Orders
   ------------------------------------------------------------------------- */

function Orders({
  data,
  detail,
}: {
  data: AdminData;
  detail: AdminOrderDetail | null;
}) {
  const [orders, setOrders] = useState(data.orders);
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const [selected, setSelected] = useState(detail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter ? orders.filter((o) => o.status === filter) : orders),
    [orders, filter]
  );

  const updateStatus = useCallback(
    async (reference: string, status: OrderStatus) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, status }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Could not update the order.");
          return;
        }
        setOrders((prev) =>
          prev.map((o) => (o.reference === reference ? { ...o, status } : o))
        );
        setSelected((prev) => (prev && prev.reference === reference ? { ...prev, status } : prev));
      } catch {
        setError("Network error. Try again.");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  async function openOrder(reference: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders?ref=${encodeURIComponent(reference)}`);
      if (!res.ok) {
        setError("Could not load that order.");
        return;
      }
      setSelected(await res.json());
    } catch {
      setError("Network error. Try again.");
    }
  }

  return (
    <section aria-label="Orders">
      <div className="admin-block-head">
        <div>
          <h2 className="h3">Orders</h2>
          <p className="small muted">
            {visible.length} shown · {orders.length} total
          </p>
        </div>
        <div className="field-inline">
          <label className="label" htmlFor="order-filter">
            Status
          </label>
          <select
            id="order-filter"
            className="select select-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as OrderStatus | "")}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="banner-note is-error" role="alert">
          {error}
        </p>
      ) : null}

      {selected ? (
        <OrderDetailPanel
          detail={selected}
          saving={saving}
          onStatus={updateStatus}
          onClose={() => setSelected(null)}
        />
      ) : null}

      {visible.length ? (
        <OrderTable orders={visible} onOpen={openOrder} />
      ) : (
        <EmptyState
          title={filter ? "No orders with that status" : "No orders yet"}
          body={
            filter
              ? "Try clearing the status filter."
              : "Orders appear here as soon as someone checks out."
          }
        />
      )}
    </section>
  );
}

function OrderTable({
  orders,
  onOpen,
}: {
  orders: AdminOrder[];
  onOpen?: (reference: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">Orders</caption>
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Customer</th>
            <th scope="col">Garments</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">
              Total
            </th>
            <th scope="col">Date</th>
            {onOpen ? (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.reference}>
              <td className="mono">{o.reference}</td>
              <td>
                <span className="wrap-anywhere">{o.name}</span>
                <span className="cell-sub wrap-anywhere">{o.email}</span>
              </td>
              <td className="tnum">{o.garmentCount}</td>
              <td>
                <span className={`badge status-${o.status}`}>
                  {ORDER_STATUSES.find((s) => s.value === o.status)?.label ?? o.status}
                </span>
              </td>
              <td className="num tnum">{formatUSD(o.total)}</td>
              <td className="cell-sub">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              {onOpen ? (
                <td>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onOpen(o.reference)}
                  >
                    Open
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDetailPanel({
  detail,
  saving,
  onStatus,
  onClose,
}: {
  detail: AdminOrderDetail;
  saving: boolean;
  onStatus: (reference: string, status: OrderStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="order-panel" role="region" aria-label={`Order ${detail.reference}`}>
      <div className="order-panel-head">
        <div>
          <h3 className="h3 mono">{detail.reference}</h3>
          <p className="small muted">
            Placed {new Date(detail.createdAt).toLocaleString()}
            {detail.paidAt ? ` · paid ${new Date(detail.paidAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close order">
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M3 3l12 12M15 3L3 15"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="order-panel-grid">
        <div>
          <h4 className="panel-heading">Customer</h4>
          <p className="small">
            {detail.name}
            <br />
            <a href={`mailto:${detail.email}`}>{detail.email}</a>
            {detail.phone ? (
              <>
                <br />
                {detail.phone}
              </>
            ) : null}
          </p>
          <h4 className="panel-heading">Ship to</h4>
          <address className="small not-italic">
            {detail.addressLine1}
            {detail.addressLine2 ? (
              <>
                <br />
                {detail.addressLine2}
              </>
            ) : null}
            <br />
            {detail.city}, {detail.region} {detail.postal}
            <br />
            {detail.country}
          </address>
          {detail.notes ? (
            <>
              <h4 className="panel-heading">Notes</h4>
              <p className="small wrap-anywhere">{detail.notes}</p>
            </>
          ) : null}
        </div>

        <div>
          <h4 className="panel-heading">Items</h4>
          <ul className="admin-items">
            {detail.items.map((item, i) => (
              <li key={i}>
                <div className="admin-item-thumb">
                  {item.previewFront ?? item.previewBack ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(item.previewFront ?? item.previewBack) as string} alt="" />
                  ) : (
                    <Garment kind={item.productKind} color={item.colorHex} />
                  )}
                </div>
                <div className="grow">
                  <p className="small wrap-anywhere">
                    <strong>{item.quantity} × {item.productName}</strong>
                  </p>
                  <p className="small muted wrap-anywhere">
                    {item.colorName} ·{" "}
                    {item.sizeBreakdown
                      .filter((s) => s.qty > 0)
                      .map((s) => `${s.label}×${s.qty}`)
                      .join(", ")}
                  </p>
                </div>
                <p className="tnum small">{formatUSD(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <h4 className="panel-heading">Update status</h4>
          <label className="sr-only" htmlFor="status-select">
            Order status
          </label>
          <select
            id="status-select"
            className="select"
            value={detail.status}
            disabled={saving}
            onChange={(e) => onStatus(detail.reference, e.target.value as OrderStatus)}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <dl className="summary-list">
            <div>
              <dt>Subtotal</dt>
              <dd className="tnum">{formatUSD(detail.subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd className="tnum">
                {detail.shipping === 0 ? "Free" : formatUSD(detail.shipping)}
              </dd>
            </div>
            <div className="summary-total">
              <dt>Total</dt>
              <dd className="tnum">{formatUSD(detail.total)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Products
   ------------------------------------------------------------------------- */

interface DraftProduct {
  id?: number;
  name: string;
  slug: string;
  styleCode: string;
  kind: ProductKind;
  categoryId: string;
  blurb: string;
  description: string;
  material: string;
  basePrice: string;
  compareAt: string;
  printFeePerSide: string;
  frontW: string;
  frontH: string;
  backW: string;
  backH: string;
  featured: boolean;
  active: boolean;
  colors: { slug: string; name: string; hex: string }[];
  sizes: { label: string; surcharge: string }[];
  priceBreaks: { minQty: number; amountOff: string }[];
}

function emptyProduct(): DraftProduct {
  return {
    name: "",
    slug: "",
    styleCode: "",
    kind: "tee",
    categoryId: "",
    blurb: "",
    description: "",
    material: "",
    basePrice: "24",
    compareAt: "",
    printFeePerSide: "6",
    frontW: "0.42",
    frontH: "0.5",
    backW: "0.62",
    backH: "0.66",
    featured: false,
    active: true,
    colors: [{ slug: "black", name: "Black", hex: "#141414" }],
    sizes: [
      { label: "S", surcharge: "0" },
      { label: "M", surcharge: "0" },
      { label: "L", surcharge: "0" },
      { label: "XL", surcharge: "0" },
    ],
    priceBreaks: [{ minQty: 1, amountOff: "0" }],
  };
}

function toDraft(p: Product): DraftProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    styleCode: p.styleCode,
    kind: p.kind,
    categoryId: p.categoryId ? String(p.categoryId) : "",
    blurb: p.blurb,
    description: p.description,
    material: p.material,
    basePrice: String(p.basePrice),
    compareAt: p.compareAt === null ? "" : String(p.compareAt),
    printFeePerSide: String(p.printFeePerSide),
    frontW: String(p.printArea.frontW),
    frontH: String(p.printArea.frontH),
    backW: String(p.printArea.backW),
    backH: String(p.printArea.backH),
    featured: p.featured,
    active: p.active,
    colors: p.colors.map((c) => ({ slug: c.slug, name: c.name, hex: c.hex })),
    sizes: p.sizes.map((s) => ({ label: s.label, surcharge: String(s.surcharge) })),
    priceBreaks: p.priceBreaks.map((b) => ({ minQty: b.minQty, amountOff: String(b.amountOff) })),
  };
}

function ProductsPanel({ data }: { data: AdminData }) {
  const [products, setProducts] = useState(data.products);
  const [draft, setDraft] = useState<DraftProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patchDraft(next: Partial<DraftProduct>) {
    setDraft((prev) => (prev ? { ...prev, ...next } : prev));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = {
      id: draft.id,
      name: draft.name,
      slug: draft.slug,
      styleCode: draft.styleCode,
      kind: draft.kind,
      categoryId: draft.categoryId ? Number(draft.categoryId) : null,
      blurb: draft.blurb,
      description: draft.description,
      material: draft.material,
      basePrice: Number(draft.basePrice),
      compareAt: draft.compareAt === "" ? null : Number(draft.compareAt),
      printFeePerSide: Number(draft.printFeePerSide),
      printArea: {
        frontW: Number(draft.frontW),
        frontH: Number(draft.frontH),
        backW: Number(draft.backW),
        backH: Number(draft.backH),
      },
      featured: draft.featured,
      active: draft.active,
      colors: draft.colors,
      sizes: draft.sizes.map((s) => ({ label: s.label, surcharge: Number(s.surcharge) })),
      priceBreaks: draft.priceBreaks.map((b) => ({
        minQty: b.minQty,
        amountOff: Number(b.amountOff),
      })),
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; id?: number };

      if (!res.ok) {
        setError(json.error ?? "The product could not be saved.");
        return;
      }

      setSaved(true);
      setDraft(null);
      // Refresh from the server so the list reflects stored values.
      window.location.reload();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: number, patchBody: { featured?: boolean; active?: boolean }) {
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patchBody }),
    });
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patchBody } : p))
      );
    } else {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "That change could not be saved.");
    }
  }

  async function remove(product: Product) {
    const confirmed = window.confirm(
      `Delete “${product.name}”? Past orders keep their own copy of the details, but this product will no longer be orderable.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/admin/products?id=${product.id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } else {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "That product could not be deleted.");
    }
  }

  return (
    <section aria-label="Products">
      <div className="admin-block-head">
        <div>
          <h2 className="h3">Products</h2>
          <p className="small muted">
            {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
            {products.filter((p) => p.active).length} published
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setDraft(emptyProduct());
            setError(null);
            setSaved(false);
          }}
        >
          New product
        </button>
      </div>

      {error ? (
        <p className="banner-note is-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="banner-note is-ok" role="status">
          Product saved.
        </p>
      ) : null}

      {draft ? (
        <ProductForm
          draft={draft}
          categories={data.categories}
          saving={saving}
          onChange={patchDraft}
          onSave={save}
          onCancel={() => setDraft(null)}
        />
      ) : null}

      {products.length ? (
        <ul className="product-admin-list">
          {products.map((p) => (
            <li key={p.id} className="product-admin-row">
              <div className="pa-thumb">
                <Garment kind={p.kind} color={p.colors[0]?.hex ?? "#141414"} />
              </div>
              <div className="grow">
                <p className="wrap-anywhere">
                  <strong>{p.name}</strong>
                  {!p.active ? (
                    <span className="badge badge-soft pa-flag">Hidden</span>
                  ) : null}
                </p>
                <p className="small muted wrap-anywhere">
                  {KIND_OPTIONS.find((k) => k.value === p.kind)?.label ?? p.kind} ·{" "}
                  {p.colors.length} colors · {p.sizes.length} sizes ·{" "}
                  <span className="mono">/{p.slug}</span>
                </p>
              </div>
              <p className="tnum pa-price">{formatUSD(p.basePrice)}</p>
              <div className="pa-actions">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.featured}
                    onChange={(e) => toggle(p.id, { featured: e.target.checked })}
                  />
                  <span className="small">Featured</span>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.active}
                    onChange={(e) => toggle(p.id, { active: e.target.checked })}
                  />
                  <span className="small">Published</span>
                </label>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setDraft(toDraft(p));
                    setError(null);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="cart-remove" onClick={() => remove(p)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No products yet"
          body="Create your first blank to populate the storefront."
        />
      )}
    </section>
  );
}

function ProductForm({
  draft,
  categories,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  draft: DraftProduct;
  categories: { id: number; name: string }[];
  saving: boolean;
  onChange: (next: Partial<DraftProduct>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="product-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h3 className="h3">{draft.id ? `Edit ${draft.name}` : "New product"}</h3>

      <div className="field-grid">
        <div className="field">
          <label className="label" htmlFor="p-name">
            Name
          </label>
          <input
            id="p-name"
            className="input"
            value={draft.name}
            required
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-slug">
            URL slug
          </label>
          <input
            id="p-slug"
            className="input"
            value={draft.slug}
            placeholder="generated from the name"
            onChange={(e) => onChange({ slug: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-style">
            Style code
          </label>
          <input
            id="p-style"
            className="input"
            value={draft.styleCode}
            placeholder="e.g. RT2000"
            onChange={(e) => onChange({ styleCode: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-kind">
            Type
          </label>
          <select
            id="p-kind"
            className="select"
            value={draft.kind}
            onChange={(e) => onChange({ kind: e.target.value as ProductKind })}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="p-cat">
            Category
          </label>
          <select
            id="p-cat"
            className="select"
            value={draft.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
          >
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="p-base">
            Base price (USD)
          </label>
          <input
            id="p-base"
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={draft.basePrice}
            onChange={(e) => onChange({ basePrice: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-compare">
            Compare-at price (optional)
          </label>
          <input
            id="p-compare"
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={draft.compareAt}
            onChange={(e) => onChange({ compareAt: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-fee">
            Print fee per side (USD)
          </label>
          <input
            id="p-fee"
            className="input"
            type="number"
            min={0}
            step="0.01"
            value={draft.printFeePerSide}
            onChange={(e) => onChange({ printFeePerSide: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-material">
            Material
          </label>
          <input
            id="p-material"
            className="input"
            value={draft.material}
            placeholder="e.g. 100% ringspun cotton, 220 gsm"
            onChange={(e) => onChange({ material: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="p-blurb">
          Short description
        </label>
        <input
          id="p-blurb"
          className="input"
          value={draft.blurb}
          onChange={(e) => onChange({ blurb: e.target.value })}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="p-desc">
          Full description
        </label>
        <textarea
          id="p-desc"
          className="textarea"
          rows={4}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <fieldset className="fieldset">
        <legend className="label">Printable area</legend>
        <p className="hint">
          Share of the garment each side can print into, from 0.05 to 0.98. Larger
          values let artwork run closer to the seams.
        </p>
        <div className="field-grid field-grid-4">
          {(
            [
              ["frontW", "Front width"],
              ["frontH", "Front height"],
              ["backW", "Back width"],
              ["backH", "Back height"],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <label className="label" htmlFor={`p-${key}`}>
                {label}
              </label>
              <input
                id={`p-${key}`}
                className="input"
                type="number"
                min={0.05}
                max={0.98}
                step="0.01"
                value={draft[key]}
                onChange={(e) => onChange({ [key]: e.target.value } as Partial<DraftProduct>)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="label">Colors</legend>
        <div className="repeat-list">
          {draft.colors.map((c, i) => (
            <div className="repeat-row" key={i}>
              <div className="field">
                <label className="label" htmlFor={`c-name-${i}`}>
                  Name
                </label>
                <input
                  id={`c-name-${i}`}
                  className="input"
                  value={c.name}
                  onChange={(e) => {
                    const colors = [...draft.colors];
                    colors[i] = { ...c, name: e.target.value };
                    onChange({ colors });
                  }}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor={`c-slug-${i}`}>
                  Slug
                </label>
                <input
                  id={`c-slug-${i}`}
                  className="input"
                  value={c.slug}
                  onChange={(e) => {
                    const colors = [...draft.colors];
                    colors[i] = { ...c, slug: e.target.value };
                    onChange({ colors });
                  }}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor={`c-hex-${i}`}>
                  Hex
                </label>
                <input
                  id={`c-hex-${i}`}
                  className="input input-color"
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#141414"}
                  onChange={(e) => {
                    const colors = [...draft.colors];
                    colors[i] = { ...c, hex: e.target.value };
                    onChange({ colors });
                  }}
                />
              </div>
              <button
                type="button"
                className="cart-remove"
                onClick={() =>
                  onChange({ colors: draft.colors.filter((_, idx) => idx !== i) })
                }
                disabled={draft.colors.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-light btn-sm add-row"
          onClick={() =>
            onChange({
              colors: [...draft.colors, { slug: "", name: "", hex: "#3A3A3C" }],
            })
          }
        >
          Add color
        </button>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="label">Sizes</legend>
        <div className="repeat-list">
          {draft.sizes.map((s, i) => (
            <div className="repeat-row repeat-row-sm" key={i}>
              <div className="field">
                <label className="label" htmlFor={`s-label-${i}`}>
                  Label
                </label>
                <input
                  id={`s-label-${i}`}
                  className="input"
                  value={s.label}
                  onChange={(e) => {
                    const sizes = [...draft.sizes];
                    sizes[i] = { ...s, label: e.target.value };
                    onChange({ sizes });
                  }}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor={`s-sur-${i}`}>
                  Surcharge
                </label>
                <input
                  id={`s-sur-${i}`}
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={s.surcharge}
                  onChange={(e) => {
                    const sizes = [...draft.sizes];
                    sizes[i] = { ...s, surcharge: e.target.value };
                    onChange({ sizes });
                  }}
                />
              </div>
              <button
                type="button"
                className="cart-remove"
                onClick={() => onChange({ sizes: draft.sizes.filter((_, idx) => idx !== i) })}
                disabled={draft.sizes.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-light btn-sm add-row"
          onClick={() => onChange({ sizes: [...draft.sizes, { label: "", surcharge: "0" }] })}
        >
          Add size
        </button>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="label">Quantity breaks</legend>
        <p className="hint">
          When an order reaches this many garments, the amount is added to the base
          price per garment. Use a negative number for a discount.
        </p>
        <div className="repeat-list">
          {draft.priceBreaks.map((b, i) => (
            <div className="repeat-row repeat-row-sm" key={i}>
              <div className="field">
                <label className="label" htmlFor={`b-qty-${i}`}>
                  From quantity
                </label>
                <input
                  id={`b-qty-${i}`}
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={b.minQty}
                  onChange={(e) => {
                    const priceBreaks = [...draft.priceBreaks];
                    priceBreaks[i] = { ...b, minQty: Number(e.target.value) };
                    onChange({ priceBreaks });
                  }}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor={`b-off-${i}`}>
                  Price change
                </label>
                <input
                  id={`b-off-${i}`}
                  className="input"
                  type="number"
                  step="0.01"
                  value={b.amountOff}
                  onChange={(e) => {
                    const priceBreaks = [...draft.priceBreaks];
                    priceBreaks[i] = { ...b, amountOff: e.target.value };
                    onChange({ priceBreaks });
                  }}
                />
              </div>
              <button
                type="button"
                className="cart-remove"
                onClick={() =>
                  onChange({ priceBreaks: draft.priceBreaks.filter((_, idx) => idx !== i) })
                }
                disabled={draft.priceBreaks.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-light btn-sm add-row"
          onClick={() =>
            onChange({
              priceBreaks: [...draft.priceBreaks, { minQty: 12, amountOff: "-2" }],
            })
          }
        >
          Add break
        </button>
      </fieldset>

      <div className="toggle-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => onChange({ active: e.target.checked })}
          />
          <span>Published on the storefront</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.featured}
            onChange={(e) => onChange({ featured: e.target.checked })}
          />
          <span>Show as featured</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : draft.id ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------
   Customers
   ------------------------------------------------------------------------- */

function Customers({ data }: { data: AdminData }) {
  if (!data.customers.length) {
    return (
      <section aria-label="Customers">
        <h2 className="h3">Customers</h2>
        <EmptyState
          title="No customers yet"
          body="Customers are created automatically when someone places an order."
        />
      </section>
    );
  }

  return (
    <section aria-label="Customers">
      <div className="admin-block-head">
        <div>
          <h2 className="h3">Customers</h2>
          <p className="small muted">{data.customers.length} total</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Customers</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col" className="num">
                Orders
              </th>
              <th scope="col" className="num">
                Spent
              </th>
              <th scope="col">Last order</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c.email}>
                <td className="wrap-anywhere">{c.name || "—"}</td>
                <td>
                  <a href={`mailto:${c.email}`} className="wrap-anywhere">
                    {c.email}
                  </a>
                </td>
                <td>{c.phone || "—"}</td>
                <td className="num tnum">{c.orders}</td>
                <td className="num tnum">{formatUSD(c.spent)}</td>
                <td className="cell-sub">
                  {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------
   Settings
   ------------------------------------------------------------------------- */

function SettingsPanel({
  settings,
  categories: initialCategories,
}: {
  settings: SiteSettings;
  categories: AdminData["categories"];
}) {
  const [form, setForm] = useState(settings);
  const [categories, setCategories] = useState(initialCategories);
  const [categoryDraft, setCategoryDraft] = useState<{ id?: number; name: string; slug: string; description: string; sortOrder: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setState(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          shippingFlat: Number(form.shippingFlat),
          freeShippingThreshold: Number(form.freeShippingThreshold),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setState({ tone: "error", text: json.error ?? "Settings could not be saved." });
        return;
      }
      setState({ tone: "ok", text: "Settings saved. They apply across the storefront." });
    } catch {
      setState({ tone: "error", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Site settings">
      <div className="admin-block-head">
        <div>
          <h2 className="h3">Site settings</h2>
          <p className="small muted">
            These values control the announcement bar, shipping and the contact details
            in the footer.
          </p>
        </div>
      </div>

      {state ? (
        <p
          className={`banner-note${state.tone === "error" ? " is-error" : " is-ok"}`}
          role={state.tone === "error" ? "alert" : "status"}
        >
          {state.text}
        </p>
      ) : null}

      <form className="settings-form" onSubmit={save}>
        <div className="field">
          <label className="label" htmlFor="s-announcement">
            Announcement bar
          </label>
          <input
            id="s-announcement"
            className="input"
            value={form.announcement}
            placeholder="Leave blank to hide the bar"
            onChange={(e) => setForm({ ...form, announcement: e.target.value })}
          />
          <span className="hint">Shown across the top of every page.</span>
        </div>

        <div className="field-grid">
          <div className="field">
            <label className="label" htmlFor="s-shipping">
              Flat shipping rate (USD)
            </label>
            <input
              id="s-shipping"
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={form.shippingFlat}
              onChange={(e) => setForm({ ...form, shippingFlat: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="s-threshold">
              Free shipping over (USD)
            </label>
            <input
              id="s-threshold"
              className="input"
              type="number"
              min={0}
              step="1"
              value={form.freeShippingThreshold}
              onChange={(e) =>
                setForm({ ...form, freeShippingThreshold: Number(e.target.value) })
              }
            />
            <span className="hint">Set to 0 to disable free shipping.</span>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="s-days">
            Production time
          </label>
          <input
            id="s-days"
            className="input"
            value={form.productionDays}
            placeholder="e.g. 3-5 business days after artwork approval"
            onChange={(e) => setForm({ ...form, productionDays: e.target.value })}
          />
        </div>

        <fieldset className="fieldset">
          <legend className="label">Contact details</legend>
          <p className="hint">
            These appear in the footer. They stay blank until you fill them in.
          </p>
          <div className="field-grid">
            <div className="field">
              <label className="label" htmlFor="s-email">
                Contact email
              </label>
              <input
                id="s-email"
                className="input"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="s-phone">
                Contact phone
              </label>
              <input
                id="s-phone"
                className="input"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="s-address">
              Business address
            </label>
            <input
              id="s-address"
              className="input"
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
            />
          </div>
        </fieldset>

        <button type="submit" className="btn" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      <div className="admin-subsection">
        <div className="admin-block-head">
          <div>
            <h3 className="h3">Catalog categories</h3>
            <p className="small muted">Control the categories shown in the shop and product editor.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setCategoryDraft({ name: "", slug: "", description: "", sortOrder: String(categories.length) })}>
            New category
          </button>
        </div>
        {categoryDraft ? (
          <form
            className="category-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await fetch("/api/admin/categories", {
                method: categoryDraft.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(categoryDraft),
              });
              const json = (await res.json()) as { error?: string };
              if (!res.ok) {
                setState({ tone: "error", text: json.error ?? "Category could not be saved." });
                return;
              }
              window.location.reload();
            }}
          >
            <div className="field-grid">
              <div className="field"><label className="label" htmlFor="cat-name">Name</label><input id="cat-name" className="input" required value={categoryDraft.name} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} /></div>
              <div className="field"><label className="label" htmlFor="cat-slug">URL slug</label><input id="cat-slug" className="input" value={categoryDraft.slug} placeholder="generated from name" onChange={(e) => setCategoryDraft({ ...categoryDraft, slug: e.target.value })} /></div>
              <div className="field"><label className="label" htmlFor="cat-order">Order</label><input id="cat-order" className="input" type="number" min="0" value={categoryDraft.sortOrder} onChange={(e) => setCategoryDraft({ ...categoryDraft, sortOrder: e.target.value })} /></div>
            </div>
            <div className="field"><label className="label" htmlFor="cat-description">Description</label><textarea id="cat-description" className="textarea" rows={2} value={categoryDraft.description} onChange={(e) => setCategoryDraft({ ...categoryDraft, description: e.target.value })} /></div>
            <div className="form-actions"><button type="submit" className="btn btn-sm">Save category</button><button type="button" className="btn btn-light btn-sm" onClick={() => setCategoryDraft(null)}>Cancel</button></div>
          </form>
        ) : null}
        <ul className="category-admin-list">
          {categories.map((category) => (
            <li key={category.id} className="category-admin-row">
              <div className="grow"><strong>{category.name}</strong><span className="small muted">/{category.slug}{category.description ? ` · ${category.description}` : ""}</span></div>
              <button type="button" className="link" onClick={() => setCategoryDraft({ id: category.id, name: category.name, slug: category.slug, description: category.description, sortOrder: String(category.sortOrder) })}>Edit</button>
              <button type="button" className="cart-remove" onClick={async () => { if (!window.confirm(`Delete “${category.name}”? Products will become uncategorised.`)) return; const res = await fetch(`/api/admin/categories?id=${category.id}`, { method: "DELETE" }); if (res.ok) setCategories((prev) => prev.filter((item) => item.id !== category.id)); else setState({ tone: "error", text: "Category could not be deleted." }); }}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="admin-empty">
      <h3 className="h3">{title}</h3>
      <p className="small muted">{body}</p>
    </div>
  );
}
