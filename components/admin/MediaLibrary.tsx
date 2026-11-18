"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { MediaLibraryItem } from "@/lib/media-library";

type MediaResponse = {
  uploads: MediaLibraryItem[];
  store: MediaLibraryItem[];
};

function MediaTile({
  item,
  onSelect,
  onEdit,
  onDelete,
  busyId,
}: {
  item: MediaLibraryItem;
  onSelect?: (item: MediaLibraryItem) => void;
  onEdit?: (item: MediaLibraryItem) => void;
  onDelete?: (item: MediaLibraryItem) => void;
  busyId?: string | null;
}) {
  return (
    <article className="admin-media-card">
      <div className="admin-media-thumb">
        <Image src={item.url} alt={item.alt || item.name} fill sizes="220px" style={{ objectFit: "cover" }} />
        <span className={`admin-media-badge${item.inUse ? " is-used" : ""}`}>
          {item.source === "store" ? "Store" : item.inUse ? "In use" : "Unused"}
        </span>
      </div>
      <div className="admin-media-meta">
        <strong className="wrap-anywhere">{item.name}</strong>
        {item.alt ? <span className="small muted wrap-anywhere">{item.alt}</span> : null}
      </div>
      <div className="admin-media-actions">
        {onSelect ? (
          <button type="button" className="btn btn-sm" onClick={() => onSelect(item)}>
            Use photo
          </button>
        ) : null}
        {onEdit && item.source === "upload" ? (
          <button type="button" className="link" onClick={() => onEdit(item)}>
            Edit details
          </button>
        ) : null}
        {onDelete && item.source === "upload" ? (
          <button
            type="button"
            className="link builder-danger"
            disabled={item.inUse || busyId === item.id}
            title={item.inUse ? "Replace this photo on products or pages before deleting" : "Delete unused photo"}
            onClick={() => onDelete(item)}
          >
            {busyId === item.id ? "Deleting…" : "Delete"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function MediaLibraryPanel() {
  const [uploads, setUploads] = useState<MediaLibraryItem[]>([]);
  const [store, setStore] = useState<MediaLibraryItem[]>([]);
  const [tab, setTab] = useState<"uploads" | "store">("uploads");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; alt: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/media", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as MediaResponse;
      setUploads(data.uploads ?? []);
      setStore(data.store ?? []);
    } catch {
      setError("Could not load your media library. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/media", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<MediaResponse>) : Promise.reject(new Error())))
      .then((data) => {
        if (!active) return;
        setUploads(data.uploads ?? []);
        setStore(data.store ?? []);
      })
      .catch(() => {
        if (active) setError("Could not load your media library. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.set("image", file);
        const res = await fetch("/api/admin/product-media", { method: "POST", body });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not upload photo.");
        uploadedCount += 1;
      }
      setMessage(uploadedCount === 1 ? "Photo uploaded to your library." : `${uploadedCount} photos uploaded.`);
      setTab("uploads");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusyId(editing.id);
    setError("");
    try {
      const res = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not update photo details.");
      setUploads((prev) =>
        prev.map((item) => (item.id === editing.id ? { ...item, name: editing.name, alt: editing.alt } : item))
      );
      setEditing(null);
      setMessage("Photo details saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update photo details.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: MediaLibraryItem) {
    if (item.inUse) return;
    if (!window.confirm(`Delete “${item.name}” permanently?`)) return;
    setBusyId(item.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/media?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not delete photo.");
      setUploads((prev) => prev.filter((entry) => entry.id !== item.id));
      setMessage("Photo deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete photo.");
    } finally {
      setBusyId(null);
    }
  }

  const activeList = useMemo(() => {
    const list = tab === "uploads" ? uploads : store;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => `${item.name} ${item.alt}`.toLowerCase().includes(q));
  }, [tab, uploads, store, search]);

  return (
    <section aria-label="Media library">
      <div className="admin-block-head">
        <div>
          <h2 className="h3">Media library</h2>
          <p className="small muted">Upload photos once and reuse them across products, pages, and banners.</p>
        </div>
        <button type="button" className="btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : "Upload photos"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error ? <p className="banner-note is-error" role="alert">{error}</p> : null}
      {message ? <p className="banner-note is-ok" role="status">{message}</p> : null}

      <div className="admin-media-toolbar">
        <div className="admin-media-tabs" role="tablist" aria-label="Media filter">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "uploads"}
            className={tab === "uploads" ? "is-active" : ""}
            onClick={() => setTab("uploads")}
          >
            Uploaded photos ({uploads.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "store"}
            className={tab === "store" ? "is-active" : ""}
            onClick={() => setTab("store")}
          >
            Store photos ({store.length})
          </button>
        </div>
        <input
          type="search"
          className="input"
          placeholder="Search photos by name…"
          aria-label="Search photos"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {editing ? (
        <form className="product-form admin-media-edit" onSubmit={saveDetails}>
          <h3 className="h3">Edit photo details</h3>
          <div className="field-grid">
            <label className="field">
              <span className="label">Photo name</span>
              <input
                className="input"
                required
                maxLength={120}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="label">Description (alt text)</span>
              <input
                className="input"
                maxLength={160}
                value={editing.alt}
                onChange={(e) => setEditing({ ...editing, alt: e.target.value })}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-sm" disabled={busyId === editing.id}>Save details</button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="hint">Loading photos…</p>
      ) : activeList.length ? (
        <div className="admin-media-grid">
          {activeList.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              busyId={busyId}
              onEdit={(entry) => setEditing({ id: entry.id, name: entry.name, alt: entry.alt })}
              onDelete={(entry) => void remove(entry)}
            />
          ))}
        </div>
      ) : (
        <div className="admin-empty">
          <h3 className="h3">{search ? "No matching photos" : "No uploaded photos yet"}</h3>
          <p className="small muted">
            {search ? "Try another search term." : "Upload JPG, PNG, or WebP images to build your reusable library."}
          </p>
        </div>
      )}
    </section>
  );
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: { url: string; alt: string }) => void;
}) {
  const [uploads, setUploads] = useState<MediaLibraryItem[]>([]);
  const [store, setStore] = useState<MediaLibraryItem[]>([]);
  const [tab, setTab] = useState<"uploads" | "store">("uploads");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/admin/media", { cache: "no-store" })
      .then((res) => {
        if (!active) return Promise.reject(new Error("cancelled"));
        if (!res.ok) throw new Error("request-failed");
        return res.json() as Promise<MediaResponse>;
      })
      .then((data) => {
        if (!active) return;
        setError("");
        setUploads(data.uploads ?? []);
        setStore(data.store ?? []);
        if (!(data.uploads ?? []).length) setTab("store");
      })
      .catch((err) => {
        if (active && (!(err instanceof Error) || err.message !== "cancelled")) {
          setError("Could not load photos.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  async function uploadAndPick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("image", file);
      const res = await fetch("/api/admin/product-media", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Could not upload photo.");
      onSelect({ url: data.url, alt: "" });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  const list = (tab === "uploads" ? uploads : store).filter((item) => {
    const q = search.trim().toLowerCase();
    return !q || `${item.name} ${item.alt}`.toLowerCase().includes(q);
  });

  return (
    <div className="builder-modal-overlay" role="dialog" aria-modal="true" aria-label="Choose a photo" onClick={onClose}>
      <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="builder-modal-head">
          <h3>Choose a photo</h3>
          <button type="button" className="link" onClick={onClose}>Close</button>
        </div>

        <div className="admin-media-toolbar">
          <div className="admin-media-tabs">
            <button type="button" className={tab === "uploads" ? "is-active" : ""} onClick={() => setTab("uploads")}>
              Uploaded ({uploads.length})
            </button>
            <button type="button" className={tab === "store" ? "is-active" : ""} onClick={() => setTab("store")}>
              Store photos ({store.length})
            </button>
          </div>
          <input
            type="search"
            className="input"
            placeholder="Search photos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Upload new"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void uploadAndPick(file);
            }}
          />
        </div>

        {error ? <p className="banner-note is-error" role="alert">{error}</p> : null}

        {loading ? (
          <p className="hint">Loading photos…</p>
        ) : list.length ? (
          <div className="admin-media-grid is-picker">
            {list.map((item) => (
              <MediaTile
                key={item.id}
                item={item}
                onSelect={(picked) => {
                  onSelect({ url: picked.url, alt: picked.alt });
                  onClose();
                }}
              />
            ))}
          </div>
        ) : (
          <p className="hint">No photos in this folder yet. Upload a new photo above or switch to Store photos.</p>
        )}
      </div>
    </div>
  );
}
