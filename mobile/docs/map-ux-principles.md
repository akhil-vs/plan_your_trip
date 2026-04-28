# Map UX Principles Applied

This mobile implementation uses Mapbox with Google Maps-inspired UX behavior.

## Visual Hierarchy

- Route lines render in dual-layer (halo + core) for movement legibility.
- Active/primary markers are visually stronger than passive stops.
- Non-essential map chrome is hidden by default (`logoEnabled={false}`, no scale bar).

## Camera and Task Context

- Camera centers on first trip stop when available.
- Default zoom level adapts by context:
  - global fallback for empty state
  - city-level for planning existing stops

## Control Placement

- Right-side floating controls are thumb-reachable and grouped by action type:
  - add stop
  - optimize route
  - cycle map style
- Planner details remain in a bottom sheet for progressive disclosure.

## Gesture and Panel Conflict

- Map tap-to-add is explicit (`pickMode`) to prevent accidental stop creation.
- Secondary information and itinerary controls live in bottom sheet, not over map.

## Readability and Accessibility

- Marker and route tokens define minimum sizes and contrast.
- Light/dark/terrain styles support varied environmental conditions.
