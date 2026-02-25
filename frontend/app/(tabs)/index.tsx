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
  const [fixedRoute, setFixedRoute] = useState<Array<{ x: number; y: number; type: string }> | null>(null);
  const [fixedRouteKey, setFixedRouteKey] = useState<string | null>(null);
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

  const computeRoute = useCallback(async () => {
    if (!userLocation || !selectedDestination || !selectedFloor) {
      return;
    }
    if (
      userLocation.floor_id !== selectedFloor.id ||
      selectedDestination.floor_id !== selectedFloor.id
    ) {
      return;
    }
    const routeKey = `${selectedFloor.id}|${selectedDestination.id}`;
    if (navigationRoute?.route && navigationRoute.__key === routeKey) {
      return;
    }
    try {
      const route = await navigationApi.computeRoute({
        buildingId: floorBuildingId,
        floorId: selectedFloor.id,
        startX: userLocation.x,
        startY: userLocation.y,
        destX: selectedDestination.x,
        destY: selectedDestination.y,
      });
      if (route?.route && route.route.length > 1) {
        setNavigationRoute({ ...route, __key: routeKey });
        setFixedRoute(route.route || []);
        setFixedRouteKey(routeKey);
      }
    } catch (error) {
      console.error('Error computing route:', error);
    }
  }, [userLocation, selectedDestination, selectedFloor, navigationRoute, floorBuildingId]);

  const effectiveRoute = useMemo(() => {
    const routeKey = selectedFloor && selectedDestination
      ? `${selectedFloor.id}|${selectedDestination.id}`
      : null;
    if (fixedRoute && fixedRouteKey && fixedRouteKey === routeKey && fixedRoute.length > 0) {
      return fixedRoute;
    }
    if (navigationRoute?.route && navigationRoute.route.length > 0) {
      return navigationRoute.route;
    }
    if (
      userLocation &&
      selectedDestination &&
      selectedFloor &&
      userLocation.floor_id === selectedFloor.id &&
      selectedDestination.floor_id === selectedFloor.id
    ) {
      return [
        { x: userLocation.x, y: userLocation.y, type: 'start' },
        { x: selectedDestination.x, y: selectedDestination.y, type: 'destination' },
      ];
    }
    return [];
  }, [fixedRoute, fixedRouteKey, navigationRoute, userLocation, selectedDestination, selectedFloor]);

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
    computeRoute();
  }, [computeRoute]);

  useEffect(() => {
    if (!trackerRef.current) {
      trackerRef.current = new IndoorTracker();
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
        computeRoute();
      });
    }
  }, [computeRoute, setLocationMode, setUserLocation]);

  useEffect(() => {
    if (!trackerRef.current || !selectedFloor) return;
    trackerRef.current.setConfig({
      scanIntervalMs: 500,
      stepLengthM: 0.7,
      rssiThreshold: -100,
      kalmanProcessNoise: 0.01,
      kalmanMeasurementNoise: 2,
      deviationThresholdM: 2,
      snapToleranceM: 1.5,
      n: 2.5,
    });
    trackerRef.current.setBeacons(beacons);
    trackerRef.current.setRoute(
      displayedRoute ? displayedRoute.map((p) => ({ x: p.x, y: p.y })) : [],
      selectedFloor.scale || 10
    );
  }, [beacons, displayedRoute, selectedFloor]);

  useEffect(() => {
    if (!trackerRef.current) return;
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
    setFixedRoute(null);
    setFixedRouteKey(null);
  };

  const handleClearDestination = () => {
    setSelectedDestination(null);
    setNavigationRoute(null);
    setFixedRoute(null);
    setFixedRouteKey(null);
  };

  const displayedRoute = useMemo(() => {
    if (!effectiveRoute || effectiveRoute.length === 0) {
      return undefined;
    }
    return effectiveRoute;
  }, [effectiveRoute]);

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
      const route = await navigationApi.computeRoute({
        buildingId: floorBuildingId,
        floorId: selectedFloor.id,
        startX: userLocation.x,
        startY: userLocation.y,
        destX: selectedDestination.x,
        destY: selectedDestination.y,
      });
      setNavigationRoute(route);
      if (selectedFloor && selectedDestination) {
        const routeKey = `${selectedFloor.id}|${selectedDestination.id}`;
        setFixedRoute(route.route || []);
        setFixedRouteKey(routeKey);
      }
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
      {!!turnInstruction && !showDestinations && (
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
