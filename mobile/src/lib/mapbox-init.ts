import Mapbox from "@rnmapbox/maps";
import { getEnv } from "@/config/env";

const token = getEnv().mapboxPublicToken;
if (token) {
  Mapbox.setAccessToken(token);
}
