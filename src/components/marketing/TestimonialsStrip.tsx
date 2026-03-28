"use client";

import { Quote } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";
import { cn } from "@/lib/utils";

const items: Array<{
  quote: string;
  name: string;
  role: string;
  featured?: boolean;
}> = [
  {
    quote:
      "Finally one place for our group trip — map, day-by-day plan, and PDF export. We stopped juggling five different apps.",
    name: "Maya Chen",
    role: "Product designer",
  },
  {
    quote:
      "The route optimizer saved us hours. We reshuffled stops and the map updated instantly — exactly what we needed for Japan.",
    name: "James Okonkwo",
    role: "Solo traveler",
    featured: true,
  },
  {
    quote:
      "Sharing a link with family meant everyone saw the same plan. No more 'which spreadsheet is latest?' in the group chat.",
    name: "Sofia Reyes",
    role: "Family trip organizer",
  },
];

export function TestimonialsStrip() {
  return (
    <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
      {items.map((item, i) => (
        <FadeIn key={item.name} delay={i * 0.08}>
          <figure
            className={cn(
              "h-full rounded-xl border p-5 sm:p-6 shadow-sm transition-shadow hover:shadow-md",
              item.featured
                ? "border-blue-200 bg-gradient-to-b from-blue-50/80 to-white ring-1 ring-blue-500/10"
                : "border-gray-200/90 bg-gradient-to-b from-gray-50/80 to-white"
            )}
          >
            <Quote
              className={cn(
                "h-7 w-7 mb-3 shrink-0",
                item.featured ? "text-blue-300" : "text-gray-300"
              )}
              aria-hidden
              focusable={false}
            />
            <blockquote className="text-gray-700 text-[15px] sm:text-base leading-relaxed">
              “{item.quote}”
            </blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-semibold text-gray-900">{item.name}</span>
              <span className="text-slate-500"> · {item.role}</span>
            </figcaption>
          </figure>
        </FadeIn>
      ))}
    </div>
  );
}
