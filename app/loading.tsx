import LoadingSpinner from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <div className="wrap loading-page" role="status" aria-live="polite">
      <div className="loading-page-content">
        <LoadingSpinner size={40} />
        <p>Loading…</p>
      </div>
    </div>
  );
}
