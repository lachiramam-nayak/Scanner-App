import Constants from 'expo-constants';
import { Building, Floor, Beacon, POI } from '../store/appStore';

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  (Constants.manifest as any)?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  '';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || 'Request failed');
  }
  return response.json();
};

// Type definitions for positioning
export interface ScannedBeacon {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  avgRssi?: number;
}

export interface PositionResponse {
  buildingId: string;
  buildingName: string;
  floorId: string;
  floorName: string;
  floorNumber: number;
  x: number;
  y: number;
  method: 'ibeacon' | 'trilateration' | 'weighted' | 'nearest';
  beaconsUsed: number;
  valid: boolean;
  errorMessage: string | null;
}

export interface NavigationRequest {
  buildingId?: string;
  floorId: string;
  startX: number;
  startY: number;
  destX: number;
  destY: number;
}

export interface RoutePoint {
  x: number;
  y: number;
  type: 'start' | 'waypoint' | 'destination';
}

export interface NavigationResponse {
  success: boolean;
  message: string;
  totalDistance: number;
  route: RoutePoint[];
}

// Building APIs
export const buildingApi = {
  getAll: async (): Promise<Building[]> => {
    const response = await fetch(`${API_URL}/api/buildings`);
    return handleResponse(response);
  },

  getById: async (id: string): Promise<Building> => {
    const response = await fetch(`${API_URL}/api/buildings/${id}`);
    return handleResponse(response);
  },

  create: async (data: { name: string; description?: string; address?: string }): Promise<Building> => {
    const response = await fetch(`${API_URL}/api/buildings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: { name?: string; description?: string; address?: string }): Promise<Building> => {
    const response = await fetch(`${API_URL}/api/buildings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/buildings/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// Floor APIs
export const floorApi = {
  getAll: async (buildingId?: string): Promise<Floor[]> => {
    const url = buildingId
      ? `${API_URL}/api/floors?building_id=${buildingId}`
      : `${API_URL}/api/floors`;
    const response = await fetch(url);
    return handleResponse(response);
  },

  getById: async (id: string): Promise<Floor> => {
    const response = await fetch(`${API_URL}/api/floors/${id}`);
    return handleResponse(response);
  },

  create: async (data: {
    building_id?: string;
    buildingId?: string;
    floor_number?: number;
    floorNumber?: number;
    name: string;
    width?: number;
    height?: number;
    scale?: number;
    map_image?: string;
    mapImage?: string;
  }): Promise<Floor> => {
    const payload: any = {
      buildingId: data.building_id ?? data.buildingId,
      floorNumber: data.floor_number ?? data.floorNumber,
      name: data.name,
      width: data.width,
      height: data.height,
      scale: data.scale,
      mapImage: data.map_image ?? data.mapImage,
    };
    const response = await fetch(`${API_URL}/api/floors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: {
    building_id?: string;
    buildingId?: string;
    floor_number?: number;
    floorNumber?: number;
    name?: string;
    width?: number;
    height?: number;
    scale?: number;
    map_image?: string;
    mapImage?: string;
  }): Promise<Floor> => {
    const payload: any = {
      buildingId: data.building_id ?? data.buildingId,
      floorNumber: data.floor_number ?? data.floorNumber,
      name: data.name,
      width: data.width,
      height: data.height,
      scale: data.scale,
      mapImage: data.map_image ?? data.mapImage,
    };
    const response = await fetch(`${API_URL}/api/floors/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  uploadMap: async (id: string, file: { uri: string; name: string; type: string }): Promise<Floor> => {
    const form = new FormData();
    form.append('file', file as any);
    const response = await fetch(`${API_URL}/api/floors/${id}/map`, {
      method: 'POST',
      body: form,
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/floors/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// Beacon APIs
export const beaconApi = {
  getAll: async (buildingId?: string, floorId?: string): Promise<Beacon[]> => {
    const params = new URLSearchParams();
    if (buildingId) params.append('building_id', buildingId);
    if (floorId) params.append('floor_id', floorId);
    const url = `${API_URL}/api/beacons${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    return handleResponse(response);
  },

  create: async (data: {
    building_id: string;
    floor_id: string;
    uuid: string;
    major: number;
    minor: number;
    x: number;
    y: number;
    label?: string;
  }): Promise<Beacon> => {
    const response = await fetch(`${API_URL}/api/beacons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: {
    uuid?: string;
    major?: number;
    minor?: number;
    x?: number;
    y?: number;
    label?: string;
  }): Promise<Beacon> => {
    const response = await fetch(`${API_URL}/api/beacons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/beacons/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// POI APIs
export const poiApi = {
  getAll: async (buildingId?: string, floorId?: string, category?: string): Promise<POI[]> => {
    const params = new URLSearchParams();
    if (buildingId) params.append('building_id', buildingId);
    if (floorId) params.append('floor_id', floorId);
    if (category) params.append('category', category);
    const url = `${API_URL}/api/pois${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    return handleResponse(response);
  },

  create: async (data: {
    building_id: string;
    floor_id: string;
    name: string;
    category: string;
    x: number;
    y: number;
    description?: string;
  }): Promise<POI> => {
    const response = await fetch(`${API_URL}/api/pois`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: {
    name?: string;
    category?: string;
    x?: number;
    y?: number;
    description?: string;
  }): Promise<POI> => {
    const response = await fetch(`${API_URL}/api/pois/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/pois/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },
};

// Positioning API - iBeacon-based indoor positioning
export const positioningApi = {
  /**
   * Compute user position from scanned iBeacons
   * @param beacons Array of scanned beacons with UUID/Major/Minor and RSSI
   */
  computePosition: async (beacons: ScannedBeacon[]): Promise<PositionResponse> => {
    const response = await fetch(`${API_URL}/api/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beacons }),
    });
    return handleResponse(response);
  },
};

// Navigation API - route computation
export const navigationApi = {
  /**
   * Compute navigation route from current position to destination
   */
  computeRoute: async (request: NavigationRequest): Promise<NavigationResponse> => {
    // Prefer new graph-based GET /api/navigation if available
    try {
      const params = new URLSearchParams({
        buildingId: String((request as any).buildingId || ''),
        floorId: String(request.floorId),
        fromX: String(request.startX),
        fromY: String(request.startY),
        toX: String(request.destX),
        toY: String(request.destY),
      });
      if (params.get('buildingId')) {
        const response = await fetch(`${API_URL}/api/navigation?${params.toString()}`);
        const data: any = await handleResponse(response);
        if (data && Array.isArray(data.path)) {
          return {
            success: true,
            message: 'Route calculated successfully',
            totalDistance: 0,
            route: data.path.map((p: any, i: number) => ({
              x: p.x,
              y: p.y,
              type: i === 0 ? 'start' : i === data.path.length - 1 ? 'destination' : 'waypoint',
            })),
          };
        }
      }
    } catch (_) {
      // Fall through to legacy API
    }

    const response = await fetch(`${API_URL}/api/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse(response);
  },
};

// Health check API
export const healthApi = {
  check: async (): Promise<{ status: string; service: string; version: string }> => {
    const response = await fetch(`${API_URL}/api/`);
    return handleResponse(response);
  },
};
