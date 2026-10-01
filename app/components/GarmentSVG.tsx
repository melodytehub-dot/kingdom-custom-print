export default function GarmentSVG({ kind, hex, id }: { kind: string; hex: string; id?: string }) {
  const gid = `${kind}-${id ?? "x"}`;
  if (kind === "cap") {
    return (
      <svg viewBox="0 0 300 220" role="img" aria-label="Cap preview" style={{ width: "100%", height: "auto", display: "block" }}>
        <ellipse cx="150" cy="170" rx="110" ry="18" fill="#000" opacity=".08" />
        <path d="M70 150 Q75 70 150 62 Q225 70 230 150 L200 155 Q190 100 150 96 Q110 100 100 155 Z" fill={hex} stroke="#00000022" strokeWidth="2" />
        <path d="M148 62 h4 v22 h-4 z" fill="#00000033" />
        <ellipse cx="150" cy="158" rx="82" ry="12" fill="#00000018" />
      </svg>
    );
  }
  if (kind === "mug") {
    return (
      <svg viewBox="0 0 300 220" role="img" aria-label="Mug preview" style={{ width: "100%", height: "auto", display: "block" }}>
        <ellipse cx="140" cy="182" rx="70" ry="12" fill="#000" opacity=".08" />
        <rect x="85" y="55" width="110" height="120" rx="10" fill={hex} stroke="#00000022" strokeWidth="2" />
        <path d="M195 80 q40 5 32 45 q-7 34-40 30" fill="none" stroke={hex} strokeWidth="18" />
        <path d="M195 80 q40 5 32 45 q-7 34-40 30" fill="none" stroke="#00000022" strokeWidth="18" opacity=".35" />
        <rect x={`-${gid}`} width="0" height="0" fill="none" />
      </svg>
    );
  }
  if (kind === "hoodie") {
    return (
      <svg viewBox="0 0 300 300" role="img" aria-label="Hoodie preview" style={{ width: "100%", height: "auto", display: "block" }}>
        <path d="M105 55 Q150 30 195 55 L215 70 240 120 210 132 205 110 205 255 95 255 95 110 90 132 60 120 85 70 Z" fill={hex} stroke="#00000026" strokeWidth="2" />
        <path d="M115 60 Q150 88 185 60 Q178 92 150 96 Q122 92 115 60" fill="#00000030" />
        <rect x="118" y="190" width="64" height="44" rx="4" fill="#00000022" />
      </svg>
    );
  }
  if (kind === "crew") {
    return (
      <svg viewBox="0 0 300 300" role="img" aria-label="Crewneck preview" style={{ width: "100%", height: "auto", display: "block" }}>
        <path d="M108 60 70 90 55 150 82 158 92 128 92 260 208 260 208 128 218 158 245 150 230 90 192 60 Q171 78 150 78 Q129 78 108 60" fill={hex} stroke="#00000026" strokeWidth="2" />
        <path d="M118 62 Q150 84 182 62" fill="none" stroke="#00000033" strokeWidth="5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 300" role="img" aria-label="T-shirt preview" style={{ width: "100%", height: "auto", display: "block" }}>
      <path d="M110 55 70 80 45 135 78 148 90 122 90 260 210 260 210 122 222 148 255 135 230 80 190 55 Q172 74 150 74 Q128 74 110 55" fill={hex} stroke="#00000026" strokeWidth="2" />
      <path d="M118 57 Q150 80 182 57" fill="none" stroke="#00000033" strokeWidth="5" />
    </svg>
  );
}
