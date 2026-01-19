import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { MapStyle } from "../types";
import { mapStyles, pakistanCities } from "../constants";

interface UseMapInitializationProps {
  mapContainer: React.RefObject<HTMLDivElement>;
  activeStyle: MapStyle;
  onMove?: (coordinates: { lng: number; lat: number }, zoom: number) => void;
  isRoutingMode?: boolean;
  selectingPoint?: "start" | "end" | null;
  onCityClick?: (coordinates: [number, number], name: string) => void;
  onMapLoad?: () => void;
}

export const useMapInitialization = ({
  mapContainer,
  activeStyle,
  onMove,
  isRoutingMode,
  selectingPoint,
  onCityClick,
  onMapLoad,
}: UseMapInitializationProps) => {
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: mapStyles[activeStyle].url,
        center: [73.0479, 33.6844], // Islamabad coordinates
        zoom: 12, // Closer zoom for city view
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        failIfMajorPerformanceCaveat: false,
      });

      map.current.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-left"
      );

      map.current.addControl(
        new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }),
        "bottom-right"
      );

      if (onMove) {
        map.current.on("move", () => {
          if (!map.current) return;
          const center = map.current.getCenter();
          onMove({ lng: center.lng, lat: center.lat }, map.current.getZoom());
        });
      }

      map.current.on("load", () => {
        console.log("Map loaded successfully");
        addCityMarkers();
        onMapLoad?.();
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
        // Try fallback style
        if (map.current && e.error && e.error.message.includes('style')) {
          console.log("Trying fallback style...");
          map.current.setStyle("https://demotiles.maplibre.org/style.json");
        }
      });

      map.current.on("styledata", () => {
        console.log("Style loaded");
      });

    } catch (error) {
      console.error("Failed to initialize map:", error);
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add city markers
  const addCityMarkers = () => {
    if (!map.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    pakistanCities.forEach((city) => {
      const el = document.createElement("div");
      el.className = "city-marker";
      el.innerHTML = `
        <div class="relative group cursor-pointer">
          <div class="absolute -inset-2 bg-emerald-500/30 rounded-full animate-ping"></div>
          <div class="relative w-4 h-4 ${city.type === "capital" ? "bg-amber-500" : "bg-emerald-500"} rounded-full border-2 border-white shadow-lg"></div>
          <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            <div class="bg-gray-900/90 text-white text-xs px-2 py-1 rounded shadow-lg">
              ${city.name}${city.type === "capital" ? " ★" : ""}
            </div>
          </div>
        </div>
      `;

      if (onCityClick) {
        el.addEventListener("click", (e) => {
          if (isRoutingMode && selectingPoint) {
            e.stopPropagation();
            onCityClick(city.coordinates, city.name);
          }
        });
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(city.coordinates)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  };

  // Re-add markers when routing mode changes
  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      addCityMarkers();
    }
  }, [isRoutingMode, selectingPoint]);

  return { map: map.current, markersRef };
};
