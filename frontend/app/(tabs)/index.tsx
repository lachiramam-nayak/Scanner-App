import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IndoorMapViewer, IndoorMapViewerHandle } from '../../src/components/IndoorMapViewer';
import { IndoorTracker } from '../../src/services/indoorTracking';
import { FloorSelector } from '../../src/components/FloorSelector';
import { EmptyState } from '../../src/components/EmptyState';
import { ListSkeleton } from '../../src/components/SkeletonLoader';
import { useAppStore, Building, Floor, POI, Beacon } from '../../src/store/appStore';
import { buildingApi, floorApi, poiApi, beaconApi, navigationApi } from '../../src/services/api';
import { getTurnInstruction } from '../../src/utils/turnInstruction';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export default function MapScreen() {
  const router = useRouter();
  const {
    selectedBuilding,
    selectedFloor,
    selectedDestination,
    userLocation,
    setSelectedBuilding,
    setSelectedFloor,
    setSelectedDestination,
    setUserLocation,
    setLocationMode,
  } = useAppStore();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDestinations, setShowDestinations] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [navigationRoute, setNavigationRoute] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);
  const reroutingRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const offRouteHitsRef = useRef(0);
  const recentPositionsRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const nodeWrongDirHitsRef = useRef(0);
  const trackerRef = useRef<IndoorTracker | null>(null);
  const baseInfoRef = useRef<{ building_id: string; floor_id: string } | null>(null);
  const mapRef = useRef<IndoorMapViewerHandle | null>(null);

  const floorBuildingId = useMemo(() => {
    if (!selectedFloor) return undefined;
    const anyFloor = selectedFloor as any;
    return anyFloor.building_id ?? anyFloor.buildingId;
  }, [selectedFloor]);

  const loadData = useCallback(async () => {
    try {
      const buildingsData = await buildingApi.getAll();
      setBuildings(buildingsData);

      // If no building selected and we have buildings, select the first one
      if (!selectedBuilding && buildingsData.length > 0) {
        setSelectedBuilding(buildingsData[0]);
      }
    } catch (error) {
      console.error('Error loading buildings:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBuilding, setSelectedBuilding]);

  const loadFloors = useCallback(async () => {
    if (!selectedBuilding) {
      setFloors([]);
      return;
    }

    try {
      const floorsData = await floorApi.getAll(selectedBuilding.id);
      setFloors(floorsData);

      // If no floor selected and we have floors, select the first one
      if (!selectedFloor && floorsData.length > 0) {
        setSelectedFloor(floorsData[0]);
      } else if (selectedFloor && !floorsData.find(f => f.id === selectedFloor.id)) {
        // If selected floor no longer exists, select first floor
        setSelectedFloor(floorsData.length > 0 ? floorsData[0] : null);
      }
    } catch (error) {
      console.error('Error loading floors:', error);
    }
  }, [selectedBuilding, selectedFloor, setSelectedFloor]);

  const loadFloorData = useCallback(async () => {
    if (!selectedFloor) {
      setPois([]);
      setBeacons([]);
      return;
    }

    try {
      const [poisData, beaconData] = await Promise.all([
        poiApi.getAll(undefined, selectedFloor.id),
        beaconApi.getAll(undefined, selectedFloor.id),
      ]);
      setPois(poisData);
      setBeacons(beaconData);
    } catch (error) {
      console.error('Error loading floor data:', error);
    }
  }, [selectedFloor]);

  const computeRoute = useCallback(async (
    force = false,
    overrideDestination?: POI,
    overrideStart?: { x: number; y: number }
  ) => {
    const destination = overrideDestination ?? selectedDestination;
    if (!destination || !selectedFloor) {
      return;
    }
    const hasStart = !!overrideStart || !!userLocation;
    if (!hasStart) return;
    if (
      userLocation &&
      userLocation.floor_id !== selectedFloor.id ||
      destination.floor_id !== selectedFloor.id
    ) {
      return;
    }
    const routeKey = `${selectedFloor.id}|${destination.id}|${destination.x}|${destination.y}`;
    if (!force && navigationRoute?.route && navigationRoute.__key === routeKey) {
      return;
    }
    if (force) {
      const now = Date.now();
      if (now - lastRerouteAtRef.current < 3000) {
        return;
      }
      lastRerouteAtRef.current = now;
    }
    try {
      if (force && trackerRef.current) {
        reroutingRef.current = true;
        trackerRef.current.stopSensors();
      }
      const startX = overrideStart?.x ?? userLocation!.x;
      const startY = overrideStart?.y ?? userLocation!.y;
      if (force) {
        console.log('[REROUTE] Triggered', {
          startX,
          startY,
          destinationId: destination.id,
          destinationX: destination.x,
          destinationY: destination.y,
          floorId: selectedFloor.id,
        });
      }
      const route = await navigationApi.computeRoute({
        buildingId: floorBuildingId,
        floorId: selectedFloor.id,
        startX,
        startY,
        destX: destination.x,
        destY: destination.y,
      });
      if (route?.route && route.route.length > 1) {
        setNavigationRoute({ ...route, __key: routeKey });
        if (force) {
          const firstPoint = route.route[0];
          console.log('[REROUTE] New route ready', {
            routePoints: route.route.length,
            firstPointX: firstPoint?.x,
            firstPointY: firstPoint?.y,
          });
        }
        if (force) {
          setRerouteNotice('Going off the route. Recomputing...');
          setTimeout(() => setRerouteNotice(null), 1800);
        }
      }
    } catch (error) {
      console.error('Error computing route:', error);
    } finally {
      if (force && trackerRef.current) {
        reroutingRef.current = false;
        trackerRef.current.startSensors();
      }
    }
  }, [userLocation, selectedDestination, selectedFloor, navigationRoute, floorBuildingId]);

  const effectiveRoute = useMemo(() => {
    if (navigationRoute?.route && navigationRoute.route.length > 0) {
      if (
        userLocation &&
        selectedFloor &&
        userLocation.floor_id === selectedFloor.id &&
        navigationRoute.route.length >= 2
      ) {
        return buildRemainingRouteFromPosition(
          navigationRoute.route as Array<{ x: number; y: number; type?: string }>,
          userLocation.x,
          userLocation.y
        );
      }
      return navigationRoute.route;
    }
    return [];
  }, [navigationRoute, userLocation, selectedFloor]);

  const displayedRoute = useMemo(() => {
    if (!effectiveRoute || effectiveRoute.length === 0) {
      return undefined;
    }
    return effectiveRoute;
  }, [effectiveRoute]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadFloors();
  }, [loadFloors]);

  useEffect(() => {
    loadFloorData();
  }, [loadFloorData]);

  useEffect(() => {
    if (!trackerRef.current) {
      trackerRef.current = new IndoorTracker();
    }
    trackerRef.current.setPositionCallback((pos) => {
      const base = baseInfoRef.current;
      if (!base) return;
      setUserLocation({
        building_id: base.building_id,
        floor_id: base.floor_id,
        x: pos.x,
        y: pos.y,
        source: pos.source,
        timestamp: pos.timestamp,
      });
      setLocationMode(pos.source);
    });
    trackerRef.current.setDeviationCallback(() => {
      setNavigationRoute(null);
      setRerouteNotice('Going off the route. Recomputing...');
      setTimeout(() => setRerouteNotice(null), 1800);
      if (userLocation) {
        computeRoute(true, undefined, { x: userLocation.x, y: userLocation.y });
      } else {
        computeRoute(true);
      }
    });
  }, [computeRoute, setLocationMode, setUserLocation, userLocation]);

  useEffect(() => {
    if (!trackerRef.current || !selectedFloor) return;
    trackerRef.current.setConfig({
      scanIntervalMs: 500,
      stepLengthM: 1.0,
      minStepPx: 80,
      rssiThreshold: -100,
      kalmanProcessNoise: 0.01,
      kalmanMeasurementNoise: 2,
      deviationThresholdM: 2,
      snapToleranceM: 1.5,
      n: 2.5,
    });
    trackerRef.current.setBeacons(beacons);
    const floorAny = selectedFloor as any;
    const mapWidthPx = Number.isFinite(Number(floorAny.width)) && Number(floorAny.width) > 0
      ? Number(floorAny.width)
      : 1;
    const mapHeightPx = Number.isFinite(Number(floorAny.height)) && Number(floorAny.height) > 0
      ? Number(floorAny.height)
      : 1;
    const floorScale = Number(floorAny.scale);
    const realWidthM = Number.isFinite(floorScale) && floorScale > 0
      ? mapWidthPx / floorScale
      : mapWidthPx;
    const realHeightM = Number.isFinite(floorScale) && floorScale > 0
      ? mapHeightPx / floorScale
      : mapHeightPx;
    trackerRef.current.setRoute(
      displayedRoute ? displayedRoute.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })) : [],
      mapWidthPx,
      mapHeightPx,
      realWidthM,
      realHeightM
    );
  }, [beacons, displayedRoute, selectedFloor]);

  useEffect(() => {
    if (!trackerRef.current) return;
    if (reroutingRef.current) {
      trackerRef.current.stopSensors();
      return;
    }
    if (userLocation && selectedFloor && userLocation.floor_id === selectedFloor.id) {
      if (userLocation.source !== 'sensor') {
        baseInfoRef.current = {
          building_id: userLocation.building_id,
          floor_id: userLocation.floor_id,
        };
        trackerRef.current.setAnchorPosition(userLocation.x, userLocation.y);
      }
      trackerRef.current.startSensors();
    } else {
      trackerRef.current.stopSensors();
    }
    return () => {
      trackerRef.current?.stopSensors();
    };
  }, [userLocation, selectedFloor]);

  useEffect(() => {
    if (!userLocation || !selectedFloor || !selectedDestination || !navigationRoute?.route?.length) return;
    if (userLocation.floor_id !== selectedFloor.id) return;
    if (selectedDestination.floor_id !== selectedFloor.id) return;

    const routePts = navigationRoute.route as Array<{ x: number; y: number }>;
    if (!routePts || routePts.length < 2) return;

    const nowTs = Date.now();
    const nextSamples = recentPositionsRef.current
      .filter((p) => nowTs - p.t <= 3500)
      .concat({ x: userLocation.x, y: userLocation.y, t: nowTs })
      .slice(-8);
    recentPositionsRef.current = nextSamples;

    const nodeDir = evaluateNodeDirectionMismatch(routePts, nextSamples, userLocation.x, userLocation.y);
    if (nodeDir.nearNode) {
      console.log('[NODE_DIRECTION_CHECK]', nodeDir);
      if (nodeDir.wrongDirection) {
        nodeWrongDirHitsRef.current += 1;
      } else {
        nodeWrongDirHitsRef.current = 0;
      }
      if (nodeWrongDirHitsRef.current >= 2) {
        nodeWrongDirHitsRef.current = 0;
        offRouteHitsRef.current = 0;
        setNavigationRoute(null);
        setRerouteNotice('Going off the route. Recomputing...');
        setTimeout(() => setRerouteNotice(null), 1800);
        console.log('[NODE_OFF_ROUTE_REROUTE]', {
          rerouteFromX: userLocation.x,
          rerouteFromY: userLocation.y,
        });
        computeRoute(true, undefined, { x: userLocation.x, y: userLocation.y });
        return;
      }
    } else {
      nodeWrongDirHitsRef.current = 0;
    }

    const thresholdPx = 160;
    const distanceToRoutePx = getDistanceToRoutePx(userLocation.x, userLocation.y, routePts);
    console.log('[OFF_ROUTE_CHECK]', {
      x: userLocation.x,
      y: userLocation.y,
      floorId: userLocation.floor_id,
      distanceToRoutePx,
      thresholdPx,
    });

    if (distanceToRoutePx > thresholdPx) {
      offRouteHitsRef.current += 1;
      console.log('[OFF_ROUTE_DETECTED]', {
        x: userLocation.x,
        y: userLocation.y,
        hits: offRouteHitsRef.current,
      });
    } else {
      offRouteHitsRef.current = 0;
    }

    if (offRouteHitsRef.current >= 1) {
      offRouteHitsRef.current = 0;
      setNavigationRoute(null);
      setRerouteNotice('Going off the route. Recomputing...');
      setTimeout(() => setRerouteNotice(null), 1800);
      console.log('[REROUTE_START_POINT]', {
        rerouteFromX: userLocation.x,
        rerouteFromY: userLocation.y,
      });
      computeRoute(true, undefined, { x: userLocation.x, y: userLocation.y });
    }
  }, [
    userLocation?.x,
    userLocation?.y,
    userLocation?.floor_id,
    selectedFloor?.id,
    selectedDestination?.id,
    selectedDestination?.floor_id,
    navigationRoute?.route,
    computeRoute,
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadFloors();
    await loadFloorData();
    setRefreshing(false);
  };

  const handleSelectDestination = (poi: POI) => {
    setSelectedDestination(poi);
    setShowDestinations(false);
    setDestinationQuery('');
    setNavigationRoute(null);
    setRerouteNotice(null);
    offRouteHitsRef.current = 0;
  };

  const handleClearDestination = () => {
    setSelectedDestination(null);
    setNavigationRoute(null);
    setRerouteNotice(null);
    offRouteHitsRef.current = 0;
  };

  const turnInstruction = useMemo(() => {
    return getTurnInstruction(userLocation, displayedRoute);
  }, [userLocation, displayedRoute]);

  const handleNavigate = async () => {
    if (!userLocation || !selectedDestination || !selectedFloor) {
      Alert.alert('Error', 'Please set your location and destination');
      return;
    }
    if (userLocation.floor_id !== selectedFloor.id) {
      Alert.alert('Error', 'Your location is on a different floor');
      return;
    }

    try {
      setIsNavigating(true);
      offRouteHitsRef.current = 0;
      const route = await navigationApi.computeRoute({
        buildingId: floorBuildingId,
        floorId: selectedFloor.id,
        startX: userLocation.x,
        startY: userLocation.y,
        destX: selectedDestination.x,
        destY: selectedDestination.y,
      });
      const routeKey = `${selectedFloor.id}|${selectedDestination.id}|${selectedDestination.x}|${selectedDestination.y}`;
      setNavigationRoute({ ...route, __key: routeKey });
    } catch (error) {
      Alert.alert('Error', 'Failed to compute route');
    } finally {
      setIsNavigating(false);
    }
  };

  const parseCoordinates = (input: string): { x: number; y: number } | null => {
    const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
  };

  const filteredPois = destinationQuery.trim()
    ? pois.filter((poi) => {
        const q = destinationQuery.trim().toLowerCase();
        return (
          poi.name.toLowerCase().includes(q) ||
          (poi.category || '').toLowerCase().includes(q)
        );
      })
    : pois;

  const coordinateSuggestion = parseCoordinates(destinationQuery);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.content}>
          <ListSkeleton count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (buildings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <EmptyState
          icon="business-outline"
          title="No Buildings"
          message="Add a building to start setting up indoor navigation."
          actionLabel="Add Building"
          onAction={() => router.push('/(tabs)/buildings')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {!!rerouteNotice && (
        <View style={styles.turnPromptScreen} pointerEvents="none">
          <Text style={styles.turnPromptText}>{rerouteNotice}</Text>
        </View>
      )}
      {!rerouteNotice && !!turnInstruction && !showDestinations && (
        <View style={styles.turnPromptScreen} pointerEvents="none">
          <Text style={styles.turnPromptText}>{turnInstruction}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        scrollEnabled={!mapInteracting}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4A90FF"
          />
        }
      >
        {/* Building Selector */}
        <View style={styles.buildingSelector}>
          <TouchableOpacity
            style={styles.buildingButton}
            onPress={() => {
              Alert.alert(
                'Select Building',
                undefined,
                buildings.map((b) => ({
                  text: b.name,
                  onPress: () => setSelectedBuilding(b),
                }))
              );
            }}
          >
            <Ionicons name="business" size={20} color="#4A90FF" />
            <Text style={styles.buildingName}>
              {selectedBuilding?.name || 'Select Building'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Floor Selector */}
        <FloorSelector
          floors={floors}
          selectedFloor={selectedFloor}
          onSelectFloor={setSelectedFloor}
        />

        {/* Destination Selector */}
        {selectedFloor && (
          <View style={styles.destinationSection}>
            <TouchableOpacity
              style={styles.destinationButton}
              onPress={() => setShowDestinations(!showDestinations)}
            >
              <View style={styles.destinationLeft}>
                <Ionicons name="flag-outline" size={20} color="#FF6B6B" />
                <Text style={styles.destinationText}>
                  {selectedDestination
                    ? selectedDestination.name
                    : 'Select Destination'}
                </Text>
              </View>
              {selectedDestination ? (
                <TouchableOpacity onPress={handleClearDestination}>
                  <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                </TouchableOpacity>
              ) : (
                <Ionicons
                  name={showDestinations ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#888"
                />
              )}
            </TouchableOpacity>

            <View style={styles.destinationSearchRow}>
              <Ionicons name="search-outline" size={18} color="#888" />
              <TextInput
                style={styles.destinationSearchInput}
                placeholder="Search destination or type x,y"
                placeholderTextColor="#666"
                value={destinationQuery}
                onChangeText={setDestinationQuery}
              />
              {!!destinationQuery && (
                <TouchableOpacity onPress={() => setDestinationQuery('')}>
                  <Ionicons name="close-circle" size={18} color="#888" />
                </TouchableOpacity>
              )}
            </View>

            {(showDestinations || destinationQuery.trim().length > 0) && (
              <View style={styles.destinationList}>
                {coordinateSuggestion && selectedFloor && (
                  <TouchableOpacity
                    style={styles.destinationItem}
                    onPress={() =>
                      handleSelectDestination({
                        id: 'temp-destination',
                        building_id: selectedFloor.building_id,
                        floor_id: selectedFloor.id,
                        name: `Custom (${coordinateSuggestion.x}, ${coordinateSuggestion.y})`,
                        category: 'destination',
                        x: coordinateSuggestion.x,
                        y: coordinateSuggestion.y,
                        created_at: new Date().toISOString(),
                      } as POI)
                    }
                  >
                    <Ionicons name="pin-outline" size={20} color="#FF6B6B" />
                    <View style={styles.destinationItemInfo}>
                      <Text style={styles.destinationItemName}>
                        Use coordinates ({coordinateSuggestion.x}, {coordinateSuggestion.y})
                      </Text>
                      <Text style={styles.destinationItemCategory}>Custom destination</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {filteredPois.length === 0 && (
                  <View style={styles.emptyDestinationRow}>
                    <Text style={styles.emptyDestinationText}>No destinations found</Text>
                  </View>
                )}

                {filteredPois.map((poi) => (
                  <TouchableOpacity
                    key={poi.id}
                    style={styles.destinationItem}
                    onPress={() => handleSelectDestination(poi)}
                  >
                    <Ionicons
                      name={getCategoryIcon(poi.category)}
                      size={20}
                      color="#4ECDC4"
                    />
                    <View style={styles.destinationItemInfo}>
                      <Text style={styles.destinationItemName}>{poi.name}</Text>
                      <Text style={styles.destinationItemCategory}>
                        {poi.category}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {selectedFloor && (
          <View style={styles.mapControls}>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={() => mapRef.current?.rotateBy(-90)}
            >
              <Text style={styles.mapControlText}>Rotate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={() => mapRef.current?.resetView()}
            >
              <Text style={styles.mapControlText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={() => mapRef.current?.zoomBy(0.25)}
            >
              <Text style={styles.mapControlText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapControlButton}
              onPress={() => mapRef.current?.zoomBy(-0.25)}
            >
              <Text style={styles.mapControlText}>−</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Indoor Map */}
        {selectedFloor ? (
          <View style={styles.mapSection}>
            <IndoorMapViewer
              ref={mapRef}
              mapImage={
                selectedFloor.mapImageUrl
                  ? `${API_URL}${selectedFloor.mapImageUrl}`
                  : selectedFloor.map_image || selectedFloor.mapImage
              }
              mapWidth={selectedFloor.width}
              mapHeight={selectedFloor.height}
              userLocation={
                userLocation?.floor_id === selectedFloor.id ? userLocation : null
              }
              destination={
                selectedDestination?.floor_id === selectedFloor.id
                  ? selectedDestination
                  : null
              }
              route={displayedRoute}
              pois={pois}
              beacons={beacons}
              showMarkers={true}
              showRoutePoints={false}
              showRouteLine={true}
              showTurnPrompt={false}
              onInteractionStart={() => setMapInteracting(true)}
              onInteractionEnd={() => setMapInteracting(false)}
            />
          </View>
        ) : (
          <EmptyState
            icon="map-outline"
            title="No Floors"
            message="Add floors to this building to view the indoor map."
            actionLabel="Manage Floors"
            onAction={() =>
              selectedBuilding &&
              router.push(`/building/${selectedBuilding.id}`)
            }
          />
        )}

        {selectedFloor &&
          selectedDestination &&
          userLocation &&
          userLocation.floor_id === selectedFloor.id && (
            <View style={styles.navigationCta}>
              <TouchableOpacity
                style={styles.navigateButton}
                onPress={handleNavigate}
                disabled={isNavigating}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.navigateButtonText}>
                  {isNavigating ? 'Routing...' : 'Navigate'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

      </ScrollView>
    </SafeAreaView>
  );
}

function getDistanceToRoutePx(x: number, y: number, route: Array<{ x: number; y: number }>) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const d = distancePointToSegmentPx(x, y, a.x, a.y, b.x, b.y);
    if (d < best) best = d;
  }
  return best;
}

function evaluateNodeDirectionMismatch(
  route: Array<{ x: number; y: number }>,
  samples: Array<{ x: number; y: number; t: number }>,
  x: number,
  y: number
) {
  if (!route || route.length < 3 || !samples || samples.length < 2) {
    return { nearNode: false, wrongDirection: false };
  }

  // consider only interior nodes for branch/turn decisions
  let closestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 1; i < route.length - 1; i += 1) {
    const dx = x - route[i].x;
    const dy = y - route[i].y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) {
      bestDist = d;
      closestIdx = i;
    }
  }
  const nodeRadiusPx = 28;
  if (closestIdx < 0 || bestDist > nodeRadiusPx) {
    return { nearNode: false, wrongDirection: false };
  }

  const latest = samples[samples.length - 1];
  let anchor = samples[0];
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    const dx = latest.x - samples[i].x;
    const dy = latest.y - samples[i].y;
    if (Math.sqrt(dx * dx + dy * dy) >= 8) {
      anchor = samples[i];
      break;
    }
  }

  const mvx = latest.x - anchor.x;
  const mvy = latest.y - anchor.y;
  const moveMag = Math.sqrt(mvx * mvx + mvy * mvy);
  if (moveMag < 8) {
    return { nearNode: true, wrongDirection: false, nodeIndex: closestIdx, reason: 'low_movement' };
  }

  const next = route[closestIdx + 1];
  const cur = route[closestIdx];
  const evx = next.x - cur.x;
  const evy = next.y - cur.y;
  const expMag = Math.sqrt(evx * evx + evy * evy);
  if (expMag < 1e-6) {
    return { nearNode: true, wrongDirection: false, nodeIndex: closestIdx, reason: 'degenerate_segment' };
  }

  const dot = mvx * evx + mvy * evy;
  const cos = Math.max(-1, Math.min(1, dot / (moveMag * expMag)));
  const angleDeg = (Math.acos(cos) * 180) / Math.PI;
  const wrongDirection = angleDeg > 55;

  return {
    nearNode: true,
    wrongDirection,
    nodeIndex: closestIdx,
    nodeDistancePx: bestDist,
    headingErrorDeg: angleDeg,
    movementPx: moveMag,
  };
}

function buildRemainingRouteFromPosition(
  route: Array<{ x: number; y: number; type?: string }>,
  x: number,
  y: number
) {
  if (!route || route.length < 2) return route || [];
  let bestDist = Number.POSITIVE_INFINITY;
  let bestIdx = 0;
  let bestT = 0;
  let bestX = route[0].x;
  let bestY = route[0].y;

  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const proj = projectPointToSegmentWithT(x, y, a.x, a.y, b.x, b.y);
    if (proj.dist < bestDist) {
      bestDist = proj.dist;
      bestIdx = i;
      bestT = proj.t;
      bestX = proj.x;
      bestY = proj.y;
    }
  }

  const remaining = route.slice(bestIdx + 1).map((p) => ({ ...p, type: p.type || 'waypoint' }));
  const startPoint = { x: bestX, y: bestY, type: 'start' as const };
  if (remaining.length === 0) return [startPoint];
  if (bestT >= 0.999) {
    return [{ ...remaining[0], type: 'start' }, ...remaining.slice(1)];
  }
  return [startPoint, ...remaining];
}

function distancePointToSegmentPx(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ddx = px - x1;
    const ddy = py - y1;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projX = x1 + clamped * dx;
  const projY = y1 + clamped * dy;
  const ddx = px - projX;
  const ddy = py - projY;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

function projectPointToSegmentWithT(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const ddx = px - x1;
    const ddy = py - y1;
    return { x: x1, y: y1, t: 0, dist: Math.sqrt(ddx * ddx + ddy * ddy) };
  }
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projX = x1 + clamped * dx;
  const projY = y1 + clamped * dy;
  const ddx = px - projX;
  const ddy = py - projY;
  return { x: projX, y: projY, t: clamped, dist: Math.sqrt(ddx * ddx + ddy * ddy) };
}

function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case 'room':
      return 'cube-outline';
    case 'elevator':
      return 'swap-vertical-outline';
    case 'stairs':
      return 'trending-up-outline';
    case 'restroom':
      return 'man-outline';
    case 'exit':
      return 'exit-outline';
    default:
      return 'location-outline';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  buildingSelector: {
    marginBottom: 12,
  },
  buildingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  buildingName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapSection: {
    height: 400,
    marginBottom: 16,
  },
  destinationSection: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  destinationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  destinationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destinationText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  destinationList: {
    borderTopWidth: 1,
    borderTopColor: '#252542',
  },
  destinationSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#252542',
  },
  destinationSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  mapControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  mapControlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingVertical: 8,
  },
  mapControlText: {
    color: '#0B3D91',
    fontSize: 13,
    fontWeight: '700',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 6,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  navigationCta: {
    marginBottom: 16,
  },
  turnPromptScreen: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderRadius: 999,
    zIndex: 50,
  },
  turnPromptText: {
    color: '#0B3D91',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  destinationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#252542',
  },
  destinationItemInfo: {
    flex: 1,
  },
  destinationItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  destinationItemCategory: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  emptyDestinationRow: {
    padding: 12,
  },
  emptyDestinationText: {
    color: '#888',
    fontSize: 12,
  },
});
