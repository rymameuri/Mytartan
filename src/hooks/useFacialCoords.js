import { useEffect, useState } from "react";
import {
  FACIAL_COORDS_EVENT,
  loadFacialCoords,
} from "../utils/facialCoords";

export function useFacialCoords() {
  const [coords, setCoords] = useState(loadFacialCoords);

  useEffect(() => {
    function sync() {
      setCoords(loadFacialCoords());
    }

    window.addEventListener("storage", sync);
    window.addEventListener(FACIAL_COORDS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(FACIAL_COORDS_EVENT, sync);
    };
  }, []);

  return coords;
}
