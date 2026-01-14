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
  Volume2,
  VolumeX,
  ChevronRight,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCw,
  CircleDot,
  Flag,
  List,
  ChevronDown,
  ChevronUp,
  Search,
  Building,
  Mountain,
  MapPinned,
  Landmark,
  RadioTower,
  Target,
  Activity,
  Hospital,
  GraduationCap,
  Fuel,
  Utensils,
  Filter,
  Eye,
  EyeOff,
  PenTool,
  Square,
  Trash2,
  TrendingUp,
  CloudSun,
} from "lucide-react";
import ElevationProfile from "./ElevationProfile";
import WeatherOverlay, { WeatherData } from "./WeatherOverlay";

// Search result interface
interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  importance: number;
}

type MapStyle = "streets" | "satellite" | "terrain";
type TravelMode = "driving" | "cycling" | "walking";
type POICategory = "hospital" | "school" | "fuel" | "restaurant";

interface POI {
  id: number;
  type: POICategory;
  name: string;
  lat: number;
  lon: number;
}

const poiCategories: Record<POICategory, { name: string; icon: typeof Hospital; color: string; query: string }> = {
  hospital: { name: "Hospitals", icon: Hospital, color: "#ef4444", query: "amenity=hospital" },
  school: { name: "Schools", icon: GraduationCap, color: "#3b82f6", query: "amenity=school" },
  fuel: { name: "Fuel Stations", icon: Fuel, color: "#f59e0b", query: "amenity=fuel" },
  restaurant: { name: "Restaurants", icon: Utensils, color: "#22c55e", query: "amenity=restaurant" },
};

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

// Navigation step interface
interface NavigationStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
  name: string;
}

interface RoutePoint {
  lngLat: [number, number];
  name?: string;
}

interface RouteInfo {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: GeoJSON.LineString;
  steps: NavigationStep[];
}

// Get icon for maneuver type
const getManeuverIcon = (type: string, modifier?: string) => {
  switch (type) {
    case "turn":
      if (modifier?.includes("left")) return ArrowLeft;
      if (modifier?.includes("right")) return ArrowRight;
      return ArrowUp;
    case "new name":
    case "continue":
      return ArrowUp;
    case "merge":
    case "on ramp":
    case "off ramp":
      if (modifier?.includes("left")) return CornerUpLeft;
      if (modifier?.includes("right")) return CornerUpRight;
      return ArrowUp;
    case "fork":
      if (modifier?.includes("left")) return CornerUpLeft;
      if (modifier?.includes("right")) return CornerUpRight;
      return ArrowUp;
    case "end of road":
      if (modifier?.includes("left")) return ArrowLeft;
      if (modifier?.includes("right")) return ArrowRight;
      return ArrowUp;
    case "roundabout":
    case "rotary":
      return RotateCw;
    case "depart":
      return CircleDot;
    case "arrive":
      return Flag;
    default:
      return ChevronRight;
  }
};

// Voice guidance class
class VoiceGuidance {
  private synth: SpeechSynthesis;
  private enabled: boolean = true;
  private speaking: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speak(text: string) {
    if (!this.enabled || this.speaking) return;
    
    // Cancel any ongoing speech
    this.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to find a good English voice
    const voices = this.synth.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.onstart = () => { this.speaking = true; };
    utterance.onend = () => { this.speaking = false; };
    utterance.onerror = () => { this.speaking = false; };
    
    this.synth.speak(utterance);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.synth.cancel();
    }
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  stop() {
    this.synth.cancel();
    this.speaking = false;
  }
}

