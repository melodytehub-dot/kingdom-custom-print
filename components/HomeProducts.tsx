"use client";
import { useState } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";
const filters = [{ value: "all", label: "All apparel" }, { value: "tee", label: "T-shirts" }, { value: "longsleeve", label: "Long sleeves" }, { value: "fleece", label: "Hoodies & fleece" }];
export default function HomeProducts({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState("all");
  const visible = products.filter((product) => filter === "all" || (filter === "fleece" ? product.kind === "hoodie" || product.kind === "crew" : product.kind === filter)).slice(0, 8);
  return <><div className="mm-tabs" role="group" aria-label="Browse apparel"><div className="mm-tabs-inner">{filters.map((item) => <button key={item.value} className={`mm-tab-btn ${filter === item.value ? "active" : ""}`} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div></div><div aria-live="polite">{visible.length ? <ul className="mm-product-grid">{visible.map((product, index) => <li key={product.id}><ProductCard product={product} priority={index < 4} /></li>)}</ul> : <div className="state"><p>No garments in this collection yet.</p><Link href="/shop" className="btn">Browse all apparel</Link></div>}</div></>;
}
