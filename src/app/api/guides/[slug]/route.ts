import { NextResponse } from "next/server";
import { GUIDE_ARTICLES } from "@/lib/discovery";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const guide = GUIDE_ARTICLES.find((item) => item.slug === slug);
  if (!guide) {
    return NextResponse.json({ error: "Guide not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...guide,
    sections: [
      { title: "Overview", body: guide.summary },
      {
        title: "Route Tips",
        body: "Start early, prioritize low-crowd windows, and keep one flexible buffer slot each day.",
      },
      {
        title: "What To Pack",
        body: "Waterproof layers, offline backup map, and one safety stop near each remote segment.",
      },
    ],
  });
}
