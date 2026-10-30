"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface SizeChartProps {
  productKind: string;
  productName: string;
  onClose: () => void;
}

// Standard size measurements for common garment types
const SIZE_CHARTS = {
  tee: {
    title: "T-Shirt Size Chart",
    note: "Measurements in inches. Lay garment flat and measure across chest from armpit to armpit, and from shoulder to hem for length.",
    sizes: [
      { size: "XS", chest: "16-17", length: "27-28" },
      { size: "S", chest: "18-19", length: "28-29" },
      { size: "M", chest: "20-21", length: "29-30" },
      { size: "L", chest: "22-23", length: "30-31" },
      { size: "XL", chest: "24-25", length: "31-32" },
      { size: "2XL", chest: "26-27", length: "32-33" },
      { size: "3XL", chest: "28-29", length: "33-34" },
    ],
  },
  longsleeve: {
    title: "Long Sleeve Size Chart",
    note: "Measurements in inches. Lay garment flat and measure across chest from armpit to armpit, and from shoulder to hem for length.",
    sizes: [
      { size: "XS", chest: "16-17", length: "27-28", sleeve: "33-34" },
      { size: "S", chest: "18-19", length: "28-29", sleeve: "34-35" },
      { size: "M", chest: "20-21", length: "29-30", sleeve: "35-36" },
      { size: "L", chest: "22-23", length: "30-31", sleeve: "36-37" },
      { size: "XL", chest: "24-25", length: "31-32", sleeve: "37-38" },
      { size: "2XL", chest: "26-27", length: "32-33", sleeve: "38-39" },
      { size: "3XL", chest: "28-29", length: "33-34", sleeve: "39-40" },
    ],
  },
  polo: {
    title: "Polo Shirt Size Chart",
    note: "Measurements in inches. Measure across chest and from shoulder seam to bottom hem.",
    sizes: [
      { size: "XS", chest: "17-18", length: "27-28" },
      { size: "S", chest: "19-20", length: "28-29" },
      { size: "M", chest: "21-22", length: "29-30" },
      { size: "L", chest: "23-24", length: "30-31" },
      { size: "XL", chest: "25-26", length: "31-32" },
      { size: "2XL", chest: "27-28", length: "32-33" },
      { size: "3XL", chest: "29-30", length: "33-34" },
    ],
  },
  hoodie: {
    title: "Hoodie Size Chart",
    note: "Measurements in inches. Hoodies have a relaxed fit. Measure across chest and from shoulder to hem.",
    sizes: [
      { size: "XS", chest: "18-19", length: "26-27" },
      { size: "S", chest: "20-21", length: "27-28" },
      { size: "M", chest: "22-23", length: "28-29" },
      { size: "L", chest: "24-25", length: "29-30" },
      { size: "XL", chest: "26-27", length: "30-31" },
      { size: "2XL", chest: "28-29", length: "31-32" },
      { size: "3XL", chest: "30-31", length: "32-33" },
    ],
  },
  crew: {
    title: "Crewneck Sweatshirt Size Chart",
    note: "Measurements in inches. Crewnecks have a relaxed fit. Measure across chest and from shoulder to hem.",
    sizes: [
      { size: "XS", chest: "18-19", length: "26-27" },
      { size: "S", chest: "20-21", length: "27-28" },
      { size: "M", chest: "22-23", length: "28-29" },
      { size: "L", chest: "24-25", length: "29-30" },
      { size: "XL", chest: "26-27", length: "30-31" },
      { size: "2XL", chest: "28-29", length: "31-32" },
      { size: "3XL", chest: "30-31", length: "32-33" },
    ],
  },
};

export default function SizeChart({ productKind, productName, onClose }: SizeChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const chart = SIZE_CHARTS[productKind as keyof typeof SIZE_CHARTS] || SIZE_CHARTS.tee;
  const hasSleeveColumn = chart.sizes[0] && "sleeve" in chart.sizes[0];

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content size-chart-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="size-chart-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 id="size-chart-title" className="h3">{chart.title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close size chart"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="small muted" style={{ marginBottom: "20px" }}>{chart.note}</p>

          <div style={{ overflowX: "auto" }}>
            <table className="size-chart-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Chest Width</th>
                  <th>Length</th>
                  {hasSleeveColumn && <th>Sleeve</th>}
                </tr>
              </thead>
              <tbody>
                {chart.sizes.map((row) => (
                  <tr key={row.size}>
                    <td><strong>{row.size}</strong></td>
                    <td>{row.chest}"</td>
                    <td>{row.length}"</td>
                    {hasSleeveColumn && <td>{(row as any).sleeve}"</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "24px", padding: "16px", background: "var(--bone)", borderRadius: "var(--r)" }}>
            <p className="small"><strong>Sizing tip:</strong> Cotton garments may shrink slightly after washing. If you're between sizes, we recommend sizing up for a more comfortable fit.</p>
          </div>

          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <button type="button" className="btn" onClick={onClose}>Got it</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
