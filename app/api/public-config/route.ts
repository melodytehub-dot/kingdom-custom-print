import { NextResponse } from "next/server";
import { cleanImgixDomain } from "@/lib/imgixCutout";

export const dynamic = "force-dynamic";

export function GET() {
  const source = cleanImgixDomain(process.env.KCP_IMGIX_SOURCE ?? process.env.NEXT_PUBLIC_IMGIX_SOURCE ?? "");
  const imgixSource = /^[a-z0-9-]+\.imgix\.net$/i.test(source) ? source : "";
  return NextResponse.json({ imgixSource }, { headers: { "Cache-Control": "no-store" } });
}
