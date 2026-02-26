"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2 } from "lucide-react";
import { searchLocations, resetSearchSession, SearchResult } from "@/lib/api/mapbox";
import { useTripStore } from "@/stores/tripStore";
import { useMapStore } from "@/stores/mapStore";

export function SearchInput() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const insertWaypointNear = useTripStore((s) => s.insertWaypointNear);
  const { setViewState, viewState } = useMapStore();
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const proximity =
        viewState.longitude !== 0 || viewState.latitude !== 0
          ? { lng: viewState.longitude, lat: viewState.latitude }
          : undefined;
      const data = await searchLocations(q, proximity);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [viewState.longitude, viewState.latitude]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 450);
  };

  const handleSelect = (result: SearchResult) => {
    insertWaypointNear({ name: result.name, lat: result.lat, lng: result.lng });
    setViewState({ longitude: result.lng, latitude: result.lat, zoom: 10 });
    setQuery("");
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
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search destinations worldwide..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border shadow-lg max-h-80 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
            >
              <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.fullName}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
