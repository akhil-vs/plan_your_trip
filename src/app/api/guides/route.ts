import { NextRequest, NextResponse } from "next/server";
import { GUIDE_ARTICLES } from "@/lib/discovery";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  const category = req.nextUrl.searchParams.get("category");
  const guides = GUIDE_ARTICLES.filter((guide) => {
    if (region && guide.region !== region) return false;
    if (category && guide.category !== category) return false;
    return true;
  });
  return NextResponse.json(guides);
}
