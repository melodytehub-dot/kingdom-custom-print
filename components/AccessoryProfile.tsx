import { useId } from "react";
import type { ProductKind } from "@/lib/types";

export default function AccessoryProfile({ kind, color, title }: { kind: ProductKind; color: string; title: string }) {
  const id = useId();
  return <svg viewBox="0 0 320 340" role="img" aria-label={title} width="100%" height="100%">
    <defs><linearGradient id={id}><stop stopColor={color}/><stop offset=".65" stopColor={color}/><stop offset="1" stopColor="#333"/></linearGradient></defs>
    <ellipse cx="160" cy="284" rx="92" ry="9" fill="#000" opacity=".08"/>
    {kind === "cap" ? <g>
      <path d="M60 232C62 142 105 106 151 112C200 115 225 167 224 232Z" fill={`url(#${id})`} stroke="#0003"/>
      <path d="M167 230Q234 229 287 257Q274 274 168 246Z" fill={color} stroke="#0004"/>
      <path d="M150 113Q123 168 130 231M72 220L123 223" fill="none" stroke="#fff5" strokeWidth="2"/>
      <rect x="59" y="220" width="29" height="13" rx="4" fill="#333"/>
    </g> : kind === "tote" ? <g>
      <path d="M132 137V98Q133 54 161 54Q190 54 189 98V137" fill="none" stroke={color} strokeWidth="14"/>
      <path d="M122 129L197 129L213 278L111 278Z" fill={`url(#${id})`} stroke="#0003"/>
      <path d="M161 131L161 276L195 260M118 256L161 276" fill="none" stroke="#0004"/>
    </g> : <g>
      <path d="M96 111H224V254Q224 279 200 279H120Q96 279 96 254Z" fill={`url(#${id})`} stroke="#0003"/>
      <ellipse cx="160" cy="111" rx="64" ry="14" fill={color} stroke="#0004"/>
      <ellipse cx="160" cy="111" rx="54" ry="8" fill="#eee"/>
      <path d="M163 151Q201 151 201 210Q201 266 163 253" fill="none" stroke="#0003" strokeWidth="22"/>
      <path d="M163 151Q201 151 201 210Q201 266 163 253" fill="none" stroke={color} strokeWidth="15"/>
    </g>}
  </svg>;
}
