export default function Truck({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M2.5 5.5h10a1 1 0 0 1 1 1v7.5h-11a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 8.5h3l3 3v2.5h-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="16.5" r="1.9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16.5" r="1.9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
