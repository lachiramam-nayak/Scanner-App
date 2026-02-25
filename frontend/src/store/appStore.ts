import { create } from 'zustand';

export interface Building {
  id: string;
  name: string;
  description?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  name: string;
  width: number;
  height: number;
  scale: number;
  map_image?: string;
  mapImage?: string;
  mapImageUrl?: string;
  created_at: string;
  updated_at: string;
}

export interface Beacon {
  id: string;
  building_id: string;
  floor_id: string;
  uuid: string;
  major: number;
  minor: number;
  x: number;
  y: number;
  label?: string;
  created_at: string;
}

export interface POI {
  id: string;
  building_id: string;
  floor_id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  description?: string;
  created_at: string;
}

export interface UserLocation {
  building_id: string;
  floor_id: string;
  x: number;
  y: number;
  source: 'qr' | 'beacon' | 'mock' | 'sensor';
  timestamp: Date;
}

export interface AppState {
  // Current selections
  selectedBuilding: Building | null;
  selectedFloor: Floor | null;
  selectedDestination: POI | null;

  // User location
  userLocation: UserLocation | null;
  locationMode: 'qr' | 'beacon' | 'mock' | 'sensor' | null;
  navigationRoute: any | null;

  // Beacon scanning state (placeholder)
  isScanning: boolean;

  // Actions
  setSelectedBuilding: (building: Building | null) => void;
  setSelectedFloor: (floor: Floor | null) => void;
  setSelectedDestination: (poi: POI | null) => void;
  setUserLocation: (location: UserLocation | null) => void;
  setLocationMode: (mode: 'qr' | 'beacon' | 'mock' | 'sensor' | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setNavigationRoute: (route: any | null) => void;
  clearLocation: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  selectedBuilding: null,
  selectedFloor: null,
  selectedDestination: null,
  userLocation: null,
  locationMode: null,
  navigationRoute: null,
  isScanning: false,

  // Actions
  setSelectedBuilding: (building) => set({ selectedBuilding: building }),
  setSelectedFloor: (floor) => set({ selectedFloor: floor }),
  setSelectedDestination: (poi) => set({ selectedDestination: poi }),
  setUserLocation: (location) => set({ userLocation: location }),
  setLocationMode: (mode) => set({ locationMode: mode }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),
  setNavigationRoute: (route) => set({ navigationRoute: route }),
  clearLocation: () => set({ userLocation: null, locationMode: null }),
}));
