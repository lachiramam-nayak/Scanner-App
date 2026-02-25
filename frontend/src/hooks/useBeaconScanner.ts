/**
 * useBeaconScanner Hook
 * React hook for iBeacon scanning and positioning
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useAppStore, UserLocation } from '../store/appStore';
import {
  beaconScanner,
  ScannedBeacon,
  BeaconScannerStatus,
  BeaconScannerOptions
} from '../services/beaconScanner';
import { IndoorTracker } from '../services/indoorTracking';
import {
  positioningApi,
  PositionResponse,
  navigationApi,
  NavigationResponse,
  NavigationRequest
} from '../services/api';


export interface UseBeaconScannerResult {
  // Scanner state
  isScanning: boolean;
  scannerStatus: BeaconScannerStatus;
  scannedBeacons: ScannedBeacon[];

  // Position state
  currentPosition: PositionResponse | null;
  isPositioning: boolean;
  positionError: string | null;

  // Navigation state
  navigationRoute: NavigationResponse | null;
  isNavigating: boolean;

  // Actions
  startScanning: (options?: BeaconScannerOptions) => Promise<boolean>;
  stopScanning: () => void;
  navigateTo: (destX: number, destY: number) => Promise<NavigationResponse | null>;
  clearNavigation: () => void;
}

export function useBeaconScanner(): UseBeaconScannerResult {

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<BeaconScannerStatus>({
    isScanning: false,
    bluetoothEnabled: false,
    permissionsGranted: false,
  });
  const [scannedBeacons, setScannedBeacons] = useState<ScannedBeacon[]>([]);

  // Position state
  const [currentPosition, setCurrentPosition] = useState<PositionResponse | null>(null);
  const [isPositioning, setIsPositioning] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);

  // Navigation state
  const [navigationRoute, setNavigationRoute] = useState<NavigationResponse | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Strict PDR mode state
  const [pdrActive, setPdrActive] = useState(false);
  const pdrStartedRef = useRef(false);
  const initialPdrPositionRef = useRef<{ x: number; y: number; buildingId: string; floorId: string } | null>(null);

  // Refs to track latest values in callbacks
  const currentPositionRef = useRef<PositionResponse | null>(null);
  const rssiThresholdRef = useRef<number>(-100);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setNavigationRouteStore = useAppStore((s) => s.setNavigationRoute);
  const trackerRef = useRef<IndoorTracker | null>(null);

  // Update ref when position changes
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  /**
   * Handle incoming beacon data and compute position
   */
  const handleBeaconsFound = useCallback(async (beacons: ScannedBeacon[]) => {
    setScannedBeacons(beacons);

    // If strict PDR mode is active, ignore all beacon updates
    if (pdrActive) {
      return;
    }

    if (beacons.length === 0) {
      return;
    }

    if (trackerRef.current) {
      trackerRef.current.ingestBeacons(beacons);
    }

    const usable = beacons.filter((b) => (b.avgRssi ?? b.rssi) >= (rssiThresholdRef.current ?? -100));
    if (usable.length === 0) {
      setPositionError(`No beacon with sufficient RSSI (threshold ${rssiThresholdRef.current ?? -100} dBm)`);
      return;
    }

    const top = usable
      .slice()
      .sort((a, b) => (b.avgRssi ?? b.rssi) - (a.avgRssi ?? a.rssi))
      .slice(0, 3);

    try {
      setIsPositioning(true);
      setPositionError(null);

      // Use only the strongest beacon for a single-beacon lookup
      const payload = top.map((b) => ({
        uuid: b.uuid,
        major: b.major,
        minor: b.minor,
        rssi: Math.round((b.avgRssi ?? b.rssi) as number),
      }));

      console.log('[Positioning] sending top beacons payload:', payload);
      const position = await positioningApi.computePosition(payload as any);

      if (position.valid) {
        setCurrentPosition(position);

        // Only set initial PDR position if not started
        if (!pdrStartedRef.current) {
          initialPdrPositionRef.current = {
            x: position.x,
            y: position.y,
            buildingId: position.buildingId,
            floorId: position.floorId,
          };
          // Also update global store user location
          try {
            const userLoc: UserLocation = {
              building_id: position.buildingId,
              floor_id: position.floorId,
              x: position.x,
              y: position.y,
              source: 'beacon',
              timestamp: new Date(),
            };
            setUserLocation(userLoc);
          } catch (e) {
            console.warn('[useBeaconScanner] Failed to set user location in store', e);
          }
        }

        console.log(`[useBeaconScanner] Position (from strongest beacon): (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) on ${position.floorName}`);
      } else {
        setPositionError(position.errorMessage || 'Position computation failed');
      }
    } catch (error) {
      console.error('[useBeaconScanner] Position error:', error);
      setPositionError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPositioning(false);
    }
  }, [pdrActive]);

  useEffect(() => {
    if (!trackerRef.current) {
      trackerRef.current = new IndoorTracker();
    }
    return () => {
      trackerRef.current?.stopSensors();
    };
  }, []);

  /**
   * Handle scanner status changes
   */
  const handleStatusChange = useCallback((status: BeaconScannerStatus) => {
    setScannerStatus(status);
    setIsScanning(status.isScanning);
  }, []);

  /**
   * Start beacon scanning
   */
  const startScanning = useCallback(async (options?: BeaconScannerOptions): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.log('[useBeaconScanner] BLE not available on web');
      setScannerStatus({
        isScanning: false,
        bluetoothEnabled: false,
        permissionsGranted: false,
        error: 'BLE scanning requires a physical Android device',
      });
      return false;
    }

    // store the configured RSSI threshold so the handler uses the same value
    rssiThresholdRef.current = options?.rssiThreshold ?? -100;

    const success = await beaconScanner.startScanning(
      handleBeaconsFound,
      handleStatusChange,
      options
    );

    return success;
  }, [handleBeaconsFound, handleStatusChange]);

  /**
   * Stop beacon scanning
   */
  const stopScanning = useCallback(() => {
    beaconScanner.stopScanning();
    setIsScanning(false);
    setScannedBeacons([]);
  }, []);

  /**
   * Navigate to a destination
   */
  const navigateTo = useCallback(async (destX: number, destY: number): Promise<NavigationResponse | null> => {
    // Use the initial PDR position for navigation
    const initial = initialPdrPositionRef.current;
    if (!initial) {
      console.error('[useBeaconScanner] Cannot navigate: no initial PDR position');
      return null;
    }

    try {
      setIsNavigating(true);

      const request: NavigationRequest = {
        buildingId: initial.buildingId,
        floorId: initial.floorId,
        startX: initial.x,
        startY: initial.y,
        destX,
        destY,
      };

      const route = await navigationApi.computeRoute(request);
      setNavigationRoute(route);
      // persist route to global store so map reads it
      try {
        setNavigationRouteStore(route);
      } catch (e) {
        console.warn('[useBeaconScanner] Failed to set navigation route in store', e);
      }

      // Strict PDR mode: set anchor, route, sensors, and callback ONCE
      if (trackerRef.current && !pdrStartedRef.current) {
        trackerRef.current.setAnchorPosition(initial.x, initial.y);
        // Get map and real-world dimensions from selectedFloor and navigationRoute
        const selectedFloor = useAppStore.getState().selectedFloor;
        let mapWidthPx = 1, mapHeightPx = 1, realWidthM = 1, realHeightM = 1;
        if (selectedFloor) {
          // Prefer mapWidth/mapHeight from IndoorMapViewer props if available, else fallback to floor width/height
          mapWidthPx = selectedFloor.mapImage ? selectedFloor.width : 1;
          mapHeightPx = selectedFloor.mapImage ? selectedFloor.height : 1;
          realWidthM = selectedFloor.width;
          realHeightM = selectedFloor.height;
        }
        trackerRef.current.setRoute(route.route, mapWidthPx, mapHeightPx, realWidthM, realHeightM);
        trackerRef.current.setPositionCallback((p) => {
          // Snap to route and update global store
          const snapped = trackerRef.current ? trackerRef.current.snapToRoute(p.x, p.y) : { x: p.x, y: p.y };
          setUserLocation({
            building_id: initial.buildingId,
            floor_id: initial.floorId,
            x: snapped.x,
            y: snapped.y,
            source: 'sensor',
            timestamp: new Date(),
          });
        });
        trackerRef.current.startSensors();
        setPdrActive(true);
        pdrStartedRef.current = true;
      }

      console.log(`[useBeaconScanner] Navigation route: ${route.route.length} points, ${route.totalDistance.toFixed(1)} units`);

      return route;
    } catch (error) {
      console.error('[useBeaconScanner] Navigation error:', error);
      return null;
    } finally {
      setIsNavigating(false);
    }
  }, []);

  /**
   * Clear navigation route
   */
  const clearNavigation = useCallback(() => {
    setNavigationRoute(null);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      beaconScanner.stopScanning();
    };
  }, []);

  return {
    // Scanner state
    isScanning,
    scannerStatus,
    scannedBeacons,

    // Position state
    currentPosition,
    isPositioning,
    positionError,

    // Navigation state
    navigationRoute,
    isNavigating,

    // Actions
    startScanning,
    stopScanning,
    navigateTo,
    clearNavigation,
  };
}
