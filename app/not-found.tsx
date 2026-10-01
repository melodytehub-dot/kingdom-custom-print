import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap section">
      <div className="state">
        <p className="eyebrow">Error 404</p>
        <h1 className="display">Page not found</h1>
        <p>
          That page has moved or the link is out of date. Try the shop or start a new
          design.
        </p>
        <div className="state-actions">
          <Link href="/shop" className="btn">
            Browse blanks
          </Link>
          <Link href="/customize" className="btn btn-ghost">
            Start designing
          </Link>
        </div>
      </div>
    </div>
  );
}
