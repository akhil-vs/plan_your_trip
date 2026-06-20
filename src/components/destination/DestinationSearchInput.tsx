"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";
import {
  searchLocations,
  resetSearchSession,
  type SearchResult,
  retrieveLocationById,
} from "@/lib/api/mapbox";
import { cn } from "@/lib/utils";

export type DestinationSearchSelection = {
  mapboxId: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
  featureType?: string;
};

type Props = {
  value: DestinationSearchSelection | null;
  onChange: (next: DestinationSearchSelection | null) => void;
  proximity?: { lng: number; lat: number };
  disabled?: boolean;
  placeholder?: string;
  inputId?: string;
  className?: string;
  inputClassName?: string;
};

function featureTypeLabel(featureType?: string): string | null {
  switch ((featureType || "").toLowerCase()) {
    case "place":
    case "locality":
      return "City / town";
    case "region":
    case "country":
      return "Region";
    case "district":
    case "neighborhood":
      return "Area";
    case "poi":
    case "landmark":
    case "attraction":
      return "Landmark";
    default:
      return null;
  }
}

function featureTypeHint(featureType?: string): string | null {
  const t = (featureType || "").toLowerCase();
  if (["poi", "landmark", "attraction", "establishment"].includes(t)) {
    return "Itinerary covers the wider surrounding area";
  }
  if (["place", "locality", "region", "country", "district", "neighborhood"].includes(t)) {
    return "Stops across the full area";
  }
  return null;
}

const STREET_WORDS = [
  "street",
  "road",
  "rd",
  "st",
  "ave",
  "avenue",
  "highway",
  "blvd",
  "lane",
  "drive",
  "boulevard",
];

function looksLikeRoadName(v: string): boolean {
  const lower = v.toLowerCase();
  const hasRoadWord = STREET_WORDS.some((w) => lower.includes(` ${w}`) || lower.endsWith(` ${w}`));
  const startsWithStreetNumber = /^\d+[a-z]?\s+/.test(lower);
  if (startsWithStreetNumber && hasRoadWord) return true;
  return STREET_WORDS.some((w) => lower === w);
}

export function DestinationSearchInput({
  value,
  onChange,
  proximity,
  disabled = false,
  placeholder = "Search city, region, or landmark…",
  inputId,
  className,
  inputClassName,
}: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.name) setQuery(value.name);
  }, [value?.name]);

  const doSearch = useCallback(
    async (q: string) => {
      if (disabled) return;
      if (q.trim().length < 3) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const data = await searchLocations(q, proximity, { context: "generate", limit: 10 });
        const filtered = data.filter((row) => !looksLikeRoadName(row.name));
        setResults(filtered);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [disabled, proximity]
  );

  const handleChange = (next: string) => {
    if (disabled) return;
    setQuery(next);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(next), 350);
  };

  const handleSelect = async (result: SearchResult) => {
    if (disabled) return;
    let selected = result;
    if (selected.lat === undefined || selected.lng === undefined) {
      setLoading(true);
      const resolved = await retrieveLocationById(result.id);
      setLoading(false);
      if (!resolved || resolved.lat === undefined || resolved.lng === undefined) return;
      selected = resolved;
    }
    const { lat, lng } = selected;
    if (lat === undefined || lng === undefined) return;
    onChange({
      mapboxId: selected.id,
      name: selected.name,
      fullName: selected.fullName || selected.name,
      lat,
      lng,
      featureType: selected.featureType,
    });
    setQuery(selected.name);
    setResults([]);
    setOpen(false);
    resetSearchSession();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative z-30 w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (results.length > 0) void handleSelect(results[0]);
              else if (query.trim().length >= 3) void doSearch(query);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          className={cn("pl-10 min-h-14 rounded-xl border-slate-300 px-4 text-lg", inputClassName)}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-[120] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.length > 0 ? (
            results.map((r) => {
              const badge = featureTypeLabel(r.featureType);
              const hint = featureTypeHint(r.featureType);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void handleSelect(r)}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                      {badge ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    {r.fullName && r.fullName !== r.name ? (
                      <p className="truncate text-xs text-slate-500">{r.fullName}</p>
                    ) : null}
                    {hint ? <p className="mt-0.5 text-[11px] text-blue-700">{hint}</p> : null}
                  </div>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-3 text-xs text-slate-500">
              No destinations found. Try a city, region, or landmark name.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
