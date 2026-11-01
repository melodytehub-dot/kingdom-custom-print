"use client";

export default function PrintInvoiceButton() {
  return <button type="button" className="btn admin-invoice-print" onClick={() => window.print()}>Print or save as PDF</button>;
}
