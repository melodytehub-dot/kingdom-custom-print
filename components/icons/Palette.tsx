export default function Palette({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 2.6c4.7 0 8.4 3.4 8.4 7.6 0 2.6-2 4.2-4.2 4.2h-1.5c-.9 0-1.6.7-1.6 1.6 0 .4.1.7.3 1 .3.4.4.8.4 1.2 0 1-.8 1.8-1.8 1.8-4.7 0-8.4-3.9-8.4-8.7S6.3 2.6 11 2.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="9" r="1.15" fill="currentColor" />
      <circle cx="11" cy="6.6" r="1.15" fill="currentColor" />
      <circle cx="15.2" cy="9" r="1.15" fill="currentColor" />
      <circle cx="15" cy="13.2" r="1.15" fill="currentColor" />
    </svg>
  );
}
