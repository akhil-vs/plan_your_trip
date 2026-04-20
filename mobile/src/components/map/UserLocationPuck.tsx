import React from "react";
import Mapbox from "@rnmapbox/maps";

type UserLocationPuckProps = {
  visible: boolean;
};

export function UserLocationPuck({ visible }: UserLocationPuckProps) {
  if (!visible) {
    return null;
  }

  return <Mapbox.LocationPuck pulsing={{ isEnabled: true }} />;
}
