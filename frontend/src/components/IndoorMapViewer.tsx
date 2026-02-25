import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  RotationGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Polygon } from 'react-native-svg';
import { POI, UserLocation, Beacon } from '../store/appStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const distance = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};

const getRouteHeading = (
  userLocation: UserLocation | null | undefined,
  route: Array<{ x: number; y: number; type: string }> | undefined
) => {
  if (!userLocation || !route || route.length < 2) return 0;

  let bestIndex = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = userLocation.x - a.x;
    const apy = userLocation.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    const projX = a.x + t * abx;
    const projY = a.y + t * aby;
    const d = distance(userLocation.x, userLocation.y, projX, projY);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  const start = route[bestIndex];
  const end = route[bestIndex + 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return angle + 90;
};

export interface IndoorMapViewerHandle {
  rotateBy: (deltaDeg: number) => void;
  resetView: () => void;
  zoomBy: (delta: number) => void;
}

interface IndoorMapViewerProps {
  mapImage?: string;
  mapWidth: number;
  mapHeight: number;
  userLocation?: UserLocation | null;
  destination?: POI | null;
  route?: Array<{ x: number; y: number; type: string }>;
  pois?: POI[];
  beacons?: Beacon[];
  onPoiPress?: (poi: POI) => void;
  onMapPress?: (x: number, y: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  showMarkers?: boolean;
  showDestinationMode?: boolean;
  showRoutePoints?: boolean;
  showRouteLine?: boolean;
  showTurnPrompt?: boolean;
}

export const IndoorMapViewer = forwardRef<IndoorMapViewerHandle, IndoorMapViewerProps>(({
  mapImage,
  mapWidth,
  mapHeight,
  userLocation,
  destination,
  route,
  pois = [],
  beacons = [],
  onPoiPress,
  onMapPress,
  onInteractionStart,
  onInteractionEnd,
  showMarkers = true,
  showDestinationMode = false,
  showRoutePoints = true,
  showRouteLine = true,
  showTurnPrompt = true,
}, ref) => {
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const lastPanRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const lastScaleRef = useRef(1);
  const lastRotationRef = useRef(0);
  const userXAnim = useRef(new Animated.Value(0)).current;
  const userYAnim = useRef(new Animated.Value(0)).current;
  const hasUserAnimInitRef = useRef(false);
  const pinchRef = useRef(null);
  const rotationRef = useRef(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;

  // Calculate aspect ratio to fit map in view
  const containerWidth = SCREEN_WIDTH - 32;
  const containerHeight = SCREEN_HEIGHT * 0.5;
  const aspectRatio = mapWidth / mapHeight;
  const containerAspectRatio = containerWidth / containerHeight;
  
  let displayWidth, displayHeight;
  if (aspectRatio > containerAspectRatio) {
    displayWidth = containerWidth;
    displayHeight = containerWidth / aspectRatio;
  } else {
    displayHeight = containerHeight;
    displayWidth = containerHeight * aspectRatio;
  }

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  useEffect(() => {
    if (!userLocation) return;
    if (!Number.isFinite(userLocation.x) || !Number.isFinite(userLocation.y)) return;
    const clampedX = clamp(userLocation.x, 0, mapWidth);
    const clampedY = clamp(userLocation.y, 0, mapHeight);
    const coords = toDisplayCoords(clampedX, clampedY);
    if (!hasUserAnimInitRef.current) {
      hasUserAnimInitRef.current = true;
      userXAnim.setValue(coords.x);
      userYAnim.setValue(coords.y);
      return;
    }
    Animated.parallel([
      Animated.timing(userXAnim, {
        toValue: coords.x,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(userYAnim, {
        toValue: coords.y,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [userLocation?.x, userLocation?.y, mapWidth, mapHeight, displayWidth, displayHeight]);

  // Simple pan responder for drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event) => (event.nativeEvent.touches?.length || 0) === 1,
      onMoveShouldSetPanResponder: (event) => (event.nativeEvent.touches?.length || 0) === 1,
      onPanResponderGrant: () => {
        panStartRef.current = { ...lastPanRef.current };
      },
      onPanResponderMove: (event, { dx, dy }) => {
        const nextX = panStartRef.current.x + dx;
        const nextY = panStartRef.current.y + dy;
        translateXAnim.setValue(nextX);
        translateYAnim.setValue(nextY);
      },
      onPanResponderRelease: (event, { dx, dy }) => {
        lastPanRef.current = {
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        };
      },
      onStartShouldSetPanResponderCapture: () => {
        // Allow taps to go through in destination mode
        return !showDestinationMode;
      },
    })
  ).current;

  // Convert map coordinates to display coordinates
  const toDisplayCoords = (x: number, y: number) => {
    return {
      x: (x / mapWidth) * displayWidth,
      y: (y / mapHeight) * displayHeight,
    };
  };

  // Convert display coordinates back to map coordinates
  const toMapCoords = (displayX: number, displayY: number) => {
    return {
      x: (displayX / displayWidth) * mapWidth,
      y: (displayY / displayHeight) * mapHeight,
    };
  };

  const handleMapTap = (event: GestureResponderEvent) => {
    if (!showDestinationMode || !onMapPress) return;
    const { locationX, locationY } = event.nativeEvent;
    const mapCoords = toMapCoords(locationX, locationY);
    onMapPress(Math.max(0, Math.min(mapCoords.x, mapWidth)), Math.max(0, Math.min(mapCoords.y, mapHeight)));
  };

  const handlePinch = (event: any) => {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, lastScaleRef.current * event.nativeEvent.scale));
    scaleAnim.setValue(next);
  };

  const handlePinchStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, lastScaleRef.current * event.nativeEvent.scale));
      lastScaleRef.current = next;
      scaleAnim.setValue(next);
    }
  };

  const handleRotation = (event: any) => {
    const deltaDeg = (event.nativeEvent.rotation * 180) / Math.PI;
    rotationAnim.setValue(lastRotationRef.current + deltaDeg);
  };

  const handleRotationStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      const deltaDeg = (event.nativeEvent.rotation * 180) / Math.PI;
      const next = lastRotationRef.current + deltaDeg;
      lastRotationRef.current = next;
      rotationAnim.setValue(next);
    }
  };

  useImperativeHandle(ref, () => ({
    rotateBy: (deltaDeg: number) => {
      const next = lastRotationRef.current + deltaDeg;
      lastRotationRef.current = next;
      rotationAnim.setValue(next);
    },
    resetView: () => {
      lastPanRef.current = { x: 0, y: 0 };
      panStartRef.current = { x: 0, y: 0 };
      translateXAnim.setValue(0);
      translateYAnim.setValue(0);
      lastScaleRef.current = 1;
      scaleAnim.setValue(1);
      lastRotationRef.current = 0;
      rotationAnim.setValue(0);
    },
    zoomBy: (delta: number) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, lastScaleRef.current + delta));
      lastScaleRef.current = next;
      scaleAnim.setValue(next);
    },
  }), [MAX_SCALE, MIN_SCALE, rotationAnim, scaleAnim, translateXAnim, translateYAnim]);

  const renderUserMarker = () => {
    if (!userLocation) return null;
    const heading = getRouteHeading(userLocation, route);
    return (
      <Animated.View
        style={[
          styles.marker,
          styles.userMarker,
          {
            left: Animated.subtract(userXAnim, 14),
            top: Animated.subtract(userYAnim, 14),
            transform: [{ rotate: `${heading}deg` }],
          },
        ]}
      >
        <Svg width={28} height={28} viewBox="0 0 28 28">
          <Polygon
            points="14,2 26,24 14,20 2,24"
            fill="#4A90FF"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </Svg>
      </Animated.View>
    );
  };

  const renderDestinationMarker = () => {
    if (!destination) return null;
    const coords = toDisplayCoords(destination.x, destination.y);
    return (
      <View
        style={[
          styles.marker,
          styles.destinationMarker,
          { left: coords.x - 14, top: coords.y - 28 },
        ]}
      >
        <Ionicons name="location" size={28} color="#FF4D4D" />
      </View>
    );
  };

  const renderPOIMarkers = () => {
    if (!showMarkers) return null;
    return pois.map((poi) => {
      if (destination && poi.id === destination.id) return null;
      const coords = toDisplayCoords(poi.x, poi.y);
      return (
        <View
          key={poi.id}
          style={[
            styles.marker,
            styles.poiMarker,
            { left: coords.x - 8, top: coords.y - 8 },
          ]}
        />
      );
    });
  };

  const renderBeaconMarkers = () => {
    if (!showMarkers) return null;
    return beacons.map((beacon) => {
      const coords = toDisplayCoords(beacon.x, beacon.y);
      return (
        <View
          key={beacon.id}
          style={[
            styles.marker,
            styles.beaconMarker,
            { left: coords.x - 6, top: coords.y - 6 },
          ]}
        />
      );
    });
  };

  const renderRoute = () => {
    if (!route || route.length < 2) return null;
    if (!showRouteLine && !showRoutePoints) return null;
    
    const points = route
      .map((p) => {
        const coords = toDisplayCoords(p.x, p.y);
        return `${coords.x},${coords.y}`;
      })
      .join(' ');

    return (
      <View style={styles.routeContainer}>
        {showRouteLine && (
          <Svg width={displayWidth} height={displayHeight} style={styles.routeSvg}>
            <Polyline
              points={points}
              fill="none"
              stroke="#0B3D91"
              strokeWidth={4}
              strokeOpacity={1}
            />
          </Svg>
        )}
        {showRoutePoints && route.map((p, i) => {
          const coords = toDisplayCoords(p.x, p.y);
          return (
            <View
              key={`route-point-${i}`}
              style={[
                styles.routePoint,
                {
                  left: coords.x - 3,
                  top: coords.y - 3,
                  backgroundColor: p.type === 'start'
                    ? '#22C55E'
                    : p.type === 'destination'
                    ? '#FF6B6B'
                    : '#4ECDC4',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <RotationGestureHandler
        ref={rotationRef}
        simultaneousHandlers={pinchRef}
        onGestureEvent={handleRotation}
        onHandlerStateChange={handleRotationStateChange}
      >
        <PinchGestureHandler
          ref={pinchRef}
          simultaneousHandlers={rotationRef}
          onGestureEvent={handlePinch}
          onHandlerStateChange={handlePinchStateChange}
          minPointers={2}
        >
          <View
            style={styles.mapContainer}
            {...panResponder.panHandlers}
            onTouchStart={onInteractionStart}
            onTouchEnd={(event) => {
              onInteractionEnd?.();
              handleMapTap(event);
            }}
            onTouchCancel={onInteractionEnd}
          >
            <Animated.View
              style={[
                styles.mapContent,
                {
                  width: displayWidth,
                  height: displayHeight,
                  transform: [
                    { translateX: translateXAnim },
                    { translateY: translateYAnim },
                    { scale: scaleAnim },
                    {
                      rotate: rotationAnim.interpolate({
                        inputRange: [-360, 360],
                        outputRange: ['-360deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              {mapImage ? (
                <Image
                  source={{ uri: mapImage }}
                  style={[styles.mapImage, { width: displayWidth, height: displayHeight }]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.placeholderMap, { width: displayWidth, height: displayHeight }]}>
                  <View style={styles.gridOverlay}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <View key={`h-${i}`} style={[styles.gridLine, styles.gridLineHorizontal, { top: `${i * 10}%` }]} />
                    ))}
                    {Array.from({ length: 10 }).map((_, i) => (
                      <View key={`v-${i}`} style={[styles.gridLine, styles.gridLineVertical, { left: `${i * 10}%` }]} />
                    ))}
                  </View>
                </View>
              )}
              {renderRoute()}
              {renderBeaconMarkers()}
              {renderPOIMarkers()}
              {renderDestinationMarker()}
              {renderUserMarker()}
              {showDestinationMode && (
                <View style={styles.destinationModeOverlay}>
                  <Text style={styles.destinationModeText}>Tap to select destination</Text>
                </View>
              )}
            </Animated.View>
          </View>
        </PinchGestureHandler>
      </RotationGestureHandler>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  mapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContent: {
    position: 'relative',
  },
  mapImage: {
    borderRadius: 8,
  },
  placeholderMap: {
    backgroundColor: '#252542',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridLineHorizontal: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineVertical: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  marker: {
    position: 'absolute',
    zIndex: 10,
  },
  userMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiMarker: {
    width: 16,
    height: 16,
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  beaconMarker: {
    width: 12,
    height: 12,
    backgroundColor: '#A78BFA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  routeContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  routeSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  routePoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#ffffff',
    zIndex: 20,
  },
  destinationModeOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  destinationModeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
