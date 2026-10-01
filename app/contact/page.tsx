"use client";
import { useState } from "react";
export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: "Bulk quote", message: "" });
  if (sent) return <div className="wrap" style={{ paddingTop: 40 }}><h1>Message received.</h1><p className="muted">Thanks — we reply within one business day.</p></div>;
  return (
    <div className="wrap" style={{ paddingTop: 26, maxWidth: 640 }}>
      <p className="eyebrow">Contact</p>
      <h1>Get a quote or ask us anything</h1>
      <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <div><label className="lbl" htmlFor="c-name">Name</label><input id="c-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="lbl" htmlFor="c-email">Email</label><input id="c-email" className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="lbl" htmlFor="c-topic">Topic</label><select id="c-topic" className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}><option>Bulk quote</option><option>Artwork help</option><option>Sizing</option><option>Order support</option></select></div>
        <div><label className="lbl" htmlFor="c-msg">Message</label><textarea id="c-msg" className="input" rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Sizes, quantities, deadline, and a link to your artwork if you have one." /></div>
        <button className="btn">Send message</button>
      </form>
    </div>
  );
}
