import { Accelerometer, Magnetometer } from 'expo-sensors';
import type { Beacon, UserLocation } from '../store/appStore';
import type { ScannedBeacon } from './beaconScanner';

export type TrackPosition = {
  x: number;
  y: number;
  source: 'beacon' | 'sensor';
  timestamp: Date;
};

export type TrackingConfig = {
  scanIntervalMs: number;
  stepLengthM: number;
  rssiThreshold: number;
  n: number; // path loss exponent
  kalmanProcessNoise: number;
  kalmanMeasurementNoise: number;
  deviationThresholdM: number;
  snapToleranceM: number;
};

const DEFAULT_CONFIG: TrackingConfig = {
  scanIntervalMs: 500,
  stepLengthM: 0.7,
  rssiThreshold: -100,
  n: 2.5,
  kalmanProcessNoise: 0.01,
  kalmanMeasurementNoise: 2,
  deviationThresholdM: 2,
  snapToleranceM: 1.5,
};

class Kalman1D {
  private x = 0;
  private p = 1;
  private q: number;
  private r: number;
  private initialized = false;

  constructor(q: number, r: number) {
    this.q = q;
    this.r = r;
  }

  setNoise(q: number, r: number) {
    this.q = q;
    this.r = r;
  }

  reset(value: number) {
    this.x = value;
    this.p = 1;
    this.initialized = true;
  }

  update(z: number) {
    if (!this.initialized) {
      this.reset(z);
      return z;
    }
    // prediction
    this.p += this.q;
    // update
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (z - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }
}

export class IndoorTracker {
  private config: TrackingConfig;
  private beaconMap = new Map<string, Beacon>();
  private kalmanX: Kalman1D;
  private kalmanY: Kalman1D;
  private headingRad = 0;
  private accelSub: any = null;
  private magSub: any = null;
  private lastStepTime = 0;
  private lastPos: { x: number; y: number } | null = null;
  private onPosition?: (p: TrackPosition) => void;
  private onDeviation?: () => void;
  private route: Array<{ x: number; y: number }> = [];
  private pixelsPerMeter = 10;
  private mapWidthPx = 0;
  private mapHeightPx = 0;
  private realWidthM = 0;
  private realHeightM = 0;

  constructor(config?: Partial<TrackingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
    this.kalmanX = new Kalman1D(this.config.kalmanProcessNoise, this.config.kalmanMeasurementNoise);
    this.kalmanY = new Kalman1D(this.config.kalmanProcessNoise, this.config.kalmanMeasurementNoise);
  }

  setConfig(config: Partial<TrackingConfig>) {
    this.config = { ...this.config, ...config };
    this.kalmanX.setNoise(this.config.kalmanProcessNoise, this.config.kalmanMeasurementNoise);
    this.kalmanY.setNoise(this.config.kalmanProcessNoise, this.config.kalmanMeasurementNoise);
  }

  /**
   * Set route and scaling for dead reckoning.
   * @param route Navigation polyline
   * @param mapWidthPx Map image width in pixels
   * @param mapHeightPx Map image height in pixels
   * @param realWidthM Real-world width in meters
   * @param realHeightM Real-world height in meters
   */
  setRoute(
    route: Array<{ x: number; y: number }>,
    mapWidthPx: number,
    mapHeightPx: number,
    realWidthM: number,
    realHeightM: number
  ) {
    this.route = route || [];
    this.mapWidthPx = mapWidthPx;
    this.mapHeightPx = mapHeightPx;
    this.realWidthM = realWidthM;
    this.realHeightM = realHeightM;
    // Calculate scaling: average pixels per meter
    const scaleX = mapWidthPx / realWidthM;
    const scaleY = mapHeightPx / realHeightM;
    this.pixelsPerMeter = (scaleX + scaleY) / 2;
  }

  setAnchorPosition(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.lastPos = { x, y };
    this.kalmanX.reset(x);
    this.kalmanY.reset(y);
  }

  setBeacons(beacons: Beacon[]) {
    this.beaconMap.clear();
    for (const b of beacons) {
      const key = `${b.uuid.toUpperCase()}-${b.major}-${b.minor}`;
      this.beaconMap.set(key, b);
    }
  }

  setPositionCallback(cb: (p: TrackPosition) => void) {
    this.onPosition = cb;
  }

  setDeviationCallback(cb: () => void) {
    this.onDeviation = cb;
  }

  async startSensors() {
    this.stopSensors();
    const accelAvailable = await Accelerometer.isAvailableAsync();
    const magAvailable = await Magnetometer.isAvailableAsync();
    if (accelAvailable) {
      Accelerometer.setUpdateInterval(100);
      this.accelSub = Accelerometer.addListener((data) => {
        const { x, y, z } = data;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        // simple step detection threshold
        if (magnitude > 1.2 && now - this.lastStepTime > 350) {
          this.lastStepTime = now;
          this.applyDeadReckoningStep();
        }
      });
    }
    if (magAvailable) {
      Magnetometer.setUpdateInterval(200);
      this.magSub = Magnetometer.addListener((data) => {
        const { x, y } = data;
        const heading = Math.atan2(y, x);
        // smooth heading
        this.headingRad = this.headingRad * 0.8 + heading * 0.2;
      });
    }
  }

  stopSensors() {
    if (this.accelSub) this.accelSub.remove();
    if (this.magSub) this.magSub.remove();
    this.accelSub = null;
    this.magSub = null;
  }

