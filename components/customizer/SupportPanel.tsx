"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HeadsetIcon } from "./icons";

export default function SupportPanel({ phone }: { phone: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [messages, setMessages] = useState<{ sender: string; body: string; created_at: string }[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const latestMessageTime = messages.at(-1)?.created_at;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/support", { cache: "no-store" });
      if (!response.ok) throw new Error("Unavailable");
      const result = await response.json() as { messages: { sender: string; body: string; created_at: string }[]; available: boolean };
      setMessages(result.messages);
      setAvailable(result.available);
      setLoadError(false);
    } catch { setLoadError(true); }
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);
  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages.length, latestMessageTime, open]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setStatus("sending");
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.get("name"), email: values.get("email"), message: values.get("message") }) });
      if (!response.ok) throw new Error("Message could not be sent");
      form.reset();
      setStatus("sent");
      await refresh();
    } catch { setStatus("error"); }
  }

  return <div className="rot-support">
    <button type="button" className="rot-barbtn rot-support-trigger" aria-label="Contact customer service" aria-expanded={open} aria-controls="rot-support-panel" onClick={() => { if (!open) void refresh(); setOpen(!open); }}><HeadsetIcon size={34} /><span>Call or Chat</span></button>
    {open && <section id="rot-support-panel" className="rot-support-panel" aria-label="Customer support">
      <div className="rot-support-heading"><div><span>Kingdom Custom Print</span><h2>Chat with us</h2></div><button type="button" aria-label="Close support" onClick={() => setOpen(false)}>×</button></div>
      <p>Ask us about your design or order. We’ll reply here and by email.</p>
      {phone && <a className="rot-support-call" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>Call {phone}</a>}
      {messages.length > 0 && <div ref={conversationRef} className="rot-support-messages" aria-label="Conversation" aria-live="polite">{messages.map((message, index) => <div key={index} className={`rot-support-message ${message.sender === "customer" ? "is-customer" : "is-business"}`}><strong>{message.sender === "customer" ? "You" : "Kingdom Custom Print"}</strong><p>{message.body}</p></div>)}</div>}
      {loadError && <p role="status">We couldn’t load your conversation. Please try again.</p>}
      {available === false && <p>Messaging is temporarily unavailable. Please call us or <a href="/contact">contact us by email</a>.</p>}
      {available === true && <form onSubmit={send} className="rot-support-form">
        {messages.length === 0 && <><label>Your name<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label></>}
        <label>How can we help?<textarea name="message" required maxLength={4000} rows={3} /></label>
        <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send message"}</button>
        <p role="status" aria-live="polite">{status === "sent" ? "Message sent. We’ll reply here and by email." : status === "error" ? "We couldn’t send your message. Please try again or call us." : ""}</p>
      </form>}
    </section>}
  </div>;
}
