export default function Chat({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M4 4.5h14a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 18 15H9.5L5 18.4V15H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