  ingestBeacons(scans: ScannedBeacon[]) {
    const usable = scans
      .filter((b) => (b.avgRssi ?? b.rssi) >= this.config.rssiThreshold)
      .map((b) => ({ ...b, rssi: Math.round((b.avgRssi ?? b.rssi) as number) }));

    if (usable.length < 3) {
      return;
    }

    const top = usable
      .slice()
      .sort((a, b) => (b.rssi) - (a.rssi))
      .slice(0, 3);

    const beacons = top.map((b) => {
      const key = `${b.uuid.toUpperCase()}-${b.major}-${b.minor}`;
      const beacon = this.beaconMap.get(key);
      return beacon ? { beacon, rssi: b.rssi } : null;
    }).filter(Boolean) as Array<{ beacon: Beacon; rssi: number }>;

    if (beacons.length < 3) return;

    const pos = this.trilaterate(beacons);
    if (!pos) return;

    const filtered = this.applyKalman(pos.x, pos.y);
    const snapped = this.snapToRoute(filtered.x, filtered.y);
    this.updatePosition(snapped.x, snapped.y, 'beacon');
  }

  private trilaterate(beacons: Array<{ beacon: Beacon; rssi: number }>): { x: number; y: number } | null {
    const [b1, b2, b3] = beacons;
    const d1 = this.rssiToDistance(b1.rssi, b1.beacon.txPower || -59);
    const d2 = this.rssiToDistance(b2.rssi, b2.beacon.txPower || -59);
    const d3 = this.rssiToDistance(b3.rssi, b3.beacon.txPower || -59);

    const x1 = b1.beacon.x, y1 = b1.beacon.y;
    const x2 = b2.beacon.x, y2 = b2.beacon.y;
    const x3 = b3.beacon.x, y3 = b3.beacon.y;

    const A = 2 * (x2 - x1);
    const B = 2 * (y2 - y1);
    const C = d1 * d1 - d2 * d2 - x1 * x1 + x2 * x2 - y1 * y1 + y2 * y2;
    const D = 2 * (x3 - x1);
    const E = 2 * (y3 - y1);
    const F = d1 * d1 - d3 * d3 - x1 * x1 + x3 * x3 - y1 * y1 + y3 * y3;

    const denom = (A * E - B * D);
    if (Math.abs(denom) < 1e-6) return null;
    const x = (C * E - B * F) / denom;
    const y = (A * F - C * D) / denom;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private rssiToDistance(rssi: number, txPower: number) {
    return Math.pow(10, (txPower - rssi) / (10 * this.config.n));
  }

  private applyKalman(x: number, y: number) {
    return {
      x: this.kalmanX.update(x),
      y: this.kalmanY.update(y),
    };
  }

  private applyDeadReckoningStep() {
    if (!this.lastPos) return;
    const stepPx = this.config.stepLengthM * this.pixelsPerMeter;
    console.log('[IndoorTracker] Dead-reckoning step detected', {
      stepLengthM: this.config.stepLengthM,
      pixelsPerMeter: this.pixelsPerMeter,
      stepPx,
      headingRad: this.headingRad,
      lastPos: this.lastPos,
    });
    const nx = this.lastPos.x + stepPx * Math.cos(this.headingRad);
    const ny = this.lastPos.y + stepPx * Math.sin(this.headingRad);
    const snapped = this.snapToRoute(nx, ny);
    const dx = snapped.x - this.lastPos.x;
    const dy = snapped.y - this.lastPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Prevent teleporting if snap jumps far ahead on the route.
    if (dist > stepPx * 1.5) {
      const ratio = stepPx / dist;
      this.updatePosition(
        this.lastPos.x + dx * ratio,
        this.lastPos.y + dy * ratio,
        'sensor'
      );
      return;
    }
    this.updatePosition(snapped.x, snapped.y, 'sensor');
  }

  private snapToRoute(x: number, y: number) {
    if (!this.route || this.route.length < 2) {
      return { x, y };
    }
    let best = { x, y, dist: Number.POSITIVE_INFINITY };
    for (let i = 0; i < this.route.length - 1; i++) {
      const a = this.route[i];
      const b = this.route[i + 1];
      const proj = projectPointToSegment(x, y, a.x, a.y, b.x, b.y);
      if (proj.dist < best.dist) {
        best = proj;
      }
    }

    const distMeters = Math.sqrt(best.dist) / this.pixelsPerMeter;
    if (distMeters > this.config.deviationThresholdM && this.onDeviation) {
      this.onDeviation();
    }
    if (distMeters <= this.config.snapToleranceM) {
      return { x: best.x, y: best.y };
    }
    return { x, y };
  }

  private updatePosition(x: number, y: number, source: 'beacon' | 'sensor') {
    this.lastPos = { x: Number(x), y: Number(y) };
    // debug log to observe blue-dot movement
    console.log('[IndoorTracker] updatePosition', { x, y, source });
    this.onPosition?.({ x: Number(x), y: Number(y), source, timestamp: new Date() });
  }
}

function projectPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const dist = (px - x1) ** 2 + (py - y1) ** 2;
    return { x: x1, y: y1, dist };
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const x = x1 + clamped * dx;
  const y = y1 + clamped * dy;
  const dist = (px - x) ** 2 + (py - y) ** 2;
  return { x, y, dist };
}
