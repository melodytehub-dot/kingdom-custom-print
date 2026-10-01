export default function Store({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 8.5V17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M2.6 8.5 4.3 4.6A1.4 1.4 0 0 1 5.6 3.8h10.8a1.4 1.4 0 0 1 1.3.8l1.7 3.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M2.6 8.5a2.1 2.1 0 0 0 4.2 0 2.1 2.1 0 0 0 4.2 0 2.1 2.1 0 0 0 4.2 0 2.1 2.1 0 0 0 4.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
