export default function Loading() {
  return (
    <div className="wrap loading-page" role="status" aria-live="polite">
      <div className="loading-page-content">
        <div className="loading-mark" aria-hidden="true"><span /><span /><span /></div>
        <p>Loading…</p>
      </div>
    </div>
  );
}
