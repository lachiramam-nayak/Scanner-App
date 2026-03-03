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
  positionUpdatedAt: number | null;
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
  const BEACON_CORRECTION_ALPHA = 0.2;
  const MAX_BEACON_CORRECTION_PX = 10;
  const MAX_BEACON_JUMP_PX = 60;

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
  const [positionUpdatedAt, setPositionUpdatedAt] = useState<number | null>(null);
  const [isPositioning, setIsPositioning] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);

  // Navigation state
  const [navigationRoute, setNavigationRoute] = useState<NavigationResponse | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Strict PDR mode state
  const [pdrActive, setPdrActive] = useState(false);
  const pdrActiveRef = useRef(false);
  const pdrStartedRef = useRef(false);
  const hasInitialFixRef = useRef(false);
  const isComputingFixRef = useRef(false);
  const initialPdrPositionRef = useRef<{ x: number; y: number; buildingId: string; floorId: string } | null>(null);

  // Refs to track latest values in callbacks
  const currentPositionRef = useRef<PositionResponse | null>(null);
  const lastValidFixAtRef = useRef(0);
  const rssiThresholdRef = useRef<number>(-100);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const setNavigationRouteStore = useAppStore((s) => s.setNavigationRoute);
  const trackerRef = useRef<IndoorTracker | null>(null);

  // Update ref when position changes
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    pdrActiveRef.current = pdrActive;
  }, [pdrActive]);

  /**
   * Handle incoming beacon data and compute position
   */
  const handleBeaconsFound = useCallback(async (beacons: ScannedBeacon[]) => {
    setScannedBeacons(beacons);

    if (isComputingFixRef.current) {
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

    // Send a wider beacon set so registered beacons are not missed when
    // unknown beacons happen to have stronger RSSI than known ones.
    const top = usable
      .slice()
      .sort((a, b) => (b.avgRssi ?? b.rssi) - (a.avgRssi ?? a.rssi))
      .slice(0, 12);

    try {
      isComputingFixRef.current = true;
      setIsPositioning(true);
      setPositionError(null);

      // Send a broad candidate list; backend will match UUID/major/minor.
      const payload = top.map((b) => ({
        uuid: b.uuid,
        major: b.major,
        minor: b.minor,
        rssi: Math.round((b.avgRssi ?? b.rssi) as number),
      }));

      console.log('[Positioning] sending top beacons payload:', payload);
      const position = await positioningApi.computePosition(payload as any);

      if (position.valid) {
        if (!hasInitialFixRef.current) {
          hasInitialFixRef.current = true;
          initialPdrPositionRef.current = {
            x: position.x,
            y: position.y,
            buildingId: position.buildingId,
            floorId: position.floorId,
          };
        }
        setCurrentPosition(position);
        lastValidFixAtRef.current = Date.now();
        setPositionUpdatedAt(lastValidFixAtRef.current);

        // Smoothly correct global location using continuous beacon fixes.
        try {
          const currentLoc = useAppStore.getState().userLocation;
          let nextX = position.x;
          let nextY = position.y;
          let nextSource: UserLocation['source'] = 'beacon';

          if (
            currentLoc &&
            currentLoc.building_id === position.buildingId &&
            currentLoc.floor_id === position.floorId
          ) {
            const dx = position.x - currentLoc.x;
            const dy = position.y - currentLoc.y;
            const rawDist = Math.sqrt(dx * dx + dy * dy);

            if (Number.isFinite(rawDist) && rawDist <= MAX_BEACON_JUMP_PX) {
              nextX = currentLoc.x + dx * BEACON_CORRECTION_ALPHA;
              nextY = currentLoc.y + dy * BEACON_CORRECTION_ALPHA;
              const mx = nextX - currentLoc.x;
              const my = nextY - currentLoc.y;
              const moveDist = Math.sqrt(mx * mx + my * my);
              if (moveDist > MAX_BEACON_CORRECTION_PX && moveDist > 1e-6) {
                const s = MAX_BEACON_CORRECTION_PX / moveDist;
                nextX = currentLoc.x + mx * s;
                nextY = currentLoc.y + my * s;
              }
              nextSource = 'beacon';
            }
          }

          const userLoc: UserLocation = {
            building_id: position.buildingId,
            floor_id: position.floorId,
            x: nextX,
            y: nextY,
            source: nextSource,
            timestamp: new Date(),
          };
          setUserLocation(userLoc);
        } catch (e) {
          console.warn('[useBeaconScanner] Failed to set user location in store', e);
        }
      } else {
        setPositionError(position.errorMessage || 'Position computation failed');
        if (Date.now() - lastValidFixAtRef.current > 3000) {
          setCurrentPosition(null);
          setPositionUpdatedAt(null);
        }
      }
    } catch (error) {
      console.error('[useBeaconScanner] Position error:', error);
      setPositionError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      isComputingFixRef.current = false;
      setIsPositioning(false);
    }
  }, [setUserLocation]);

  const toPositiveNumber = useCallback((value: unknown): number | null => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, []);

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

    // Fresh one-shot cycle: stop any active PDR session first.
    trackerRef.current?.stopSensors();
    setPdrActive(false);
    pdrActiveRef.current = false;
    pdrStartedRef.current = false;

    // Starting scan means we want a fresh one-shot fix.
    hasInitialFixRef.current = false;
    initialPdrPositionRef.current = null;

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
        trackerRef.current.setConfig({
          stepLengthM: 1.0,
          rssiThreshold: -100,
          kalmanProcessNoise: 0.01,
          kalmanMeasurementNoise: 2,
          deviationThresholdM: 2,
          snapToleranceM: 1.5,
          n: 2.5,
          minStepPx: 4,
        });
        trackerRef.current.setAnchorPosition(initial.x, initial.y);
        // Get map and real-world dimensions from selectedFloor and navigationRoute
        const selectedFloor = useAppStore.getState().selectedFloor;
        let mapWidthPx = 1, mapHeightPx = 1, realWidthM = 1, realHeightM = 1;
        if (selectedFloor) {
          const floorWidth = toPositiveNumber((selectedFloor as any).width);
          const floorHeight = toPositiveNumber((selectedFloor as any).height);
          const floorScale = toPositiveNumber((selectedFloor as any).scale);

          if (floorWidth && floorHeight && floorScale) {
            // scale is pixels per meter, so derive real-world dimensions in meters.
            mapWidthPx = floorWidth;
            mapHeightPx = floorHeight;
            realWidthM = floorWidth / floorScale;
            realHeightM = floorHeight / floorScale;
          } else if (floorWidth && floorHeight) {
            mapWidthPx = floorWidth;
            mapHeightPx = floorHeight;
            realWidthM = floorWidth;
            realHeightM = floorHeight;
          } else {
            console.warn('[useBeaconScanner] Invalid floor dimensions, using fallback scaling', {
              floorId: selectedFloor.id,
              width: (selectedFloor as any).width,
              height: (selectedFloor as any).height,
              scale: (selectedFloor as any).scale,
            });
          }
        }
        trackerRef.current.setRoute(route.route, mapWidthPx, mapHeightPx, realWidthM, realHeightM);
        trackerRef.current.setPositionCallback((p) => {
          // Snap to route and update global store
          const snapped = trackerRef.current ? trackerRef.current.snapToRoute(p.x, p.y) : { x: p.x, y: p.y };
          const timestamp = new Date();
          setUserLocation({
            building_id: initial.buildingId,
            floor_id: initial.floorId,
            x: snapped.x,
            y: snapped.y,
            source: 'sensor',
            timestamp,
          });
          setCurrentPosition((prev) => ({
            buildingId: initial.buildingId,
            buildingName: prev?.buildingName || '',
            floorId: initial.floorId,
            floorName: prev?.floorName || '',
            floorNumber: prev?.floorNumber || 0,
            x: snapped.x,
            y: snapped.y,
            method: prev?.method || 'nearest',
            beaconsUsed: prev?.beaconsUsed || 0,
            valid: true,
            errorMessage: null,
          }));
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
  }, [setNavigationRouteStore, setUserLocation, toPositiveNumber]);

  /**
   * Clear navigation route
   */
  const clearNavigation = useCallback(() => {
    setNavigationRoute(null);
    try {
      setNavigationRouteStore(null);
    } catch (e) {
      console.warn('[useBeaconScanner] Failed to clear navigation route in store', e);
    }
    trackerRef.current?.stopSensors();
    setPdrActive(false);
    pdrActiveRef.current = false;
    pdrStartedRef.current = false;
    hasInitialFixRef.current = false;
    initialPdrPositionRef.current = null;
  }, [setNavigationRouteStore]);

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
    positionUpdatedAt,
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
