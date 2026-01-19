import { Car, Bike, Footprints, Hospital, GraduationCap, Fuel, Utensils } from "lucide-react";
import type { MapStyle, TravelMode, POICategory } from "./types";

export const mapStyles: Record<MapStyle, { name: string; url: string }> = {
  streets: {
    name: "Streets",
    url: "https://demotiles.maplibre.org/style.json",
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

export const travelModes: Record<TravelMode, { name: string; icon: typeof Car; profile: string }> = {
  driving: { name: "Drive", icon: Car, profile: "driving" },
  cycling: { name: "Cycle", icon: Bike, profile: "cycling" },
  walking: { name: "Walk", icon: Footprints, profile: "foot" },
};

export const poiCategories: Record<POICategory, { name: string; icon: typeof Hospital; color: string; query: string }> = {
  hospital: { name: "Hospitals", icon: Hospital, color: "#ef4444", query: "amenity=hospital" },
  school: { name: "Schools", icon: GraduationCap, color: "#3b82f6", query: "amenity=school" },
  fuel: { name: "Fuel Stations", icon: Fuel, color: "#f59e0b", query: "amenity=fuel" },
  restaurant: { name: "Restaurants", icon: Utensils, color: "#22c55e", query: "amenity=restaurant" },
};

export const pakistanCities = [
  { name: "Islamabad", coordinates: [73.0479, 33.6844] as [number, number], type: "capital" },
  { name: "Lahore", coordinates: [74.3587, 31.5204] as [number, number], type: "city" },
  { name: "Karachi", coordinates: [67.0011, 24.8607] as [number, number], type: "city" },
  { name: "Peshawar", coordinates: [71.5249, 34.0151] as [number, number], type: "city" },
  { name: "Quetta", coordinates: [66.9750, 30.1798] as [number, number], type: "city" },
  { name: "Faisalabad", coordinates: [73.1350, 31.4504] as [number, number], type: "city" },
  { name: "Multan", coordinates: [71.5249, 30.1575] as [number, number], type: "city" },
  { name: "Rawalpindi", coordinates: [73.0169, 33.5651] as [number, number], type: "city" },
];

export const trafficSegments = [
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

export const getCongestionColor = (congestion: string): string => {
  switch (congestion) {
    case "heavy": return "#ef4444";
    case "moderate": return "#f59e0b";
    case "light": return "#22c55e";
    default: return "#6b7280";
  }
};
