"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";
import {
  searchLocations,
  resetSearchSession,
  SearchResult,
  retrieveLocationById,
} from "@/lib/api/mapbox";

export type DestinationSelection = {
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  value: DestinationSelection | null;
  onChange: (next: DestinationSelection | null) => void;
  disabled?: boolean;
};

export function OnboardingDestinationInput({
  value,
  onChange,
  disabled = false,
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
        const data = await searchLocations(q);
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [disabled]
  );

  const handleChange = (next: string) => {
    if (disabled) return;
    setQuery(next);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(next), 650);
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
    onChange({ name: selected.name, lat, lng });
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
    <div ref={containerRef} className="relative z-20 w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="City, region, or landmark…"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (results.length > 0) void handleSelect(results[0]);
              else if (query.trim().length >= 3) void doSearch(query);
            }
          }}
          className="pl-10 min-h-11"
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-[120] w-full mt-1 bg-card rounded-lg border shadow-lg max-h-72 overflow-y-auto">
          {results.length > 0 ? (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void handleSelect(r)}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted/60 text-left transition-colors"
              >
                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.fullName}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              No locations found. Try another search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
