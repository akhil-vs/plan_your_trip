export type UserPlan = "FREE" | "PRO" | "TEAM";

export type ApiUser = {
  id: string;
  name: string | null;
  email: string;
  plan: UserPlan;
  onboardingComplete: boolean;
  travelPreference: string | null;
  isAdmin: boolean;
};

export type Waypoint = {
  id?: string;
  name: string;
  notes?: string | null;
  lat: number;
  lng: number;
  order: number;
  isLocked?: boolean;
  visitMinutes?: number;
  openMinutes?: number;
  closeMinutes?: number;
};

export type DayPlan = {
  day: number;
  waypointIndexes: number[];
  waypointIds?: string[];
  estimatedTravelMinutes: number;
};

export type Trip = {
  id: string;
  name: string;
  description?: string | null;
  /** Structured AI copy from hybrid generator when present */
  aiPlanMeta?: unknown;
  status?: string;
  isPublic?: boolean;
  updatedAt?: string;
  waypoints: Waypoint[];
  dayPlans?: DayPlan[];
  optimizerDayStartMinutes?: number;
  optimizerDayEndMinutes?: number;
  optimizerDefaultVisitMinutes?: number;
};

export type RouteGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type RouteSummary = {
  distance: number;
  duration: number;
  geometry: RouteGeometry | null;
  legs: { distance: number; duration: number }[];
};

export type LocationSearchResult = {
  id: string;
  name: string;
  fullName?: string;
  lat: number;
  lng: number;
  provider?: "mapbox" | "google";
  scope?: "route" | "nearby";
  primaryType?: string;
  rating?: number;
  userRatingsTotal?: number;
  openNow?: boolean;
};

export type GemCategoryKey =
  | "waterfalls"
  | "beaches"
  | "wild_swimming"
  | "family_friendly"
  | "accessible"
  | "castles";

export type RegionKey = "england" | "scotland" | "wales" | "northern_ireland";

export type DiscoveryGem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: GemCategoryKey;
  categoryLabel: string;
  region: RegionKey;
  regionLabel: string;
  kinds?: string;
};

export type SavedGem = {
  id: string;
  externalId: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  notes?: string | null;
  tripId: string;
};

export type GuideArticle = {
  slug: string;
  title: string;
  summary: string;
  region: RegionKey;
  category: GemCategoryKey;
  readMinutes: number;
};

export type StaycationListing = {
  id: string;
  name: string;
  region: RegionKey;
  tags: string[];
  budgetBand: "budget" | "mid" | "premium";
  priceFrom: number;
};
