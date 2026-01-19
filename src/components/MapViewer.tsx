import { useRef, useState, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, Search, Route, TrendingUp, CloudSun, MapPin } from "lucide-react";
import { toast, Toaster } from "sonner";

// Import components
import MapControls from "./map/MapControls";
import NavigationControls from "./map/NavigationControls";
import LayerPanel from "./map/LayerPanel";
import SearchBar from "./map/SearchBar";
import RoutingPanel from "./map/RoutingPanel";
import POIPanel from "./map/POIPanel";
import MeasurementPanel from "./map/MeasurementPanel";
import ElevationProfile from "./ElevationProfile";
import WeatherOverlay from "./WeatherOverlay";

// Import hooks
import { useMapInitialization } from "./map/hooks/useMapInitialization";
import { useRouting } from "./map/hooks/useRouting";
import { usePOI } from "./map/hooks/usePOI";
import { useMeasurement } from "./map/hooks/useMeasurement";

// Import types and constants
import type { MapStyle, TravelMode, SearchResult } from "./map/types";
import { mapStyles } from "./map/constants";
import { formatDistance } from "./map/utils";

const MapViewer = () => {
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapContainerWrapper = useRef<HTMLDivElement>(null);

  // Map state - Focus on Islamabad
  const [activeStyle, setActiveStyle] = useState<MapStyle>("streets");
  const [zoom, setZoom] = useState(12);
  const [coordinates, setCoordinates] = useState({ lng: 73.0479, lat: 33.6844 }); // Islamabad coordinates
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");

  // UI state
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isFollowMode, setIsFollowMode] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [showPOIPanel, setShowPOIPanel] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showSteps, setShowSteps] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Elevation & Weather state
  const [showElevationProfile, setShowElevationProfile] = useState(false);
  const [elevationData, setElevationData] = useState<any[]>([]);
  const [isLoadingElevation, setIsLoadingElevation] = useState(false);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedWeatherIndex, setSelectedWeatherIndex] = useState(0);

  // Map loading state
  const [isMapLoading, setIsMapLoading] = useState(true);

  // Initialize map with custom hook
  const { map } = useMapInitialization({
    mapContainer,
    activeStyle,
    onMove: (coords, z) => {
      setCoordinates(coords);
      setZoom(z);
    },
    isRoutingMode,
    selectingPoint: null,
    onMapLoad: () => setIsMapLoading(false),
  });

  // Routing hook
  const {
    startPoint,
    endPoint,
    routeInfo,
    isCalculatingRoute,
    selectingPoint,
    alternatives,
    selectedAlternative,
    setStartPoint,
    setEndPoint,
    setSelectingPoint,
    clearRoute,
    handleSelectAlternative,
  } = useRouting({ map, travelMode });

  // POI hook
  const {
    pois,
    activePOICategories,
    isLoadingPOIs,
    togglePOICategory,
    clearAllPOIs,
    updatePOIMarkers,
  } = usePOI({ map });

  // Measurement hook
  const {
    measureMode,
    measurePoints,
    measureResult,
    toggleMeasureMode,
    clearMeasurement,
  } = useMeasurement({ map });

  // Update POI markers when pois change
  useEffect(() => {
    updatePOIMarkers();
  }, [pois, updatePOIMarkers]);

  // Add traffic layer when toggled
  useEffect(() => {
    if (!map) return;

    const addTrafficLayer = () => {
      // Traffic segments data
      const trafficSegments = [
        { coordinates: [[73.0479, 33.6844], [73.2, 33.4], [73.5, 33.0], [73.8, 32.5], [74.0, 32.2], [74.3587, 31.5204]], congestion: "moderate" },
        { coordinates: [[74.3587, 31.5204], [73.8, 31.4], [73.135, 31.4504]], congestion: "heavy" },
        { coordinates: [[67.0011, 24.8607], [67.5, 25.2], [68.3, 25.3]], congestion: "light" },
        { coordinates: [[73.0479, 33.6844], [72.5, 33.8], [72.0, 34.0], [71.5249, 34.0151]], congestion: "moderate" },
        { coordinates: [[74.3587, 31.5204], [73.8, 31.0], [73.0, 30.5], [71.5249, 30.1575]], congestion: "light" },
        { coordinates: [[66.9, 24.8], [67.0011, 24.8607], [67.1, 24.9]], congestion: "heavy" },
        { coordinates: [[73.0169, 33.5651], [73.03, 33.62], [73.0479, 33.6844]], congestion: "heavy" },
        { coordinates: [[66.9750, 30.1798], [66.5, 30.5], [66.0, 30.8]], congestion: "light" },
        { coordinates: [[73.135, 31.4504], [72.5, 31.0], [71.5249, 30.1575]], congestion: "moderate" },
        { coordinates: [[71.5249, 34.0151], [72.0, 34.5], [72.3, 35.0]], congestion: "light" },
      ];

      const getCongestionColor = (congestion: string): string => {
        switch (congestion) {
          case "heavy": return "#ef4444";
          case "moderate": return "#f59e0b";
          case "light": return "#22c55e";
          default: return "#6b7280";
        }
      };

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

      if (!map.getSource("traffic")) {
        map.addSource("traffic", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: trafficFeatures,
          },
        });

        map.addLayer({
          id: "traffic-layer",
          type: "line",
          source: "traffic",
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: showTrafficLayer ? "visible" : "none",
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
      } else {
        map.setLayoutProperty("traffic-layer", "visibility", showTrafficLayer ? "visible" : "none");
      }
    };

    if (map.isStyleLoaded()) {
      addTrafficLayer();
    } else {
      map.once("styledata", addTrafficLayer);
    }
  }, [map, showTrafficLayer]);

  // Handle map click for routing
  useEffect(() => {
    if (!map || !isRoutingMode || !selectingPoint) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      
      if (selectingPoint === "start") {
        setStartPoint({ lngLat });
        setSelectingPoint("end");
      } else if (selectingPoint === "end") {
        setEndPoint({ lngLat });
        setSelectingPoint(null);
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [map, isRoutingMode, selectingPoint, setStartPoint, setEndPoint, setSelectingPoint]);

  // Handlers
  const handleZoomIn = () => map?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map?.zoomOut({ duration: 300 });
  const handleResetNorth = () => map?.easeTo({ bearing: 0, duration: 300 });
  
  const handleFullscreen = () => {
    if (mapContainerWrapper.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        mapContainerWrapper.current.requestFullscreen();
      }
    }
  };

  const handleResetView = () => {
    map?.flyTo({
      center: [73.0479, 33.6844], // Islamabad coordinates
      zoom: 12, // City-level zoom
      pitch: 0,
      bearing: 0,
      duration: 1500,
    });
  };

  const handleStyleChange = (style: MapStyle) => {
    if (!map) return;
    setActiveStyle(style);
    map.setStyle(mapStyles[style].url);
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        
        if (map) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: 14,
            duration: 2000,
          });
        }

        setIsLocating(false);
        toast.success("Location found!", {
          description: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
        });
      },
      (error) => {
        setLocationError(error.message);
        setIsLocating(false);
        toast.error("Failed to get location", {
          description: error.message,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleToggleRouting = () => {
    if (isRoutingMode) {
      setIsRoutingMode(false);
      clearRoute();
      setSelectingPoint(null);
    } else {
      setIsRoutingMode(true);
      setSelectingPoint("start");
    }
  };

  const handleToggleTraffic = () => {
    setTrafficLoading(true);
    setTimeout(() => {
      setShowTrafficLayer(!showTrafficLayer);
      setTrafficLoading(false);
    }, 500);
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    if (!map) return;

    const lng = parseFloat(result.lon);
    const lat = parseFloat(result.lat);

    if (isRoutingMode && selectingPoint) {
      const point = {
        lngLat: [lng, lat] as [number, number],
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
      map.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1500,
      });
    }
  };

  const handleGoToStep = (index: number, step: any) => {
    setCurrentStepIndex(index);
    
    if (map && step.maneuver.location) {
      map.flyTo({
        center: step.maneuver.location as maplibregl.LngLatLike,
        zoom: 15,
        duration: 1000,
      });
    }
  };

  const handleToggleElevation = async () => {
    if (showElevationProfile) {
      setShowElevationProfile(false);
    } else if (routeInfo && routeInfo.geometry.coordinates.length > 0) {
      setIsLoadingElevation(true);
      setShowElevationProfile(true);
      
      try {
        const coordinates = routeInfo.geometry.coordinates as [number, number][];
        const sampleRate = Math.max(1, Math.floor(coordinates.length / 100));
        const sampledCoords = coordinates.filter((_, i) => i % sampleRate === 0);
        
        const latitudes = sampledCoords.map(c => c[1]).join(',');
        const longitudes = sampledCoords.map(c => c[0]).join(',');
        
        const response = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`
        );
        
        const data = await response.json();
        
        if (data.elevation && Array.isArray(data.elevation)) {
          let cumulativeDistance = 0;
          const elevationPoints = data.elevation.map((elevation: number, index: number) => {
            if (index > 0) {
              const prevCoord = sampledCoords[index - 1];
              const currCoord = sampledCoords[index];
              const R = 6371;
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
          toast.success("Elevation profile loaded!");
        }
      } catch (error) {
        console.error("Error fetching elevation data:", error);
        setElevationData([]);
        toast.error("Failed to load elevation data");
      } finally {
        setIsLoadingElevation(false);
      }
    }
  };

  const handleToggleWeather = async () => {
    if (showWeatherOverlay) {
      setShowWeatherOverlay(false);
    } else if (routeInfo && routeInfo.geometry.coordinates.length > 0) {
      setIsLoadingWeather(true);
      setShowWeatherOverlay(true);
      
      try {
        const coordinates = routeInfo.geometry.coordinates as [number, number][];
        const numPoints = Math.min(5, Math.max(3, Math.floor(coordinates.length / 20)));
        const step = Math.floor(coordinates.length / (numPoints - 1));
        const samplePoints = Array.from({ length: numPoints }, (_, i) => 
          i === numPoints - 1 ? coordinates[coordinates.length - 1] : coordinates[i * step]
        );

        const weatherPromises = samplePoints.map(async (coord, index) => {
          const [lng, lat] = coord;
          
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,visibility,pressure_msl&hourly=temperature_2m,weather_code,precipitation_probability&timezone=auto&forecast_days=1`
          );
          
          const data = await response.json();
          
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
        toast.success("Weather data loaded!");
      } catch (error) {
        console.error("Error fetching weather data:", error);
        setWeatherData([]);
        toast.error("Failed to load weather data");
      } finally {
        setIsLoadingWeather(false);
      }
    }
  };

  const handleSaveRoute = () => {
    if (!routeInfo || !startPoint || !endPoint) return;

    const routeName = prompt("Enter a name for this route:");
    if (!routeName) return;

    const savedRoute = {
      name: routeName,
      start: startPoint,
      end: endPoint,
      distance: routeInfo.distance,
      duration: routeInfo.duration,
    };

    const saved = JSON.parse(localStorage.getItem('savedRoutes') || '[]');
    localStorage.setItem('savedRoutes', JSON.stringify([savedRoute, ...saved]));
    
    toast.success("Route saved successfully!", {
      description: `${routeName} - ${formatDistance(routeInfo.distance)}`,
    });
  };

  const handleLoadRoute = (route: any) => {
    setStartPoint(route.start);
    setEndPoint(route.end);
    toast.success("Route loaded!", {
      description: route.name,
    });
  };

  return (
    <div className="h-screen w-screen relative">
      <Toaster position="top-center" richColors />
      
      {/* Map Container */}
      <div
        ref={mapContainerWrapper}
        className="relative h-full w-full bg-card"
      >
        {/* Map Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-navy-deep border-b border-white/10 relative z-50">
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
        <div className="relative h-[calc(100vh-120px)]">
          {/* MapLibre Map */}
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Map Loading Overlay */}
          {isMapLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Loading Map</h3>
                <p className="text-muted-foreground">Initializing Islamabad region...</p>
              </div>
            </div>
          )}

            {/* Search Bar */}
            <SearchBar
              isRoutingMode={isRoutingMode}
              selectingPoint={selectingPoint}
              onSelectResult={handleSelectSearchResult}
            />

            {/* Routing Panel */}
            <RoutingPanel
              show={isRoutingMode}
              travelMode={travelMode}
              startPoint={startPoint}
              endPoint={endPoint}
              selectingPoint={selectingPoint}
              routeInfo={routeInfo}
              isCalculatingRoute={isCalculatingRoute}
              voiceEnabled={voiceEnabled}
              showSteps={showSteps}
              currentStepIndex={currentStepIndex}
              isLoadingElevation={isLoadingElevation}
              showElevationProfile={showElevationProfile}
              isLoadingWeather={isLoadingWeather}
              showWeatherOverlay={showWeatherOverlay}
              alternatives={alternatives}
              selectedAlternative={selectedAlternative}
              onClose={handleToggleRouting}
              onTravelModeChange={setTravelMode}
              onSetStartPoint={() => setSelectingPoint("start")}
              onSetEndPoint={() => setSelectingPoint("end")}
              onClearStartPoint={() => {
                setStartPoint(null);
                setSelectingPoint("start");
              }}
              onClearEndPoint={() => {
                setEndPoint(null);
                setSelectingPoint("end");
              }}
              onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
              onToggleSteps={() => setShowSteps(!showSteps)}
              onGoToStep={handleGoToStep}
              onClearRoute={() => {
                clearRoute();
                setSelectingPoint("start");
              }}
              onToggleElevation={handleToggleElevation}
              onToggleWeather={handleToggleWeather}
              onSelectAlternative={handleSelectAlternative}
              onSaveRoute={handleSaveRoute}
              onLoadRoute={handleLoadRoute}
            />

            {/* Map Controls */}
            <MapControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onFullscreen={handleFullscreen}
              onResetNorth={handleResetNorth}
            />

            {/* Navigation Controls */}
            <NavigationControls
              isRoutingMode={isRoutingMode}
              isTracking={isTracking}
              isFollowMode={isFollowMode}
              isLocating={isLocating}
              showTrafficLayer={showTrafficLayer}
              trafficLoading={trafficLoading}
              showPOIPanel={showPOIPanel}
              isLoadingPOIs={isLoadingPOIs}
              measureMode={measureMode}
              showLayerPanel={showLayerPanel}
              onToggleRouting={handleToggleRouting}
              onToggleTracking={() => setIsTracking(!isTracking)}
              onToggleFollowMode={() => setIsFollowMode(!isFollowMode)}
              onLocateUser={handleLocateUser}
              onResetView={handleResetView}
              onToggleTraffic={handleToggleTraffic}
              onTogglePOI={() => setShowPOIPanel(!showPOIPanel)}
              onToggleMeasure={toggleMeasureMode}
              onToggleLayerPanel={() => setShowLayerPanel(!showLayerPanel)}
            />

            {/* Layer Panel */}
            <LayerPanel
              show={showLayerPanel}
              activeStyle={activeStyle}
              onClose={() => setShowLayerPanel(false)}
              onStyleChange={handleStyleChange}
            />

            {/* POI Panel */}
            <POIPanel
              show={showPOIPanel}
              activePOICategories={activePOICategories}
              poisCount={pois.length}
              onClose={() => setShowPOIPanel(false)}
              onToggleCategory={togglePOICategory}
              onClearAll={clearAllPOIs}
            />

            {/* Measurement Panel */}
            <MeasurementPanel
              show={measureMode !== "none"}
              measureMode={measureMode}
              measurePoints={measurePoints}
              measureResult={measureResult}
              onClose={() => toggleMeasureMode(measureMode as "distance" | "area")}
              onClear={clearMeasurement}
            />

            {/* Elevation Profile */}
            {showElevationProfile && routeInfo && (
              <ElevationProfile
                routeCoordinates={routeInfo.geometry.coordinates as [number, number][]}
                onClose={() => setShowElevationProfile(false)}
                isLoading={isLoadingElevation}
                elevationData={elevationData}
              />
            )}

            {/* Weather Overlay */}
            {showWeatherOverlay && (
              <WeatherOverlay
                weatherData={weatherData}
                onClose={() => setShowWeatherOverlay(false)}
                isLoading={isLoadingWeather}
                selectedIndex={selectedWeatherIndex}
                onSelectLocation={setSelectedWeatherIndex}
              />
            )}

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
          <div className="px-4 py-2 bg-muted/50 border-t border-border flex items-center justify-between text-xs text-muted-foreground relative z-50">
            <span>© OpenStreetMap contributors | CARTO Basemaps | OSRM Routing</span>
            <span>Powered by MapLibre GL JS</span>
          </div>
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
          *:fullscreen {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }
          *:fullscreen > div:nth-child(2) {
            flex: 1 !important;
            height: auto !important;
          }
        `}</style>
      </div>
    );
  };

  export default MapViewer;
