import createContextHook from "@nkzw/create-context-hook";
import { useState } from "react";

interface RadioStationSelection {
  name: string;
  url: string;
}

export const [RadioStationContext, useRadioStation] = createContextHook(() => {
  const [selectedStation, setSelectedStation] = useState<RadioStationSelection | null>(null);

  return {
    selectedStation,
    setSelectedStation,
  };
});