const MapViewer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const startMarker = useRef<maplibregl.Marker | null>(null);
  const endMarker = useRef<maplibregl.Marker | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const voiceGuidance = useRef<VoiceGuidance | null>(null);

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
  
  // Navigation state
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showSteps, setShowSteps] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // GPS Tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number; heading?: number; speed?: number } | null>(null);
  const [distanceToNextStep, setDistanceToNextStep] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);

  // Traffic layer state
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [trafficLoading, setTrafficLoading] = useState(false);

  // POI layer state
  const [showPOIPanel, setShowPOIPanel] = useState(false);
  const [activePOICategories, setActivePOICategories] = useState<Set<POICategory>>(new Set());
  const [pois, setPois] = useState<POI[]>([]);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);
  const poiMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Measurement state
  type MeasureMode = "none" | "distance" | "area";
  const [measureMode, setMeasureMode] = useState<MeasureMode>("none");
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureResult, setMeasureResult] = useState<{ distance?: number; area?: number } | null>(null);
  const measureMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Elevation profile state
  interface ElevationPoint {
    distance: number;
    elevation: number;
  }
  const [showElevationProfile, setShowElevationProfile] = useState(false);
  const [elevationData, setElevationData] = useState<ElevationPoint[]>([]);
  const [isLoadingElevation, setIsLoadingElevation] = useState(false);

  // Weather overlay state
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedWeatherIndex, setSelectedWeatherIndex] = useState(0);
  const weatherMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize voice guidance
  useEffect(() => {
    voiceGuidance.current = new VoiceGuidance();
    return () => {
      voiceGuidance.current?.stop();
    };
  }, []);

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
      // Add traffic layer sources (hidden by default)
      addTrafficLayerSources();
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
      // Added steps=true to get turn-by-turn instructions
      const url = `https://router.project-osrm.org/route/v1/${profile}/${startPoint.lngLat[0]},${startPoint.lngLat[1]};${endPoint.lngLat[0]},${endPoint.lngLat[1]}?overview=full&geometries=geojson&steps=true`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === "Ok" && data.routes.length > 0) {
        const route = data.routes[0];
        const geometry = route.geometry as GeoJSON.LineString;
        
        // Extract navigation steps from legs
        const steps: NavigationStep[] = [];
        if (route.legs && route.legs.length > 0) {
          route.legs.forEach((leg: any) => {
            if (leg.steps) {
              leg.steps.forEach((step: any) => {
                steps.push({
                  instruction: step.maneuver?.instruction || formatManeuver(step.maneuver?.type, step.maneuver?.modifier, step.name),
                  distance: step.distance,
                  duration: step.duration,
                  maneuver: {
                    type: step.maneuver?.type || 'continue',
                    modifier: step.maneuver?.modifier,
                    location: step.maneuver?.location,
                  },
                  name: step.name || 'Unnamed road',
                });
              });
            }
          });
        }

        const routeData: RouteInfo = {
          distance: route.distance,
          duration: route.duration,
          geometry,
          steps,
        };

        setRouteInfo(routeData);

        // Draw route on map
        drawRoute(geometry);

        // Fit map to route
        const coordinates = geometry.coordinates as [number, number][];
        const bounds = coordinates.reduce(
          (bounds, coord) => bounds.extend(coord as maplibregl.LngLatLike),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
        );
        map.current.fitBounds(bounds, { padding: 80, duration: 1000 });

        // Announce first step with voice
        if (steps.length > 0 && voiceGuidance.current?.isEnabled()) {
          voiceGuidance.current.speak(`Route calculated. ${formatDistance(route.distance)} total. First, ${steps[0].instruction}`);
        }
      }
    } catch (error) {
      console.error("Routing error:", error);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Format maneuver to readable instruction
  const formatManeuver = (type?: string, modifier?: string, name?: string): string => {
    const roadName = name ? ` onto ${name}` : '';
    
    switch (type) {
      case 'depart':
        return `Start${roadName}`;
      case 'arrive':
        return 'You have arrived at your destination';
      case 'turn':
        return `Turn ${modifier || 'slightly'}${roadName}`;
      case 'continue':
      case 'new name':
        return `Continue${roadName}`;
      case 'merge':
        return `Merge ${modifier || ''}${roadName}`;
      case 'on ramp':
        return `Take the ramp ${modifier || ''}${roadName}`;
      case 'off ramp':
        return `Take the exit${roadName}`;
      case 'fork':
        return `Keep ${modifier || 'straight'}${roadName}`;
      case 'end of road':
        return `Turn ${modifier || 'left'}${roadName}`;
      case 'roundabout':
      case 'rotary':
        return `Enter the roundabout${roadName}`;
      default:
        return `Continue${roadName}`;
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

  // Traffic layer data - simulated congestion for major Pakistan highways
  const trafficSegments = [
    // Islamabad-Lahore Motorway (M2)
    { coordinates: [[73.0479, 33.6844], [73.2, 33.4], [73.5, 33.0], [73.8, 32.5], [74.0, 32.2], [74.3587, 31.5204]], congestion: "moderate" },
    // Lahore-Faisalabad
    { coordinates: [[74.3587, 31.5204], [73.8, 31.4], [73.135, 31.4504]], congestion: "heavy" },
    // Karachi-Hyderabad
    { coordinates: [[67.0011, 24.8607], [67.5, 25.2], [68.3, 25.3]], congestion: "light" },
    // Islamabad-Peshawar (M1)
    { coordinates: [[73.0479, 33.6844], [72.5, 33.8], [72.0, 34.0], [71.5249, 34.0151]], congestion: "moderate" },
    // Lahore-Multan (M4)
    { coordinates: [[74.3587, 31.5204], [73.8, 31.0], [73.0, 30.5], [71.5249, 30.1575]], congestion: "light" },
    // Karachi Port Roads
    { coordinates: [[66.9, 24.8], [67.0011, 24.8607], [67.1, 24.9]], congestion: "heavy" },
    // Rawalpindi-Islamabad
    { coordinates: [[73.0169, 33.5651], [73.03, 33.62], [73.0479, 33.6844]], congestion: "heavy" },
    // Quetta-Chaman
    { coordinates: [[66.9750, 30.1798], [66.5, 30.5], [66.0, 30.8]], congestion: "light" },
    // Faisalabad-Multan
    { coordinates: [[73.135, 31.4504], [72.5, 31.0], [71.5249, 30.1575]], congestion: "moderate" },
    // Peshawar-Swat
    { coordinates: [[71.5249, 34.0151], [72.0, 34.5], [72.3, 35.0]], congestion: "light" },
  ];

  const getCongestionColor = (congestion: string): string => {
    switch (congestion) {
      case "heavy": return "#ef4444"; // Red
      case "moderate": return "#f59e0b"; // Orange/Amber
      case "light": return "#22c55e"; // Green
      default: return "#6b7280"; // Gray
    }
  };

  const addTrafficLayerSources = useCallback(() => {
    if (!map.current) return;

    // Add traffic segments as GeoJSON source
    const trafficFeatures = trafficSegments.map((segment, index) => ({
      type: "Feature" as const,
      properties: {
        id: index,
        congestion: segment.congestion,
        color: getCongestionColor(segment.congestion),
      },
      geometry: {
        type: "LineString" as const,
        coordinates: segment.coordinates,
      },
    }));

    // Check if source already exists
    if (!map.current.getSource("traffic")) {
      map.current.addSource("traffic", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: trafficFeatures,
        },
      });

      // Add traffic layer (hidden by default)
      map.current.addLayer({
        id: "traffic-layer",
        type: "line",
        source: "traffic",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: "none",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 3,
            10, 6,
            15, 10,
          ],
          "line-opacity": 0.8,
        },
      });

      // Add traffic outline for better visibility
      map.current.addLayer({
        id: "traffic-layer-outline",
        type: "line",
        source: "traffic",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 5,
            10, 9,
            15, 14,
          ],
          "line-opacity": 0.5,
        },
      }, "traffic-layer");

      // Add animated pulse effect layer for heavy traffic
      map.current.addLayer({
        id: "traffic-pulse",
        type: "line",
        source: "traffic",
        filter: ["==", ["get", "congestion"], "heavy"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: "none",
        },
        paint: {
          "line-color": "#ef4444",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 6,
            10, 12,
            15, 18,
          ],
          "line-opacity": 0.3,
        },
      }, "traffic-layer-outline");
    }
  }, []);

  const toggleTrafficLayer = useCallback(() => {
    if (!map.current) return;

    setTrafficLoading(true);

    // Simulate loading delay for effect
    setTimeout(() => {
      const visibility = showTrafficLayer ? "none" : "visible";
      
      if (map.current?.getLayer("traffic-layer")) {
        map.current.setLayoutProperty("traffic-layer", "visibility", visibility);
      }
      if (map.current?.getLayer("traffic-layer-outline")) {
        map.current.setLayoutProperty("traffic-layer-outline", "visibility", visibility);
      }
      if (map.current?.getLayer("traffic-pulse")) {
        map.current.setLayoutProperty("traffic-pulse", "visibility", visibility);
      }

      setShowTrafficLayer(!showTrafficLayer);
      setTrafficLoading(false);
    }, 500);
  }, [showTrafficLayer]);

  // Re-add traffic layers after style change
  useEffect(() => {
    if (!map.current) return;
    
    const handleStyleData = () => {
      addTrafficLayerSources();
      if (showTrafficLayer) {
        setTimeout(() => {
          if (map.current?.getLayer("traffic-layer")) {
            map.current.setLayoutProperty("traffic-layer", "visibility", "visible");
          }
          if (map.current?.getLayer("traffic-layer-outline")) {
            map.current.setLayoutProperty("traffic-layer-outline", "visibility", "visible");
          }
          if (map.current?.getLayer("traffic-pulse")) {
            map.current.setLayoutProperty("traffic-pulse", "visibility", "visible");
          }
        }, 100);
      }
    };

    map.current.on("styledata", handleStyleData);
    return () => {
      map.current?.off("styledata", handleStyleData);
    };
  }, [showTrafficLayer, addTrafficLayerSources]);

  // Fetch POIs from Overpass API
  const fetchPOIs = useCallback(async (category: POICategory) => {
    if (!map.current) return [];

    const bounds = map.current.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    
    const query = `
      [out:json][timeout:25];
      (
        node[${poiCategories[category].query}](${bbox});
        way[${poiCategories[category].query}](${bbox});
      );
      out center 50;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = await response.json();
      
      return data.elements.map((element: any) => ({
        id: element.id,
        type: category,
        name: element.tags?.name || `Unnamed ${poiCategories[category].name.slice(0, -1)}`,
        lat: element.lat || element.center?.lat,
        lon: element.lon || element.center?.lon,
      })).filter((poi: POI) => poi.lat && poi.lon);
    } catch (error) {
      console.error(`Error fetching ${category} POIs:`, error);
      return [];
    }
  }, []);

  // Toggle POI category
  const togglePOICategory = useCallback(async (category: POICategory) => {
    const newCategories = new Set(activePOICategories);
    
    if (newCategories.has(category)) {
      // Remove category
      newCategories.delete(category);
      setActivePOICategories(newCategories);
      
      // Remove markers for this category
      const remainingPois = pois.filter(poi => poi.type !== category);
      setPois(remainingPois);
    } else {
      // Add category
      newCategories.add(category);
      setActivePOICategories(newCategories);
      
      setIsLoadingPOIs(true);
      const newPOIs = await fetchPOIs(category);
      setPois(prev => [...prev, ...newPOIs]);
      setIsLoadingPOIs(false);
    }
  }, [activePOICategories, pois, fetchPOIs]);

  // Refresh all active POIs
  const refreshPOIs = useCallback(async () => {
    if (activePOICategories.size === 0) return;
    
    setIsLoadingPOIs(true);
    const allPOIs: POI[] = [];
    
    for (const category of activePOICategories) {
      const categoryPOIs = await fetchPOIs(category);
      allPOIs.push(...categoryPOIs);
    }
    
    setPois(allPOIs);
    setIsLoadingPOIs(false);
  }, [activePOICategories, fetchPOIs]);

  // Update POI markers when POIs change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing POI markers
    poiMarkersRef.current.forEach(marker => marker.remove());
    poiMarkersRef.current = [];

    // Add new markers
    pois.forEach(poi => {
      const category = poiCategories[poi.type];
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="relative group cursor-pointer">
          <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white" style="background-color: ${category.color}">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              ${getPOIIconSVG(poi.type)}
            </svg>
          </div>
          <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            <div class="bg-gray-900/90 text-white text-xs px-2 py-1 rounded shadow-lg max-w-[200px] truncate">
              ${poi.name}
            </div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([poi.lon, poi.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <div class="font-semibold text-sm">${poi.name}</div>
              <div class="text-xs text-gray-500 mt-1 capitalize">${poi.type}</div>
            </div>
          `)
        )
        .addTo(map.current!);

      poiMarkersRef.current.push(marker);
    });
  }, [pois]);

  // Helper function to get SVG path for POI icons
  const getPOIIconSVG = (type: POICategory): string => {
    switch (type) {
      case "hospital":
        return '<path d="M8 21h8m-4-9v9m-6-3h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z"/><path d="M9 7h6m-3-3v6"/>';
      case "school":
        return '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>';
      case "fuel":
        return '<path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16m0-16l4 4v10a2 2 0 01-2 2M7 8h4m-2 0v4"/>';
      case "restaurant":
        return '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20m14-18v4a4 4 0 01-4 4h-1v10"/>';
      default:
        return '<circle cx="12" cy="12" r="3"/>';
    }
  };

  // Refresh POIs when map moves (debounced)
  useEffect(() => {
    if (!map.current || activePOICategories.size === 0) return;

    let timeoutId: NodeJS.Timeout;
    
    const handleMoveEnd = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refreshPOIs();
      }, 500);
    };

    map.current.on('moveend', handleMoveEnd);
    
    return () => {
      clearTimeout(timeoutId);
      map.current?.off('moveend', handleMoveEnd);
    };
  }, [activePOICategories, refreshPOIs]);

  // Calculate polygon area using Shoelace formula (in square meters)
  const calculatePolygonArea = useCallback((points: [number, number][]): number => {
    if (points.length < 3) return 0;
    
    // Convert to meters using approximate conversion at the center latitude
    const centerLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    const latToMeters = 111320; // meters per degree latitude
    const lngToMeters = 111320 * Math.cos((centerLat * Math.PI) / 180); // meters per degree longitude
    
    // Convert points to meters
    const metersPoints = points.map(([lng, lat]) => [
      lng * lngToMeters,
      lat * latToMeters
    ]);
    
    // Shoelace formula
    let area = 0;
    for (let i = 0; i < metersPoints.length; i++) {
      const j = (i + 1) % metersPoints.length;
      area += metersPoints[i][0] * metersPoints[j][1];
      area -= metersPoints[j][0] * metersPoints[i][1];
    }
    
    return Math.abs(area) / 2;
  }, []);

  // Calculate total distance of a line (in meters) - inline Haversine calculation
  const calculateLineDistance = useCallback((points: [number, number][]): number => {
    if (points.length < 2) return 0;
    
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };
    
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += haversine(
        points[i][1], points[i][0],
        points[i + 1][1], points[i + 1][0]
      );
    }
    return totalDistance;
  }, []);

  // Toggle measurement mode
  const toggleMeasureMode = useCallback((mode: MeasureMode) => {
    if (measureMode === mode) {
      // Turn off measurement
      setMeasureMode("none");
      clearMeasurement();
    } else {
      // Switch to new mode
      setMeasureMode(mode);
      clearMeasurement();
    }
  }, [measureMode]);

  // Clear measurement
  const clearMeasurement = useCallback(() => {
    setMeasurePoints([]);
    setMeasureResult(null);
    
    // Remove markers
    measureMarkersRef.current.forEach(marker => marker.remove());
    measureMarkersRef.current = [];
    
    // Remove map layers/sources
    if (map.current) {
      if (map.current.getLayer("measure-line")) {
        map.current.removeLayer("measure-line");
      }
      if (map.current.getLayer("measure-fill")) {
        map.current.removeLayer("measure-fill");
      }
      if (map.current.getSource("measure-geojson")) {
        map.current.removeSource("measure-geojson");
      }
    }
  }, []);

  // Update measurement visualization
  const updateMeasurementVisualization = useCallback((points: [number, number][]) => {
    if (!map.current || points.length === 0) return;

    const geojsonData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: []
    };

    if (measureMode === "distance" && points.length >= 2) {
      geojsonData.features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: points
        }
      });
    } else if (measureMode === "area" && points.length >= 3) {
      geojsonData.features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[...points, points[0]]]
        }
      });
    }

    if (!map.current.getSource("measure-geojson")) {
      map.current.addSource("measure-geojson", {
        type: "geojson",
        data: geojsonData
      });

      // Add fill layer for area
      map.current.addLayer({
        id: "measure-fill",
        type: "fill",
        source: "measure-geojson",
        paint: {
          "fill-color": "#8b5cf6",
          "fill-opacity": 0.2
        }
      });

      // Add line layer
      map.current.addLayer({
        id: "measure-line",
        type: "line",
        source: "measure-geojson",
        paint: {
          "line-color": "#8b5cf6",
          "line-width": 3,
          "line-dasharray": [2, 1]
        }
      });
    } else {
      (map.current.getSource("measure-geojson") as maplibregl.GeoJSONSource).setData(geojsonData);
    }
  }, [measureMode]);

  // Handle map click for measurement
  useEffect(() => {
    if (!map.current || measureMode === "none") return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      setMeasurePoints(prev => {
        const newPoints = [...prev, point];
        
        // Add marker for the point
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="w-4 h-4 bg-purple-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <span class="text-[8px] text-white font-bold">${newPoints.length}</span>
          </div>
        `;
        
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(point)
          .addTo(map.current!);
        
        measureMarkersRef.current.push(marker);
        
        // Calculate result
        if (measureMode === "distance" && newPoints.length >= 2) {
          setMeasureResult({ distance: calculateLineDistance(newPoints) });
        } else if (measureMode === "area" && newPoints.length >= 3) {
          setMeasureResult({ area: calculatePolygonArea(newPoints) });
        }
        
        // Update visualization
        updateMeasurementVisualization(newPoints);
        
        return newPoints;
      });
    };

    map.current.on("click", handleClick);

    return () => {
      map.current?.off("click", handleClick);
    };
  }, [measureMode, calculateLineDistance, calculatePolygonArea, updateMeasurementVisualization]);

  // Format area for display
  const formatArea = (sqMeters: number): string => {
    if (sqMeters >= 1000000) {
      return `${(sqMeters / 1000000).toFixed(2)} km²`;
    } else if (sqMeters >= 10000) {
      return `${(sqMeters / 10000).toFixed(2)} ha`;
    }
    return `${sqMeters.toFixed(0)} m²`;
  };

  // Fetch elevation data for route
  const fetchElevationData = useCallback(async (coordinates: [number, number][]) => {
    if (coordinates.length < 2) return;

    setIsLoadingElevation(true);
    setShowElevationProfile(true);

    try {
      // Sample points along the route (max 100 points for API limits)
      const sampleRate = Math.max(1, Math.floor(coordinates.length / 100));
      const sampledCoords = coordinates.filter((_, i) => i % sampleRate === 0);
      
      // Open-Meteo Elevation API
      const latitudes = sampledCoords.map(c => c[1]).join(',');
      const longitudes = sampledCoords.map(c => c[0]).join(',');
      
      const response = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`
      );
      
      const data = await response.json();
      
      if (data.elevation && Array.isArray(data.elevation)) {
        // Calculate cumulative distance for each point
        let cumulativeDistance = 0;
        const elevationPoints: ElevationPoint[] = data.elevation.map((elevation: number, index: number) => {
          if (index > 0) {
            const prevCoord = sampledCoords[index - 1];
            const currCoord = sampledCoords[index];
            // Haversine formula for distance
            const R = 6371; // km
            const dLat = ((currCoord[1] - prevCoord[1]) * Math.PI) / 180;
            const dLon = ((currCoord[0] - prevCoord[0]) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((prevCoord[1] * Math.PI) / 180) *
                Math.cos((currCoord[1] * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            cumulativeDistance += R * c;
          }
          return {
            distance: cumulativeDistance,
            elevation: elevation,
          };
        });
        
        setElevationData(elevationPoints);
      }
    } catch (error) {
      console.error("Error fetching elevation data:", error);
      setElevationData([]);
    } finally {
      setIsLoadingElevation(false);
    }
  }, []);

  // Toggle elevation profile visibility
  const toggleElevationProfile = useCallback(() => {
    if (showElevationProfile) {
      setShowElevationProfile(false);
    } else if (routeInfo && routeInfo.geometry.coordinates.length > 0) {
      fetchElevationData(routeInfo.geometry.coordinates as [number, number][]);
    }
  }, [showElevationProfile, routeInfo, fetchElevationData]);

  // Fetch weather data for route points
  const fetchWeatherData = useCallback(async (coordinates: [number, number][]) => {
    if (coordinates.length < 2) return;

    setIsLoadingWeather(true);
    setShowWeatherOverlay(true);

    try {
      // Sample 3-5 points along the route (start, middle points, end)
      const numPoints = Math.min(5, Math.max(3, Math.floor(coordinates.length / 20)));
      const step = Math.floor(coordinates.length / (numPoints - 1));
      const samplePoints = Array.from({ length: numPoints }, (_, i) => 
        i === numPoints - 1 ? coordinates[coordinates.length - 1] : coordinates[i * step]
      );

      const weatherPromises = samplePoints.map(async (coord, index): Promise<WeatherData> => {
        const [lng, lat] = coord;
        
        // Fetch current and hourly weather from Open-Meteo
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,visibility,pressure_msl&hourly=temperature_2m,weather_code,precipitation_probability&timezone=auto&forecast_days=1`
        );
        
        const data = await response.json();
        
        // Get location name via reverse geocoding
        let locationName = `Point ${index + 1}`;
        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
          );
          const geoData = await geoResponse.json();
          locationName = geoData.address?.city || geoData.address?.town || 
                        geoData.address?.village || geoData.address?.county || 
                        `Point ${index + 1}`;
        } catch {
          // Keep default name
        }

        return {
          location: index === 0 ? `Start: ${locationName}` : 
                   index === numPoints - 1 ? `End: ${locationName}` : 
                   locationName,
          coordinates: coord,
          current: {
            temperature: data.current?.temperature_2m || 0,
            weatherCode: data.current?.weather_code || 0,
            windSpeed: data.current?.wind_speed_10m || 0,
            humidity: data.current?.relative_humidity_2m || 0,
            visibility: data.current?.visibility || 10000,
            pressure: data.current?.pressure_msl || 1013,
          },
          hourly: (data.hourly?.time || []).map((time: string, i: number) => ({
            time,
            temperature: data.hourly?.temperature_2m?.[i] || 0,
            weatherCode: data.hourly?.weather_code?.[i] || 0,
            precipitationProbability: data.hourly?.precipitation_probability?.[i] || 0,
          })),
        };
      });

      const results = await Promise.all(weatherPromises);
      setWeatherData(results);
      setSelectedWeatherIndex(0);

      // Add weather markers to map
      addWeatherMarkers(results);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      setWeatherData([]);
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  // Add weather markers to map
  const addWeatherMarkers = useCallback((weather: WeatherData[]) => {
    if (!map.current) return;

    // Clear existing markers
    weatherMarkersRef.current.forEach(marker => marker.remove());
    weatherMarkersRef.current = [];

    weather.forEach((data, index) => {
      const el = document.createElement("div");
      const temp = Math.round(data.current.temperature);
      const code = data.current.weatherCode;
      
      // Get weather icon SVG
      let iconSvg = "☀️";
      if (code >= 1 && code <= 3) iconSvg = "⛅";
      else if (code >= 45 && code <= 48) iconSvg = "🌫️";
      else if (code >= 51 && code <= 67) iconSvg = "🌧️";
      else if (code >= 71 && code <= 77) iconSvg = "❄️";
      else if (code >= 80 && code <= 86) iconSvg = "🌧️";
      else if (code >= 95) iconSvg = "⛈️";

      el.innerHTML = `
        <div class="flex flex-col items-center cursor-pointer transform hover:scale-110 transition-transform">
          <div class="bg-white rounded-lg shadow-lg px-2 py-1 border border-gray-200">
            <div class="text-lg">${iconSvg}</div>
            <div class="text-xs font-bold text-gray-800">${temp}°</div>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1))"></div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(data.coordinates)
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2 min-w-[150px]">
              <div class="font-semibold text-sm mb-1">${data.location}</div>
              <div class="text-2xl font-bold">${temp}°C</div>
              <div class="text-xs text-gray-500 mt-1">
                Wind: ${data.current.windSpeed} km/h<br/>
                Humidity: ${data.current.humidity}%
              </div>
            </div>
          `)
        )
        .addTo(map.current!);

      el.addEventListener("click", () => setSelectedWeatherIndex(index));
      weatherMarkersRef.current.push(marker);
    });
  }, []);

  // Toggle weather overlay
  const toggleWeatherOverlay = useCallback(() => {
    if (showWeatherOverlay) {
      setShowWeatherOverlay(false);
      weatherMarkersRef.current.forEach(marker => marker.remove());
      weatherMarkersRef.current = [];
    } else if (routeInfo && routeInfo.geometry.coordinates.length > 0) {
      fetchWeatherData(routeInfo.geometry.coordinates as [number, number][]);
    }
  }, [showWeatherOverlay, routeInfo, fetchWeatherData]);

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
    setShowSteps(false);
    setCurrentStepIndex(0);
    voiceGuidance.current?.stop();
    
    // Clear elevation data
    setShowElevationProfile(false);
    setElevationData([]);

    // Clear weather data
    setShowWeatherOverlay(false);
    setWeatherData([]);
    weatherMarkersRef.current.forEach(marker => marker.remove());
    weatherMarkersRef.current = [];
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

  const toggleVoice = () => {
    if (voiceGuidance.current) {
      const enabled = voiceGuidance.current.toggle();
      setVoiceEnabled(enabled);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, []);

  // Find closest step to user location
  const findClosestStep = useCallback((userLat: number, userLng: number): { index: number; distance: number } | null => {
    if (!routeInfo || routeInfo.steps.length === 0) return null;

    let closestIndex = 0;
    let closestDistance = Infinity;

    routeInfo.steps.forEach((step, index) => {
      if (step.maneuver.location) {
        const distance = calculateDistance(
          userLat, userLng,
          step.maneuver.location[1], step.maneuver.location[0]
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }
    });

    return { index: closestIndex, distance: closestDistance };
  }, [routeInfo, calculateDistance]);

  // Update user marker with heading indicator
  const updateUserMarkerWithHeading = useCallback((lngLat: [number, number], heading?: number) => {
    if (!map.current) return;

    // Remove existing marker
    if (userMarker.current) {
      userMarker.current.remove();
    }

    const el = document.createElement("div");
    el.innerHTML = `
      <div class="relative" style="transform: rotate(${heading || 0}deg);">
        <div class="absolute -inset-4 bg-blue-500/20 rounded-full animate-pulse"></div>
        ${heading !== undefined ? `
          <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-blue-500"></div>
        ` : ''}
        <div class="relative w-6 h-6 bg-blue-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>
      </div>
    `;

    userMarker.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
      .setLngLat(lngLat)
      .addTo(map.current);
  }, []);

  // Start real-time GPS tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported");
      return;
    }

    setIsTracking(true);
    setLocationError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude, heading, speed } = position.coords;
        
        setUserLocation({
          lng: longitude,
          lat: latitude,
          heading: heading ?? undefined,
          speed: speed ?? undefined,
        });

        // Update marker with heading
        updateUserMarkerWithHeading([longitude, latitude], heading ?? undefined);

        // Follow user if in follow mode
        if (map.current && isFollowMode) {
          map.current.easeTo({
            center: [longitude, latitude],
            zoom: Math.max(map.current.getZoom(), 15),
            bearing: heading ?? map.current.getBearing(),
            duration: 500,
          });
        }

        // Update navigation step if we have a route
        if (routeInfo && routeInfo.steps.length > 0) {
          const closest = findClosestStep(latitude, longitude);
          
          if (closest) {
            setDistanceToNextStep(closest.distance);

            // Check if user has passed the current step and moved to the next
            if (closest.index > currentStepIndex && closest.index < routeInfo.steps.length) {
              setCurrentStepIndex(closest.index);
            }

            // Announce upcoming step when within 100m and not already announced
            if (closest.distance < 100 && closest.index !== lastAnnouncedStepRef.current) {
              const step = routeInfo.steps[closest.index];
              if (voiceGuidance.current?.isEnabled() && step) {
                voiceGuidance.current.speak(`In ${Math.round(closest.distance)} meters, ${step.instruction}`);
                lastAnnouncedStepRef.current = closest.index;
              }
            }

            // Announce when very close (within 30m) to maneuver point
            if (closest.distance < 30 && closest.index === currentStepIndex) {
              const step = routeInfo.steps[closest.index];
              if (voiceGuidance.current?.isEnabled() && step) {
                voiceGuidance.current.speak(step.instruction);
              }
            }

            // Check if arrived at destination
            if (closest.index === routeInfo.steps.length - 1 && closest.distance < 50) {
              if (voiceGuidance.current?.isEnabled()) {
                voiceGuidance.current.speak("You have arrived at your destination");
              }
            }
          }
        }
      },
      (error) => {
        setLocationError(error.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000, // Update every second
      }
    );
  }, [isFollowMode, routeInfo, currentStepIndex, findClosestStep, updateUserMarkerWithHeading]);

  // Stop GPS tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setUserLocation(null);
    setDistanceToNextStep(null);
  }, []);

  // Toggle tracking
  const toggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  // Search functionality with Nominatim API
  const searchPlaces = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);

    try {
      // Use Nominatim API with Pakistan bias
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pk&limit=8&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
        },
      });
      
      const data: SearchResult[] = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 300);
  }, [searchPlaces]);

  // Handle search result selection
  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    if (!map.current) return;

    const lng = parseFloat(result.lon);
    const lat = parseFloat(result.lat);

    // If in routing mode, use the result as a route point
    if (isRoutingMode && selectingPoint) {
      const point: RoutePoint = {
        lngLat: [lng, lat],
        name: result.display_name.split(',')[0],
      };

      if (selectingPoint === "start") {
        setStartPoint(point);
        setSelectingPoint("end");
      } else {
        setEndPoint(point);
        setSelectingPoint(null);
      }
    } else {
      // Otherwise, just fly to the location and add a temporary marker
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1500,
      });

      // Add a temporary search result marker
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="relative animate-bounce">
          <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45"></div>
        </div>
      `;
      
      const searchMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="p-2">
              <div class="font-semibold text-sm">${result.display_name.split(',')[0]}</div>
              <div class="text-xs text-gray-500 mt-1">${result.display_name}</div>
            </div>
          `)
        )
        .addTo(map.current);

      searchMarker.togglePopup();

      // Remove marker after 30 seconds
      setTimeout(() => {
        searchMarker.remove();
      }, 30000);
    }

    // Clear search
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  }, [isRoutingMode, selectingPoint]);

  // Get icon for place type
  const getPlaceIcon = (type: string, placeClass: string) => {
    if (placeClass === "building" || type === "house") return Building;
    if (placeClass === "natural" || type === "peak") return Mountain;
    if (placeClass === "tourism" || type === "attraction") return Landmark;
    return MapPinned;
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        const resultsPanel = document.getElementById('search-results-panel');
        if (resultsPanel && !resultsPanel.contains(e.target as Node)) {
          setShowSearchResults(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const speakStep = (step: NavigationStep) => {
    if (voiceGuidance.current?.isEnabled()) {
      voiceGuidance.current.speak(`${step.instruction}. ${formatDistance(step.distance)}`);
    }
  };

  const goToStep = (index: number, step: NavigationStep) => {
    setCurrentStepIndex(index);
    speakStep(step);
    
    // Pan map to step location
    if (map.current && step.maneuver.location) {
      map.current.flyTo({
        center: step.maneuver.location as maplibregl.LngLatLike,
        zoom: 15,
        duration: 1000,
      });
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

            {/* Search Bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                    placeholder={isRoutingMode && selectingPoint 
                      ? `Search for ${selectingPoint === 'start' ? 'start' : 'destination'} point...`
                      : "Search places, roads, landmarks in Pakistan..."
                    }
                    className="w-full pl-10 pr-10 py-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-gray-400"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 w-5 h-5 text-primary animate-spin" />
                  )}
                  {!isSearching && searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="absolute right-3 p-0.5 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {showSearchResults && searchResults.length > 0 && (
                    <motion.div
                      id="search-results-panel"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 overflow-hidden max-h-80 overflow-y-auto"
                    >
                      {searchResults.map((result) => {
                        const PlaceIcon = getPlaceIcon(result.type, result.class);
                        return (
                          <button
                            key={result.place_id}
                            onClick={() => handleSelectSearchResult(result)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                          >
                            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                              <PlaceIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {result.display_name.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">
                                {result.display_name.split(',').slice(1, 3).join(',')}
                              </div>
                              <div className="text-xs text-primary/70 mt-1 capitalize">
                                {result.type.replace(/_/g, ' ')}
                              </div>
                            </div>
                            {isRoutingMode && selectingPoint && (
                              <div className={`px-2 py-1 text-xs font-medium rounded ${
                                selectingPoint === 'start' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                Set as {selectingPoint === 'start' ? 'A' : 'B'}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* No Results Message */}
                <AnimatePresence>
                  {showSearchResults && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 p-4 text-center"
                    >
                      <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No places found for "{searchQuery}"</p>
                      <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

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
                          <div>
                            {/* Distance & ETA */}
                            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                              <div className="grid grid-cols-2 gap-4 mb-3">
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
                              
                              {/* Voice & Steps Controls */}
                              <div className="flex gap-2">
                                <button
                                  onClick={toggleVoice}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                                    voiceEnabled 
                                      ? "bg-primary text-white" 
                                      : "bg-gray-200 text-gray-600"
                                  }`}
                                  title={voiceEnabled ? "Disable voice" : "Enable voice"}
                                >
                                  {voiceEnabled ? (
                                    <Volume2 className="w-4 h-4" />
                                  ) : (
                                    <VolumeX className="w-4 h-4" />
                                  )}
                                  Voice
                                </button>
                                <button
                                  onClick={() => setShowSteps(!showSteps)}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-all"
                                >
                                  <List className="w-4 h-4" />
                                  {routeInfo.steps.length} Steps
                                  {showSteps ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              {/* Elevation & Weather Buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={toggleElevationProfile}
                                  disabled={isLoadingElevation}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    showElevationProfile 
                                      ? "bg-emerald-500 text-white" 
                                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }`}
                                >
                                  {isLoadingElevation ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <TrendingUp className="w-4 h-4" />
                                  )}
                                  Elevation
                                </button>
                                <button
                                  onClick={toggleWeatherOverlay}
                                  disabled={isLoadingWeather}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    showWeatherOverlay 
                                      ? "bg-sky-500 text-white" 
                                      : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                                  }`}
                                >
                                  {isLoadingWeather ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CloudSun className="w-4 h-4" />
                                  )}
                                  Weather
                                </button>
                              </div>
                            </div>

                            {/* Navigation Steps List */}
                            <AnimatePresence>
                              {showSteps && routeInfo.steps.length > 0 && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="max-h-64 overflow-y-auto border-t border-gray-100"
                                >
                                  {routeInfo.steps.map((step, index) => {
                                    const StepIcon = getManeuverIcon(step.maneuver.type, step.maneuver.modifier);
                                    const isActive = index === currentStepIndex;
                                    
                                    return (
                                      <button
                                        key={index}
                                        onClick={() => goToStep(index, step)}
                                        className={`w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                                          isActive ? "bg-blue-50" : ""
                                        }`}
                                      >
                                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                                          isActive ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                                        }`}>
                                          <StepIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className={`text-sm font-medium ${isActive ? "text-primary" : "text-gray-900"}`}>
                                            {step.instruction}
                                          </div>
                                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                            <span>{formatDistance(step.distance)}</span>
                                            <span>•</span>
                                            <span>{formatDuration(step.duration)}</span>
                                            {step.name && step.name !== 'Unnamed road' && (
                                              <>
                                                <span>•</span>
                                                <span className="truncate">{step.name}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        {isActive && voiceEnabled && (
                                          <Volume2 className="w-4 h-4 text-primary flex-shrink-0 animate-pulse" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
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
              <div className="absolute left-4 top-20 z-10">
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
            <div className="absolute right-4 top-20 flex flex-col gap-2 z-10">
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

              {/* GPS Tracking Toggle */}
              <button
                onClick={toggleTracking}
                className={`p-2.5 backdrop-blur-sm rounded-lg shadow-lg transition-all border ${
                  isTracking 
                    ? "bg-blue-500 text-white border-blue-500" 
                    : "bg-white/95 border-gray-200 hover:bg-blue-500 hover:text-white"
                }`}
                title={isTracking ? "Stop GPS Tracking" : "Start GPS Tracking"}
              >
                {isTracking ? (
                  <RadioTower className="w-5 h-5 animate-pulse" />
                ) : (
                  <LocateFixed className="w-5 h-5" />
                )}
              </button>

              {/* Follow Mode Toggle (only show when tracking) */}
              {isTracking && (
                <button
                  onClick={() => setIsFollowMode(!isFollowMode)}
                  className={`p-2.5 backdrop-blur-sm rounded-lg shadow-lg transition-all border ${
                    isFollowMode 
                      ? "bg-green-500 text-white border-green-500" 
                      : "bg-white/95 border-gray-200 hover:bg-green-500 hover:text-white"
                  }`}
                  title={isFollowMode ? "Disable Auto-Follow" : "Enable Auto-Follow"}
                >
                  <Target className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={handleLocateUser}
                disabled={isLocating || isTracking}
                className={`p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg transition-all border border-gray-200 ${
                  isLocating ? "bg-blue-50" : isTracking ? "opacity-50 cursor-not-allowed" : "hover:bg-primary hover:text-white"
                }`}
                title="Center on My Location"
              >
                {isLocating ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleResetView}
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Reset to Pakistan"
              >
                <Compass className="w-5 h-5" />
              </button>

              {/* Traffic Layer Toggle */}
              <button
                onClick={toggleTrafficLayer}
                disabled={trafficLoading}
                className={`p-2.5 backdrop-blur-sm rounded-lg shadow-lg transition-all border ${
                  showTrafficLayer 
                    ? "bg-amber-500 text-white border-amber-500" 
                    : "bg-white/95 border-gray-200 hover:bg-amber-500 hover:text-white"
                }`}
                title={showTrafficLayer ? "Hide Traffic" : "Show Traffic"}
              >
                {trafficLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Activity className="w-5 h-5" />
                )}
              </button>

              {/* POI Layer Toggle */}
              <button
                onClick={() => setShowPOIPanel(!showPOIPanel)}
                className={`p-2.5 backdrop-blur-sm rounded-lg shadow-lg transition-all border ${
                  showPOIPanel || activePOICategories.size > 0
                    ? "bg-purple-500 text-white border-purple-500" 
                    : "bg-white/95 border-gray-200 hover:bg-purple-500 hover:text-white"
                }`}
                title="Points of Interest"
              >
                {isLoadingPOIs ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
              </button>

              {/* Measurement Tools */}
              <div className="flex flex-col gap-1 p-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
                <button
                  onClick={() => toggleMeasureMode("distance")}
                  className={`p-2 rounded-md transition-all ${
                    measureMode === "distance" 
                      ? "bg-indigo-500 text-white" 
                      : "hover:bg-gray-100"
                  }`}
                  title="Measure Distance"
                >
                  <Ruler className="w-5 h-5" />
                </button>
                <button
                  onClick={() => toggleMeasureMode("area")}
                  className={`p-2 rounded-md transition-all ${
                    measureMode === "area" 
                      ? "bg-indigo-500 text-white" 
                      : "hover:bg-gray-100"
                  }`}
                  title="Measure Area"
                >
                  <Square className="w-5 h-5" />
                </button>
              </div>

              <button
                className="p-2.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg hover:bg-primary hover:text-white transition-all border border-gray-200"
                title="Layers"
              >
                <Layers className="w-5 h-5" />
              </button>
            </div>

            {/* Measurement Panel */}
            <AnimatePresence>
              {measureMode !== "none" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute left-20 bottom-36 z-10"
                >
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3 min-w-[220px]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {measureMode === "distance" ? (
                          <Ruler className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <Square className="w-4 h-4 text-indigo-500" />
                        )}
                        <span className="text-sm font-semibold text-gray-700">
                          {measureMode === "distance" ? "Distance Measurement" : "Area Measurement"}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleMeasureMode("none")}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        {measureMode === "distance" 
                          ? "Click on the map to add points. The total distance will be calculated."
                          : "Click on the map to add at least 3 points to calculate the area."
                        }
                      </p>
                      
                      {measurePoints.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <PenTool className="w-3 h-3" />
                          <span>{measurePoints.length} point{measurePoints.length !== 1 ? 's' : ''} placed</span>
                        </div>
                      )}

                      {measureResult && (
                        <div className="p-3 bg-indigo-50 rounded-lg">
                          <div className="text-xs text-indigo-600 font-medium mb-1">
                            {measureMode === "distance" ? "Total Distance" : "Total Area"}
                          </div>
                          <div className="text-xl font-bold text-indigo-700">
                            {measureMode === "distance" && measureResult.distance !== undefined
                              ? formatDistance(measureResult.distance)
                              : measureResult.area !== undefined
                              ? formatArea(measureResult.area)
                              : "-"
                            }
                          </div>
                        </div>
                      )}

                      {measurePoints.length > 0 && (
                        <button
                          onClick={clearMeasurement}
                          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear Measurement
                        </button>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400">Click map to add measurement points</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* POI Filter Panel */}
            <AnimatePresence>
              {showPOIPanel && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute left-20 bottom-20 z-10"
                >
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3 min-w-[200px]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-semibold text-gray-700">Points of Interest</span>
                      </div>
                      <button
                        onClick={() => setShowPOIPanel(false)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {(Object.entries(poiCategories) as [POICategory, typeof poiCategories[POICategory]][]).map(([key, category]) => {
                        const Icon = category.icon;
                        const isActive = activePOICategories.has(key);
                        
                        return (
                          <button
                            key={key}
                            onClick={() => togglePOICategory(key)}
                            disabled={isLoadingPOIs}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                              isActive 
                                ? "bg-gray-100" 
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <div 
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                isActive ? "" : "bg-gray-100"
                              }`}
                              style={{ backgroundColor: isActive ? category.color : undefined }}
                            >
                              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-500"}`} />
                            </div>
                            <span className={`text-sm font-medium ${isActive ? "text-gray-900" : "text-gray-600"}`}>
                              {category.name}
                            </span>
                            <div className="ml-auto">
                              {isActive ? (
                                <Eye className="w-4 h-4 text-gray-400" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-gray-300" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {activePOICategories.size > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{pois.length} places visible</span>
                          <button
                            onClick={() => {
                              setActivePOICategories(new Set());
                              setPois([]);
                            }}
                            className="text-red-500 hover:text-red-600 font-medium"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400">Data from OpenStreetMap</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Traffic Legend */}
            <AnimatePresence>
              {showTrafficLayer && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-4 bottom-48 z-10"
                >
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-semibold text-gray-700">Traffic Conditions</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1.5 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-600">Light Traffic</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-xs text-gray-600">Moderate Traffic</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1.5 rounded-full bg-red-500" />
                        <span className="text-xs text-gray-600">Heavy Traffic</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400">Simulated data for demo</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* GPS Tracking Info Panel */}
            <AnimatePresence>
              {isTracking && userLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute right-4 bottom-20 z-10"
                >
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3 min-w-[180px]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-green-600">GPS Active</span>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Lat:</span>
                        <span className="font-mono">{userLocation.lat.toFixed(5)}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lng:</span>
                        <span className="font-mono">{userLocation.lng.toFixed(5)}°</span>
                      </div>
                      {userLocation.speed !== undefined && userLocation.speed > 0 && (
                        <div className="flex justify-between">
                          <span>Speed:</span>
                          <span className="font-mono">{(userLocation.speed * 3.6).toFixed(1)} km/h</span>
                        </div>
                      )}
                      {userLocation.heading !== undefined && (
                        <div className="flex justify-between">
                          <span>Heading:</span>
                          <span className="font-mono">{Math.round(userLocation.heading)}°</span>
                        </div>
                      )}
                      {distanceToNextStep !== null && routeInfo && (
                        <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                          <span>Next Turn:</span>
                          <span className="font-semibold text-primary">{formatDistance(distanceToNextStep)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => setIsFollowMode(!isFollowMode)}
                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          isFollowMode 
                            ? "bg-green-100 text-green-700" 
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {isFollowMode ? "Following" : "Free Move"}
                      </button>
                      <button
                        onClick={stopTracking}
                        className="px-2 py-1.5 text-xs font-medium bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Elevation Profile */}
            <AnimatePresence>
              {showElevationProfile && routeInfo && (
                <ElevationProfile
                  routeCoordinates={routeInfo.geometry.coordinates as [number, number][]}
                  onClose={() => setShowElevationProfile(false)}
                  isLoading={isLoadingElevation}
                  elevationData={elevationData}
                />
              )}
            </AnimatePresence>

            {/* Weather Overlay */}
            <AnimatePresence>
              {showWeatherOverlay && (
                <WeatherOverlay
                  weatherData={weatherData}
                  onClose={() => {
                    setShowWeatherOverlay(false);
                    weatherMarkersRef.current.forEach(marker => marker.remove());
                    weatherMarkersRef.current = [];
                  }}
                  isLoading={isLoadingWeather}
                  selectedIndex={selectedWeatherIndex}
                  onSelectLocation={setSelectedWeatherIndex}
                />
              )}
            </AnimatePresence>

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
          <div className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-3 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">Search</strong>
              </span>
            </div>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">Route</strong>
              </span>
            </div>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">Elevation</strong>
              </span>
            </div>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-sky-500" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">Weather</strong>
              </span>
            </div>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">POIs</strong>
              </span>
            </div>
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
