import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  Layers,
  Navigation,
  Crosshair,
  Maximize2,
  LocateFixed,
  Compass,
  Loader2,
  Route,
  MapPin,
  X,
  Clock,
  Ruler,
  Car,
  Bike,
  Footprints,
  RotateCcw,
} from "lucide-react";

type MapStyle = "streets" | "satellite" | "terrain";
type TravelMode = "driving" | "cycling" | "walking";

const mapStyles: Record<MapStyle, { name: string; url: string }> = {
  streets: {
    name: "Streets",
    url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  },
  satellite: {
    name: "Satellite",
    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },
  terrain: {
    name: "Terrain",
    url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  },
};

const travelModes: Record<TravelMode, { name: string; icon: typeof Car; profile: string }> = {
  driving: { name: "Drive", icon: Car, profile: "driving" },
  cycling: { name: "Cycle", icon: Bike, profile: "cycling" },
  walking: { name: "Walk", icon: Footprints, profile: "foot" },
};

// Major cities of Pakistan
const pakistanCities = [
  { name: "Islamabad", coordinates: [73.0479, 33.6844] as [number, number], type: "capital" },
  { name: "Lahore", coordinates: [74.3587, 31.5204] as [number, number], type: "city" },
  { name: "Karachi", coordinates: [67.0011, 24.8607] as [number, number], type: "city" },
  { name: "Peshawar", coordinates: [71.5249, 34.0151] as [number, number], type: "city" },
  { name: "Quetta", coordinates: [66.9750, 30.1798] as [number, number], type: "city" },
  { name: "Faisalabad", coordinates: [73.1350, 31.4504] as [number, number], type: "city" },
  { name: "Multan", coordinates: [71.5249, 30.1575] as [number, number], type: "city" },
  { name: "Rawalpindi", coordinates: [73.0169, 33.5651] as [number, number], type: "city" },
];

interface RoutePoint {
  lngLat: [number, number];
  name?: string;
}

interface RouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: GeoJSON.LineString;
}

