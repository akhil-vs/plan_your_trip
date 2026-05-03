import { NextRequest, NextResponse } from "next/server";
import { STAYCATION_LISTINGS } from "@/lib/discovery";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  const budget = req.nextUrl.searchParams.get("budgetBand");
  const tags = (req.nextUrl.searchParams.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const data = STAYCATION_LISTINGS.filter((listing) => {
    if (region && listing.region !== region) return false;
    if (budget && listing.budgetBand !== budget) return false;
    if (tags.length > 0 && !tags.every((tag) => listing.tags.includes(tag))) return false;
    return true;
  });
  return NextResponse.json(data);
}
