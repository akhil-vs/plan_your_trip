/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const appJson = require("./app.json");

// Load mobile/.env then repo root .env (root does not override mobile).
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: false });

/** .env values are sometimes wrapped in quotes; strip one layer. */
function stripQuotedEnv(s) {
  if (s == null || s === "") return "";
  let t = String(s).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function originFromEnv(s) {
  return stripQuotedEnv(s).replace(/\/$/, "");
}

const explicit = originFromEnv(process.env.EXPO_PUBLIC_API_BASE_URL);
const nextAuth = originFromEnv(process.env.NEXTAUTH_URL);
const apiBaseUrl = explicit || nextAuth || "";

// Keep process.env in sync for tools that read it; the app prefers `expo.extra` (runtime)
// because `process.env.EXPO_PUBLIC_*` is often inlined at bundle time before this runs.
if (apiBaseUrl) {
  process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;
}

const mapboxPublicToken =
  stripQuotedEnv(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN) ||
  stripQuotedEnv(process.env.NEXT_PUBLIC_MAPBOX_TOKEN) ||
  "";

if (mapboxPublicToken) {
  process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN = mapboxPublicToken;
}

const prevExtra =
  typeof appJson.expo.extra === "object" && appJson.expo.extra !== null ? appJson.expo.extra : {};
const prevEas =
  typeof prevExtra.eas === "object" && prevExtra.eas !== null ? prevExtra.eas : {};

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...prevExtra,
      eas: {
        ...prevEas,
        projectId: "ae69b126-2726-4c9a-b857-f2915fcb5fcf",
      },
      apiBaseUrl,
      mapboxPublicToken,
    },
  },
};