const MapViewer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const startMarker = useRef<maplibregl.Marker | null>(null);
  const endMarker = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [activeStyle, setActiveStyle] = useState<MapStyle>("streets");
  const [zoom, setZoom] = useState(5);
  const [coordinates, setCoordinates] = useState({ lng: 69.3451, lat: 30.3753 });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Routing state
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [startPoint, setStartPoint] = useState<RoutePoint | null>(null);
  const [endPoint, setEndPoint] = useState<RoutePoint | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [selectingPoint, setSelectingPoint] = useState<"start" | "end" | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyles[activeStyle].url,
      center: [69.3451, 30.3753],
      zoom: 5,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left"
    );

    map.current.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }),
      "bottom-right"
    );

    map.current.on("move", () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      setCoordinates({ lng: center.lng, lat: center.lat });
      setZoom(map.current.getZoom());
    });

    map.current.on("load", () => {
      addCityMarkers();
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle map click for routing
  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!isRoutingMode || !selectingPoint) return;

      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      if (selectingPoint === "start") {
        setStartPoint({ lngLat });
        setSelectingPoint("end");
      } else if (selectingPoint === "end") {
        setEndPoint({ lngLat });
        setSelectingPoint(null);
      }
    };

    map.current.on("click", handleMapClick);

    return () => {
      map.current?.off("click", handleMapClick);
    };
  }, [isRoutingMode, selectingPoint]);

  // Update markers when points change
  useEffect(() => {
    if (!map.current) return;

    // Update start marker
    if (startPoint) {
      if (startMarker.current) {
        startMarker.current.setLngLat(startPoint.lngLat);
      } else {
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="relative">
            <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <span class="text-white text-sm font-bold">A</span>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-500 rotate-45"></div>
          </div>
        `;
        startMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(startPoint.lngLat)
          .addTo(map.current);
      }
    } else if (startMarker.current) {
      startMarker.current.remove();
      startMarker.current = null;
    }

    // Update end marker
    if (endPoint) {
      if (endMarker.current) {
        endMarker.current.setLngLat(endPoint.lngLat);
      } else {
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="relative">
            <div class="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <span class="text-white text-sm font-bold">B</span>
            </div>
            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rotate-45"></div>
          </div>
        `;
        endMarker.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(endPoint.lngLat)
          .addTo(map.current);
      }
    } else if (endMarker.current) {
      endMarker.current.remove();
      endMarker.current = null;
    }
  }, [startPoint, endPoint]);

  // Calculate route when both points are set
  useEffect(() => {
    if (startPoint && endPoint) {
      calculateRoute();
    }
  }, [startPoint, endPoint, travelMode]);

  const calculateRoute = async () => {
    if (!startPoint || !endPoint || !map.current) return;

    setIsCalculatingRoute(true);
    setRouteInfo(null);

    try {
      const profile = travelModes[travelMode].profile;
      const url = `https://router.project-osrm.org/route/v1/${profile}/${startPoint.lngLat[0]},${startPoint.lngLat[1]};${endPoint.lngLat[0]},${endPoint.lngLat[1]}?overview=full&geometries=geojson`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === "Ok" && data.routes.length > 0) {
        const route = data.routes[0];
        const geometry = route.geometry as GeoJSON.LineString;

        setRouteInfo({
          distance: route.distance,
          duration: route.duration,
          geometry,
        });

        // Draw route on map
        drawRoute(geometry);

        // Fit map to route
        const coordinates = geometry.coordinates as [number, number][];
        const bounds = coordinates.reduce(
          (bounds, coord) => bounds.extend(coord as maplibregl.LngLatLike),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
        );
        map.current.fitBounds(bounds, { padding: 80, duration: 1000 });
      }
    } catch (error) {
      console.error("Routing error:", error);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const drawRoute = (geometry: GeoJSON.LineString) => {
    if (!map.current) return;

    // Remove existing route
    if (map.current.getSource("route")) {
      map.current.removeLayer("route-line");
      map.current.removeLayer("route-line-outline");
      map.current.removeSource("route");
    }

    // Add route source and layers
    map.current.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry,
      },
    });

    // Route outline
    map.current.addLayer({
      id: "route-line-outline",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#1e40af",
        "line-width": 8,
        "line-opacity": 0.5,
      },
    });

    // Route line
    map.current.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3b82f6",
        "line-width": 5,
      },
    });
  };

  const clearRoute = () => {
    if (map.current) {
      if (map.current.getSource("route")) {
        map.current.removeLayer("route-line");
        map.current.removeLayer("route-line-outline");
        map.current.removeSource("route");
      }
    }
    
    startMarker.current?.remove();
    startMarker.current = null;
    endMarker.current?.remove();
    endMarker.current = null;
    
    setStartPoint(null);
    setEndPoint(null);
    setRouteInfo(null);
    setSelectingPoint("start");
  };

  const toggleRoutingMode = () => {
    if (isRoutingMode) {
      setIsRoutingMode(false);
      clearRoute();
      setSelectingPoint(null);
    } else {
      setIsRoutingMode(true);
      setSelectingPoint("start");
    }
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  // Add city markers
  const addCityMarkers = useCallback(() => {
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

      // Click handler to set as route point
      el.addEventListener("click", (e) => {
        if (isRoutingMode && selectingPoint) {
          e.stopPropagation();
          if (selectingPoint === "start") {
            setStartPoint({ lngLat: city.coordinates, name: city.name });
            setSelectingPoint("end");
          } else {
            setEndPoint({ lngLat: city.coordinates, name: city.name });
            setSelectingPoint(null);
          }
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(city.coordinates)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [isRoutingMode, selectingPoint]);

  // Re-add markers when routing mode changes
  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      addCityMarkers();
    }
  }, [isRoutingMode, selectingPoint, addCityMarkers]);

  const handleStyleChange = (style: MapStyle) => {
    if (!map.current) return;
    setActiveStyle(style);
    map.current.setStyle(mapStyles[style].url);
    
    map.current.once("styledata", () => {
      addCityMarkers();
      if (userMarker.current) {
        const lngLat = userMarker.current.getLngLat();
        userMarker.current.remove();
        userMarker.current = createUserMarker(lngLat);
      }
      // Redraw route if exists
      if (routeInfo) {
        setTimeout(() => drawRoute(routeInfo.geometry), 100);
      }
    });
  };

  const createUserMarker = (lngLat: maplibregl.LngLatLike) => {
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="relative">
        <div class="absolute -inset-3 bg-blue-500/30 rounded-full animate-pulse"></div>
        <div class="relative w-5 h-5 bg-blue-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>
      </div>
    `;
    
    return new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map.current!);
  };

  const handleZoomIn = () => map.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map.current?.zoomOut({ duration: 300 });

  const handleResetView = () => {
    map.current?.flyTo({
      center: [69.3451, 30.3753],
      zoom: 5,
      pitch: 0,
      bearing: 0,
      duration: 1500,
    });
  };

  const handleResetNorth = () => {
    map.current?.easeTo({ bearing: 0, duration: 300 });
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        
        if (map.current) {
          if (userMarker.current) {
            userMarker.current.remove();
          }

          userMarker.current = createUserMarker([longitude, latitude]);

          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            duration: 2000,
          });
        }

        setIsLocating(false);
      },
      (error) => {
        setLocationError(error.message);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleFullscreen = () => {
    if (mapContainer.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        mapContainer.current.requestFullscreen();
      }
    }
  };

  return (
    <section className="py-20 bg-secondary" id="map-demo">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Live Map Platform
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground mb-4">
            Interactive Map with Navigation
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real-time routing with distance and ETA calculation. Click the route button, 
            select start and end points, and get instant navigation.
          </p>
        </motion.div>

        {/* Map Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-card max-w-6xl mx-auto"
        >
          {/* Map Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-navy-deep border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-gold" />
                <div className="w-3 h-3 rounded-full bg-primary" />
              </div>
              <span className="text-white/80 text-sm font-medium">NPMI Navigator v2.0</span>
            </div>
            <div className="flex items-center gap-4">
              {isRoutingMode && (
                <span className="text-xs text-primary bg-primary/20 px-2 py-1 rounded-full">
                  Routing Mode
                </span>
              )}
              <span className="text-xs text-white/50 hidden sm:block">
                Zoom: {zoom.toFixed(1)}x
              </span>
              <Crosshair className="w-4 h-4 text-white/50" />
            </div>
          </div>

          {/* Map Content */}
          <div className="relative h-[600px]">
            {/* MapLibre Map */}
            <div 
              ref={mapContainer} 
              className={`absolute inset-0 ${isRoutingMode && selectingPoint ? "cursor-crosshair" : ""}`} 
            />

            {/* Routing Panel */}
            <AnimatePresence>
              {isRoutingMode && (
                <motion.div
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ type: "spring", damping: 25 }}
                  className="absolute left-4 top-4 w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 overflow-hidden z-20"
                >
                  {/* Panel Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
                    <div className="flex items-center gap-2">
                      <Route className="w-5 h-5" />
                      <span className="font-semibold">Route Planner</span>
                    </div>
                    <button
                      onClick={toggleRoutingMode}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Travel Mode Selector */}
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      {(Object.keys(travelModes) as TravelMode[]).map((mode) => {
                        const Icon = travelModes[mode].icon;
                        return (
                          <button
                            key={mode}
                            onClick={() => setTravelMode(mode)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-all ${
                              travelMode === mode
                                ? "bg-white shadow text-primary"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{travelModes[mode].name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Route Points */}
                  <div className="p-3 space-y-3">
                    {/* Start Point */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        selectingPoint === "start" 
                          ? "border-emerald-500 bg-emerald-50" 
                          : startPoint 
                            ? "border-emerald-200 bg-emerald-50/50" 
                            : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => !startPoint && setSelectingPoint("start")}
                    >
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        A
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">Start Point</div>
                        <div className="text-sm font-medium truncate">
                          {startPoint?.name || (selectingPoint === "start" ? "Click on map..." : "Select start")}
                        </div>
                      </div>
                      {startPoint && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStartPoint(null);
                            setSelectingPoint("start");
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>

                    {/* Connector Line */}
                    <div className="flex justify-center">
                      <div className="w-0.5 h-4 bg-gray-300" />
                    </div>

                    {/* End Point */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        selectingPoint === "end" 
                          ? "border-red-500 bg-red-50" 
                          : endPoint 
                            ? "border-red-200 bg-red-50/50" 
                            : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => startPoint && !endPoint && setSelectingPoint("end")}
                    >
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        B
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500">End Point</div>
                        <div className="text-sm font-medium truncate">
                          {endPoint?.name || (selectingPoint === "end" ? "Click on map..." : "Select destination")}
                        </div>
                      </div>
                      {endPoint && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEndPoint(null);
                            setSelectingPoint("end");
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Route Info */}
                  <AnimatePresence>
                    {(isCalculatingRoute || routeInfo) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 overflow-hidden"
                      >
                        {isCalculatingRoute ? (
                          <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Calculating route...</span>
                          </div>
                        ) : routeInfo && (
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Ruler className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Distance</div>
                                  <div className="text-lg font-bold text-gray-900">
                                    {formatDistance(routeInfo.distance)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                  <Clock className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">ETA</div>
                                  <div className="text-lg font-bold text-gray-900">
                                    {formatDuration(routeInfo.duration)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Clear Button */}
                  {(startPoint || endPoint) && (
                    <div className="p-3 border-t border-gray-100">
                      <button
                        onClick={clearRoute}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Clear Route
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Layer Controls (only show when not routing) */}
            {!isRoutingMode && (
              <div className="absolute left-4 top-4 z-10">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg p-1 flex flex-col gap-1 shadow-lg border border-gray-200">
                  {(Object.keys(mapStyles) as MapStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => handleStyleChange(style)}
                      className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${
                        activeStyle === style
                          ? "bg-primary text-white"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      {mapStyles[style].name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
              <button
                onClick={handleZoomIn}
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                onClick={handleFullscreen}
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Fullscreen"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleResetNorth}
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Reset North"
              >
                <Compass className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Controls */}
            <div className="absolute left-4 bottom-20 flex flex-col gap-2 z-10">
              {/* Route Button */}
              <button
                onClick={toggleRoutingMode}
                className={`p-2.5 backdrop-blur-sm rounded-lg shadow-lg transition-all border ${
                  isRoutingMode 
                    ? "bg-primary text-white border-primary" 
                    : "bg-white/95 border-gray-200 hover:bg-primary hover:text-white"
                }`}
                title="Route Planner"
              >
                <Route className="w-5 h-5" />
              </button>
              <button
                onClick={handleLocateUser}
                disabled={isLocating}
                className={`p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg transition-all border border-gray-200 ${
                  isLocating ? "bg-blue-50" : "hover:bg-primary hover:text-white"
                }`}
                title="My Location"
              >
                {isLocating ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <LocateFixed className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleResetView}
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Reset to Pakistan"
              >
                <Navigation className="w-5 h-5" />
              </button>
              <button
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Layers"
              >
                <Layers className="w-5 h-5" />
              </button>
            </div>

            {/* Location Error Toast */}
            {locationError && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
                  {locationError}
                </div>
              </div>
            )}

            {/* Coordinates Display */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-gray-200">
                <span className="text-xs text-gray-600 font-mono">
                  {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
                </span>
              </div>
            </div>
          </div>

          {/* Map Footer */}
          <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>© OpenStreetMap contributors | CARTO Basemaps | OSRM Routing</span>
            <span>Powered by MapLibre GL JS</span>
          </div>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-card border border-border">
            <Route className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              Click the <strong className="text-foreground">Route</strong> button, then click on the map or city markers to set start (A) and end (B) points
            </span>
          </div>
        </motion.div>
      </div>

      {/* Custom styles */}
      <style>{`
        .city-marker .animate-ping {
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .maplibregl-ctrl-logo {
          display: none !important;
        }
      `}</style>
    </section>
  );
};

export default MapViewer;
