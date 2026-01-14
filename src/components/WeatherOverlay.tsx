import { motion } from "framer-motion";
import { 
  X, 
  Cloud, 
  Sun, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  Wind, 
  Droplets,
  Eye,
  Gauge,
  CloudFog,
  CloudDrizzle,
  Loader2,
} from "lucide-react";

export interface WeatherData {
  location: string;
  coordinates: [number, number];
  current: {
    temperature: number;
    weatherCode: number;
    windSpeed: number;
    humidity: number;
    visibility: number;
    pressure: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    weatherCode: number;
    precipitationProbability: number;
  }>;
}

interface WeatherOverlayProps {
  weatherData: WeatherData[];
  onClose: () => void;
  isLoading?: boolean;
  selectedIndex: number;
  onSelectLocation: (index: number) => void;
}

// Weather code to icon and description mapping
const getWeatherInfo = (code: number): { icon: typeof Sun; description: string; color: string } => {
  // WMO Weather interpretation codes
  if (code === 0) return { icon: Sun, description: "Clear sky", color: "text-yellow-500" };
  if (code === 1 || code === 2 || code === 3) return { icon: Cloud, description: "Partly cloudy", color: "text-gray-500" };
  if (code >= 45 && code <= 48) return { icon: CloudFog, description: "Foggy", color: "text-gray-400" };
  if (code >= 51 && code <= 55) return { icon: CloudDrizzle, description: "Drizzle", color: "text-blue-400" };
  if (code >= 56 && code <= 57) return { icon: CloudDrizzle, description: "Freezing drizzle", color: "text-cyan-400" };
  if (code >= 61 && code <= 65) return { icon: CloudRain, description: "Rain", color: "text-blue-500" };
  if (code >= 66 && code <= 67) return { icon: CloudRain, description: "Freezing rain", color: "text-cyan-500" };
  if (code >= 71 && code <= 77) return { icon: CloudSnow, description: "Snow", color: "text-blue-200" };
  if (code >= 80 && code <= 82) return { icon: CloudRain, description: "Rain showers", color: "text-blue-600" };
  if (code >= 85 && code <= 86) return { icon: CloudSnow, description: "Snow showers", color: "text-blue-300" };
  if (code >= 95 && code <= 99) return { icon: CloudLightning, description: "Thunderstorm", color: "text-purple-500" };
  return { icon: Cloud, description: "Cloudy", color: "text-gray-500" };
};

const WeatherOverlay = ({
  weatherData,
  onClose,
  isLoading = false,
  selectedIndex,
  onSelectLocation,
}: WeatherOverlayProps) => {
  const selectedWeather = weatherData[selectedIndex];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-4 top-20 z-20 w-[320px]"
    >
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-sky-500 to-blue-600">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-white" />
            <span className="font-semibold text-white">Weather Along Route</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-500">Fetching weather data...</span>
              </div>
            </div>
          ) : weatherData.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <span className="text-sm text-gray-500">No weather data available</span>
            </div>
          ) : (
            <>
              {/* Location Tabs */}
              <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                {weatherData.map((weather, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectLocation(index)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedIndex === index
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {weather.location}
                  </button>
                ))}
              </div>

              {selectedWeather && (
                <>
                  {/* Current Weather */}
                  <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">{selectedWeather.location}</div>
                        <div className="text-4xl font-bold text-gray-900">
                          {Math.round(selectedWeather.current.temperature)}°C
                        </div>
                      </div>
                      <div className="text-right">
                        {(() => {
                          const { icon: WeatherIcon, description, color } = getWeatherInfo(selectedWeather.current.weatherCode);
                          return (
                            <>
                              <WeatherIcon className={`w-12 h-12 ${color}`} />
                              <div className="text-xs text-gray-500 mt-1">{description}</div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Weather Details */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                        <Wind className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Wind</div>
                          <div className="text-sm font-medium">{selectedWeather.current.windSpeed} km/h</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <div>
                          <div className="text-xs text-gray-500">Humidity</div>
                          <div className="text-sm font-medium">{selectedWeather.current.humidity}%</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                        <Eye className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Visibility</div>
                          <div className="text-sm font-medium">{(selectedWeather.current.visibility / 1000).toFixed(1)} km</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                        <Gauge className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Pressure</div>
                          <div className="text-sm font-medium">{selectedWeather.current.pressure} hPa</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Forecast */}
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">Hourly Forecast</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedWeather.hourly.slice(0, 8).map((hour, index) => {
                        const { icon: HourIcon, color } = getWeatherInfo(hour.weatherCode);
                        const time = new Date(hour.time).toLocaleTimeString([], { hour: '2-digit' });
                        return (
                          <div
                            key={index}
                            className="flex-shrink-0 flex flex-col items-center gap-1 bg-gray-50 rounded-lg p-2 min-w-[50px]"
                          >
                            <div className="text-[10px] text-gray-500">{time}</div>
                            <HourIcon className={`w-5 h-5 ${color}`} />
                            <div className="text-xs font-medium">{Math.round(hour.temperature)}°</div>
                            <div className="flex items-center gap-0.5">
                              <Droplets className="w-2.5 h-2.5 text-blue-400" />
                              <span className="text-[9px] text-gray-500">{hour.precipitationProbability}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          <span className="text-[10px] text-gray-400">
            Weather data from Open-Meteo API
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherOverlay;
