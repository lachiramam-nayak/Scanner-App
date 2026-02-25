/**
 * iBeacon Scanner Service (UUID/Major/Minor only)
 * Uses Android Beacon Library via react-native-beacons-manager.
 */

import { Platform, PermissionsAndroid, DeviceEventEmitter } from 'react-native';
import Beacons from 'react-native-beacons-manager';

export interface ScannedBeacon {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  avgRssi: number;
  timestamp: number;
}

export interface BeaconScannerOptions {
  /** Scan interval in milliseconds (default: 1000) */
  scanInterval?: number;
  /** RSSI threshold - ignore beacons below this value (default: -75) */
  rssiThreshold?: number;
  /** Time to batch beacons before callback (default: 2000ms) */
  batchInterval?: number;
  /** Moving average window size (default: 5) */
  smoothingWindow?: number;
}

type BeaconCallback = (beacons: ScannedBeacon[]) => void;
type StatusCallback = (status: BeaconScannerStatus) => void;

export interface BeaconScannerStatus {
  isScanning: boolean;
  bluetoothEnabled: boolean;
  permissionsGranted: boolean;
  error?: string;
}

type RangedBeacon = {
  uuid?: string;
  major?: number;
  minor?: number;
  rssi?: number;
};

class BeaconScannerService {
  private isScanning = false;
  private beaconBuffer: Map<string, ScannedBeacon> = new Map();
  private rssiHistory: Map<string, number[]> = new Map();
  private scanCallback: BeaconCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private rangingSub: any = null;

  private options: BeaconScannerOptions = {
    scanInterval: 1000,
    rssiThreshold: -75,
    batchInterval: 2000,
    smoothingWindow: 5,
  };

  async initialize(): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('[BeaconScanner] Web platform - BLE not supported');
      return false;
    }

    try {
      Beacons.detectIBeacons();
      if (Platform.OS === 'android') {
        // Aggressive scanning for quick updates (if supported by the module)
        const anyBeacons = Beacons as any;
        if (typeof anyBeacons.setForegroundScanPeriod === 'function') {
          anyBeacons.setForegroundScanPeriod(1100);
        }
        if (typeof anyBeacons.setForegroundBetweenScanPeriod === 'function') {
          anyBeacons.setForegroundBetweenScanPeriod(0);
        }
      }
      console.log('[BeaconScanner] Beacon manager initialized');
      return true;
    } catch (error) {
      console.error('[BeaconScanner] Initialization error:', error);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const permissions: string[] = [];
      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      }
      permissions.push(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      const results: any = await PermissionsAndroid.requestMultiple(permissions as any);
      const allGranted = Object.values(results).every(
        (result: any) => result === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log('[BeaconScanner] Permissions granted:', allGranted);
      return allGranted;
    } catch (error) {
      console.error('[BeaconScanner] Permission request error:', error);
      return false;
    }
  }

  private updateRssiHistory(key: string, rssi: number): number {
    const windowSize = this.options.smoothingWindow || 5;
    const history = this.rssiHistory.get(key) || [];
    history.push(rssi);
    while (history.length > windowSize) {
      history.shift();
    }
    this.rssiHistory.set(key, history);
    const sum = history.reduce((acc, v) => acc + v, 0);
    return sum / history.length;
  }

  async startScanning(
    onBeaconsFound: BeaconCallback,
    onStatusChange?: StatusCallback,
    options?: BeaconScannerOptions
  ): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.log('[BeaconScanner] BLE scanning not available on web');
      onStatusChange?.({
        isScanning: false,
        bluetoothEnabled: false,
        permissionsGranted: false,
        error: 'BLE not supported on web platform',
      });
      return false;
    }

    if (this.isScanning) {
      console.log('[BeaconScanner] Already scanning');
      return true;
    }

    this.scanCallback = onBeaconsFound;
    this.statusCallback = onStatusChange ?? null;
    this.options = { ...this.options, ...options };

    const permissionsGranted = await this.requestPermissions();
    if (!permissionsGranted) {
      this.statusCallback?.({
        isScanning: false,
        bluetoothEnabled: false,
        permissionsGranted: false,
        error: 'Bluetooth permissions not granted',
      });
      return false;
    }

    const initialized = await this.initialize();
    if (!initialized) {
      this.statusCallback?.({
        isScanning: false,
        bluetoothEnabled: false,
        permissionsGranted: true,
        error: 'Failed to initialize Bluetooth',
      });
      return false;
    }

    this.beaconBuffer.clear();
    this.rssiHistory.clear();
    this.isScanning = true;

    this.statusCallback?.({
      isScanning: true,
      bluetoothEnabled: true,
      permissionsGranted: true,
    });

    // Listen for ranging events
    this.rangingSub = DeviceEventEmitter.addListener('beaconsDidRange', (data: any) => {
      const beacons: RangedBeacon[] = data?.beacons || [];
      for (const b of beacons) {
        if (!b.uuid || typeof b.major !== 'number' || typeof b.minor !== 'number') continue;
        const rssi = typeof b.rssi === 'number' ? b.rssi : null;
        if (rssi === null) continue;

        const key = `${b.uuid}-${b.major}-${b.minor}`;
        const avgRssi = this.updateRssiHistory(key, rssi);
        if (avgRssi < (this.options.rssiThreshold || -75)) continue;

        const beacon: ScannedBeacon = {
          uuid: b.uuid.toUpperCase(),
          major: b.major,
          minor: b.minor,
          rssi,
          avgRssi,
          timestamp: Date.now(),
        };

        this.beaconBuffer.set(key, beacon);
        console.debug(`Kinesis [BeaconScanner] iBeacon found: ${beacon.uuid}/${beacon.major}/${beacon.minor}, RSSI: ${rssi}, AVG: ${avgRssi.toFixed(1)}`);
      }
    });

    // Start batch timer
    this.startBatchTimer();

    // Start ranging all beacons
    // Android Beacon Library supports null UUID to range all.
    await Beacons.startRangingBeaconsInRegion('REGION_ALL', null as any);

    console.log('[BeaconScanner] Starting iBeacon ranging (beacons-manager)...');
    return true;
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      if (this.beaconBuffer.size > 0 && this.scanCallback) {
        const beacons = Array.from(this.beaconBuffer.values());
        this.scanCallback(beacons);
      }
    }, this.options.batchInterval || 2000);
  }

  stopScanning(): void {
    if (!this.isScanning) return;

    console.log('[BeaconScanner] Stopping scan...');

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.rangingSub) {
      this.rangingSub.remove();
      this.rangingSub = null;
    }

    Beacons.stopRangingBeaconsInRegion('REGION_ALL').catch(() => {});

    this.isScanning = false;
    this.beaconBuffer.clear();
    this.rssiHistory.clear();

    this.statusCallback?.({
      isScanning: false,
      bluetoothEnabled: true,
      permissionsGranted: true,
    });
  }

  isScanningActive(): boolean {
    return this.isScanning;
  }

  destroy(): void {
    this.stopScanning();
  }
}

export const beaconScanner = new BeaconScannerService();
export { BeaconScannerService };
