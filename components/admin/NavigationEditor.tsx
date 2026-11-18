"use client";

import { useEffect, useRef, useState } from "react";
import type { NavigationMenus } from "@/lib/navigation-store";

type LocationKey = "header" | "footerCompany" | "footerInfo";

type Suggestion = { label: string; href: string };
type ApiData = {
  menus: NavigationMenus;
  suggestions: {
    storePages: Suggestion[];
    customPages: Suggestion[];
    categoryLinks: Suggestion[];
  };
};

const LOCATION_LABELS: { key: LocationKey; label: string; hint: string }[] = [
  { key: "header", label: "Header bar", hint: "Links shown in the main storefront navigation bar." },
  { key: "footerCompany", label: "Footer — Company", hint: "Links shown in the Company footer column." },
  { key: "footerInfo", label: "Footer — Information", hint: "Links shown in the Information footer column." },
];

export default function NavigationEditor() {
  const [menus, setMenus] = useState<NavigationMenus | null>(null);
  const [suggestions, setSuggestions] = useState<ApiData["suggestions"]>({
    storePages: [],
    customPages: [],
    categoryLinks: [],
  });
  const [location, setLocation] = useState<LocationKey>("header");
  const [customLabel, setCustomLabel] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const nextIdRef = useRef(1);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/navigation", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<ApiData>) : Promise.reject(new Error())))
      .then((data) => {
        if (!active) return;
        setMenus(data.menus);
        setSuggestions(data.suggestions);
      })
      .catch(() => {
        if (active) setError("Could not load navigation menus. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !menus) {
    return <p className="hint">{error || "Loading navigation menus…"}</p>;
  }

  const activeItems = menus[location];
  const maxItems = location === "header" ? 12 : 10;

  function setItems(next: NavigationMenus[LocationKey]) {
    setMenus((prev) => (prev ? { ...prev, [location]: next } : prev));
    setMessage("");
  }

  function addItem(label: string, href: string) {
    if (activeItems.length >= maxItems) {
      setError(`This menu supports up to ${maxItems} links.`);
      return;
    }
    const seq = nextIdRef.current++;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `nav-${crypto.randomUUID().slice(0, 12)}`
        : `nav-${seq}`;
    setError("");
    setItems([
      ...activeItems,
      {
        id,
        label: label.slice(0, 48),
        href,
      },
    ]);
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= activeItems.length) return;
    const next = [...activeItems];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItems(next);
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menus),
      });
      const json = (await res.json()) as { error?: string; menus?: NavigationMenus };
      if (!res.ok || !json.menus) throw new Error(json.error || "Could not save menu.");
      setMenus(json.menus);
      setMessage("Navigation menus saved and updated across the storefront.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save menu.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!window.confirm("Restore all header and footer menus to the original storefront links?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/navigation", { method: "DELETE" });
      const json = (await res.json()) as { menus?: NavigationMenus; error?: string };
      if (!res.ok || !json.menus) throw new Error(json.error || "Could not reset menus.");
      setMenus(json.menus);
      setMessage("Default navigation menus restored.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reset menus.");
    } finally {
      setSaving(false);
    }
  }

  const currentMeta = LOCATION_LABELS.find((entry) => entry.key === location)!;

  return (
    <section aria-label="Navigation menus">
      <div className="admin-block-head">
        <div>
          <h2 className="h3">Navigation menus</h2>
          <p className="small muted">Choose which pages and categories appear in your header bar and footer columns.</p>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-light btn-sm" disabled={saving} onClick={() => void resetDefaults()}>
            Restore defaults
          </button>
          <button type="button" className="btn" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save menus"}
          </button>
        </div>
      </div>

      {error ? <p className="banner-note is-error" role="alert">{error}</p> : null}
      {message ? <p className="banner-note is-ok" role="status">{message}</p> : null}

      <div className="admin-media-tabs" role="tablist" aria-label="Menu location">
        {LOCATION_LABELS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={location === entry.key}
            className={location === entry.key ? "is-active" : ""}
            onClick={() => setLocation(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginBottom: 18 }}>{currentMeta.hint}</p>

      <div className="admin-nav-editor-grid">
        <div className="admin-nav-picker">
          <div className="builder-card">
            <h3>Add pages</h3>
            <ul className="admin-nav-suggestions">
              {suggestions.storePages.map((item) => (
                <li key={item.href}>
                  <span>{item.label}</span>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => addItem(item.label, item.href)}>
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {suggestions.customPages.length ? (
            <div className="builder-card">
              <h3>Published custom pages</h3>
              <ul className="admin-nav-suggestions">
                {suggestions.customPages.map((item) => (
                  <li key={item.href}>
                    <span>{item.label}</span>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => addItem(item.label, item.href)}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {suggestions.categoryLinks.length ? (
            <div className="builder-card">
              <h3>Categories</h3>
              <ul className="admin-nav-suggestions">
                {suggestions.categoryLinks.map((item) => (
                  <li key={item.href}>
                    <span>{item.label}</span>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => addItem(item.label, item.href)}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form
            className="builder-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customLabel.trim() || !customHref.trim()) return;
              addItem(customLabel.trim(), customHref.trim());
              setCustomLabel("");
              setCustomHref("");
            }}
          >
            <h3>Custom link</h3>
            <label className="field">
              <span className="label">Label</span>
              <input className="input" required maxLength={48} placeholder="e.g. Bulk Pricing" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Address</span>
              <input className="input" required maxLength={300} placeholder="/bulk-pricing" value={customHref} onChange={(e) => setCustomHref(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-light btn-sm">Add custom link</button>
          </form>
        </div>

        <div className="builder-card">
          <h3>Menu structure ({activeItems.length}/{maxItems})</h3>
          <ul className="admin-nav-items">
            {activeItems.map((item, idx) => (
              <li key={item.id} className="admin-nav-item-card">
                <div className="field-grid">
                  <label className="field">
                    <span className="label">Label</span>
                    <input
                      className="input"
                      maxLength={48}
                      value={item.label}
                      onChange={(e) =>
                        setItems(activeItems.map((entry, i) => (i === idx ? { ...entry, label: e.target.value } : entry)))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="label">Link</span>
                    <input
                      className="input"
                      maxLength={300}
                      value={item.href}
                      onChange={(e) =>
                        setItems(activeItems.map((entry, i) => (i === idx ? { ...entry, href: e.target.value } : entry)))
                      }
                    />
                  </label>
                </div>
                <div className="admin-nav-item-actions">
                  {location === "header" ? (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean((item as { highlight?: boolean }).highlight)}
                        onChange={(e) =>
                          setItems(
                            activeItems.map((entry, i) =>
                              i === idx ? { ...entry, highlight: e.target.checked } : entry
                            )
                          )
                        }
                      />
                      <span>Accent color</span>
                    </label>
                  ) : <span />}
                  <div className="form-actions">
                    <button type="button" className="btn btn-light btn-sm" disabled={idx === 0} onClick={() => move(idx, -1)}>Up</button>
                    <button type="button" className="btn btn-light btn-sm" disabled={idx === activeItems.length - 1} onClick={() => move(idx, 1)}>Down</button>
                    <button
                      type="button"
                      className="link builder-danger"
                      disabled={activeItems.length <= 1}
                      onClick={() => setItems(activeItems.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
