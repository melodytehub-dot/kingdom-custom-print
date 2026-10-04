import Link from "next/link";
import TrackForm from "@/components/TrackForm";

export const metadata = {
  title: "Track your order",
  description:
    "Look up a Kingdom Custom Print order by its reference to see the current production status and items.",
  robots: { index: false },
};

export default function TrackPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">Order status</p>
        <h1 className="h2">Track your order</h1>
        <p className="lede">
          Enter your order reference to see where the run is — from artwork approval through
          printing and dispatch.
        </p>
      </div>

      <section className="wrap section-tight">
        <div className="panel panel-pad track-panel">
          <TrackForm />
        </div>

        <div className="track-help">
          <p className="small muted">
            Lost the reference? Email us with the name and email used on the order and we will
            look it up.
          </p>
          <div className="track-links">
            <Link href="/contact" className="link">
              Contact us
            </Link>
            <Link href="/faq" className="link">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
