import { useCallback, useEffect, useRef, useState } from "react";
import { geocodePlace } from "../shared/api/mapbox";
import { LngLat, PlaceSuggestion } from "../shared/types/place.types";

const DEBOUNCE_MS = 300;

export function useMapboxGeocoding() {
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlaces = useCallback((query: string, proximity?: LngLat) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const places = await geocodePlace(trimmed, proximity);
        setResults(places);
        setError(null);
      } catch (_err) {
        setResults([]);
        setError("Unable to load places right now.");
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { results, isLoading, error, searchPlaces };
}
