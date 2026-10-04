"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    // Simulate brief API call
    setTimeout(() => {
      setStatus("success");
      setMessage("🎉 You're subscribed! Use code MINIMOG10 for 10% off your first order.");
      setEmail("");
    }, 600);
  };

  return (
    <div className="mm-newsletter-wrap">
      {status === "success" ? (
        <div className="mm-newsletter-success" role="status">
          <p>{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mm-newsletter-form">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="Enter your email address..."
            className="mm-newsletter-input"
            aria-label="Email address for newsletter"
            required
            disabled={status === "loading"}
          />
          <button
            type="submit"
            className="mm-btn mm-btn-primary mm-newsletter-btn"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Subscribing..." : "SUBSCRIBE"}
          </button>
        </form>
      )}
      {status === "error" ? (
        <p className="mm-newsletter-error" role="alert">{message}</p>
      ) : null}
    </div>
  );
}
