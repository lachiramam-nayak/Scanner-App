import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

import { IndoorMapViewer } from '../../src/components/IndoorMapViewer';
import { EmptyState } from '../../src/components/EmptyState';
import { ListSkeleton } from '../../src/components/SkeletonLoader';
import { Floor, Beacon, POI, UserLocation } from '../../src/store/appStore';
import { floorApi, beaconApi, poiApi, navigationApi } from '../../src/services/api';
import { useBeaconScanner } from '../../src/hooks/useBeaconScanner';
import { useAppStore } from '../../src/store/appStore';
import { getTurnInstruction } from '../../src/utils/turnInstruction';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type TabType = 'map' | 'beacons' | 'pois';

const POI_CATEGORIES = ['room', 'elevator', 'stairs', 'restroom', 'exit', 'other'];

export default function FloorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [floor, setFloor] = useState<Floor | null>(null);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('map');

  // Beacon modal
  const [beaconModalVisible, setBeaconModalVisible] = useState(false);
  const [beaconForm, setBeaconForm] = useState({
    uuid: '',
    major: 1,
    minor: 1,
    x: 0,
    y: 0,
    label: '',
  });

  // POI modal
  const [poiModalVisible, setPoiModalVisible] = useState(false);
  const [poiForm, setPoiForm] = useState({
    name: '',
    category: 'room',
    x: 0,
    y: 0,
    description: '',
  });

  // Beacon scanning and navigation
  const {
    isScanning: isBeaconScanning,
    scannerStatus,
    scannedBeacons,
    currentPosition,
    isPositioning,
    positionError,
    startScanning: startBeaconScanning,
    stopScanning: stopBeaconScanning,
    navigateTo,
  } = useBeaconScanner();

  const { setUserLocation, setLocationMode, userLocation } = useAppStore();

  const [selectedDestination, setSelectedDestination] = useState<POI | null>(null);
  const [navigationRoute, setNavigationRoute] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showDestinationMode, setShowDestinationMode] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const turnInstruction = getTurnInstruction(userLocation, navigationRoute?.route);

  // Update user location when position changes
  useEffect(() => {
    if (currentPosition && currentPosition.valid && currentPosition.floorId === id) {
      setUserLocation({
        building_id: currentPosition.buildingId,
        floor_id: currentPosition.floorId,
        x: currentPosition.x,
        y: currentPosition.y,
        source: 'beacon',
        timestamp: new Date(),
      });
      setLocationMode('beacon');
    }
  }, [currentPosition, id]);

  const handleStartBeaconScanning = async () => {
    const success = await startBeaconScanning({ batchInterval: 2000, rssiThreshold: -100 });
    if (!success && Platform.OS !== 'web') {
      Alert.alert('Beacon Scanning Failed', scannerStatus.error || 'Could not start Bluetooth scanning. Please check permissions and try again.');
    }
  };

  const handleStopBeaconScanning = () => {
    stopBeaconScanning();
    setNavigationRoute(null);
  };

  const handleMapPress = (x: number, y: number) => {
    if (showDestinationMode) {
      // Find or create POI at this location
      const existingPoi = pois.find(p => Math.abs(p.x - x) < 20 && Math.abs(p.y - y) < 20);
      if (existingPoi) {
        setSelectedDestination(existingPoi);
      } else {
        // Create a temporary destination
        setSelectedDestination({
          id: 'temp',
          building_id: floor?.building_id || '',
          floor_id: id || '',
          name: 'Custom Destination',
          category: 'destination',
          x,
          y,
          created_at: new Date().toISOString(),
        } as POI);
      }
      setShowDestinationMode(false);
    }
  };

  const handleSelectDestination = (poi: POI) => {
    setSelectedDestination(poi);
    setDestinationQuery('');
    setShowDestinationMode(false);
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

  const handleNavigate = async () => {
    if (!userLocation || !selectedDestination || !currentPosition) {
      Alert.alert('Error', 'Please ensure position is found and destination is selected');
      return;
    }

    try {
      setIsNavigating(true);
      const route = await navigateTo(selectedDestination.x, selectedDestination.y);
      if (route) {
        setNavigationRoute(route);
      } else {
        Alert.alert('Error', 'Failed to compute navigation route');
      }
    } catch (error) {
      Alert.alert('Error', 'Navigation error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsNavigating(false);
    }
  };

  const loadFloor = useCallback(async () => {
    if (!id) return;
    try {
      const data = await floorApi.getById(id);
      setFloor(data);
    } catch (error) {
      console.error('Error loading floor:', error);
      Alert.alert('Error', 'Failed to load floor');
    }
  }, [id]);

  const loadBeacons = useCallback(async () => {
    if (!id) return;
    try {
      const data = await beaconApi.getAll(undefined, id);
      setBeacons(data);
    } catch (error) {
      console.error('Error loading beacons:', error);
    }
  }, [id]);

  const loadPois = useCallback(async () => {
    if (!id) return;
    try {
      const data = await poiApi.getAll(undefined, id);
      setPois(data);
    } catch (error) {
      console.error('Error loading POIs:', error);
    }
  }, [id]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFloor(), loadBeacons(), loadPois()]);
    setLoading(false);
  }, [loadFloor, loadBeacons, loadPois]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Beacon handlers
  const openBeaconModal = () => {
    setBeaconForm({
      uuid: '',
      major: 1,
      minor: beacons.length + 1,
      x: floor?.width ? floor.width / 2 : 500,
      y: floor?.height ? floor.height / 2 : 400,
      label: '',
    });
    setBeaconModalVisible(true);
  };

  const handleSaveBeacon = async () => {
    if (!floor) return;
    if (!beaconForm.uuid.trim()) {
      Alert.alert('Error', 'UUID is required');
      return;
    }
    try {
      await beaconApi.create({
        building_id: floor.building_id,
        floor_id: floor.id,
        ...beaconForm,
      });
      setBeaconModalVisible(false);
      loadBeacons();
    } catch (error) {
      console.error('Error creating beacon:', error);
      Alert.alert('Error', 'Failed to create beacon');
    }
  };

  const handleDeleteBeacon = (beacon: Beacon) => {
    Alert.alert('Delete Beacon', `Delete beacon "${beacon.label || beacon.uuid}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await beaconApi.delete(beacon.id);
            loadBeacons();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete beacon');
          }
        },
      },
    ]);
  };

  // POI handlers
  const openPOIModal = () => {
    setPoiForm({
      name: '',
      category: 'room',
      x: floor?.width ? floor.width / 2 : 500,
      y: floor?.height ? floor.height / 2 : 400,
      description: '',
    });
    setPoiModalVisible(true);
  };

  const handleSavePOI = async () => {
    if (!floor) return;
    if (!poiForm.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      await poiApi.create({
        building_id: floor.building_id,
        floor_id: floor.id,
        ...poiForm,
      });
      setPoiModalVisible(false);
      loadPois();
    } catch (error) {
      console.error('Error creating POI:', error);
      Alert.alert('Error', 'Failed to create POI');
    }
  };

  const handleDeletePOI = (poi: POI) => {
    Alert.alert('Delete POI', `Delete "${poi.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await poiApi.delete(poi.id);
            loadPois();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete POI');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <Stack.Screen options={{ headerTitle: 'Loading...' }} />
        <View style={styles.content}>
          <ListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!floor) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <Stack.Screen options={{ headerTitle: 'Not Found' }} />
        <EmptyState
          icon="alert-circle-outline"
          title="Floor Not Found"
          message="This floor may have been deleted."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const renderTabs = () => (
    <View style={styles.tabs}>
      {(['map', 'beacons', 'pois'] as TabType[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Ionicons
            name={
              tab === 'map'
                ? 'map-outline'
                : tab === 'beacons'
                ? 'bluetooth-outline'
                : 'location-outline'
            }
            size={18}
            color={activeTab === tab ? '#4A90FF' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'map' ? 'Map' : tab === 'beacons' ? `Beacons (${beacons.length})` : `POIs (${pois.length})`}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'map':
        return (
          <View style={styles.mapSection}>
            {/* Beacon Scanning Panel */}
            {Platform.OS !== 'web' && (
              <View style={styles.scanPanel}>
                {isBeaconScanning ? (
                  <View>
                    <View style={styles.scanningStatus}>
                      <ActivityIndicator size="small" color="#4ADE80" />
                      <Text style={styles.scanningText}>Scanning for beacons...</Text>
                    </View>
                    {scannedBeacons.length > 0 && (
                      <Text style={styles.beaconCount}>Found: {scannedBeacons.length} beacon(s)</Text>
                    )}
                    {currentPosition && currentPosition.valid && currentPosition.floorId === id && (
                      <View style={styles.positionFound}>
                        <Ionicons name="location" size={16} color="#4ADE80" />
                        <Text style={styles.positionText}>
                          Position: ({currentPosition.x.toFixed(1)}, {currentPosition.y.toFixed(1)})
                        </Text>
                      </View>
                    )}
                    {positionError && <Text style={styles.errorText}>{positionError}</Text>}
                  </View>
                ) : (
                  <Text style={styles.scanInactiveText}>Beacon scanning inactive</Text>
                )}
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.scanBtn, isBeaconScanning && styles.scanBtnActive]}
                    onPress={isBeaconScanning ? handleStopBeaconScanning : handleStartBeaconScanning}
                  >
                    <Ionicons name={isBeaconScanning ? 'stop-circle' : 'bluetooth'} size={18} color="#fff" />
                    <Text style={styles.scanBtnText}>{isBeaconScanning ? 'Stop Scan' : 'Start Scan'}</Text>
                  </TouchableOpacity>
                  {currentPosition && currentPosition.valid && (
                    <TouchableOpacity
                      style={[styles.destBtn, showDestinationMode && styles.destBtnActive]}
                      onPress={() => setShowDestinationMode(!showDestinationMode)}
                    >
                      <Ionicons name="location-outline" size={18} color="#fff" />
                      <Text style={styles.scanBtnText}>{showDestinationMode ? 'Cancel' : 'Set Dest'}</Text>
                    </TouchableOpacity>
                  )}
                  {selectedDestination && currentPosition && currentPosition.valid && (
                    <TouchableOpacity style={styles.navBtn} onPress={handleNavigate} disabled={isNavigating}>
                      <Ionicons name="navigate" size={18} color="#fff" />
                      <Text style={styles.scanBtnText}>{isNavigating ? 'Routing...' : 'Navigate'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {selectedDestination && (
                  <Text style={styles.destLabel}>Destination: {selectedDestination.name}</Text>
                )}
              </View>
            )}

            {/* Destination Search */}
            <View style={styles.destinationSearchPanel}>
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

              {(destinationQuery.trim().length > 0 || filteredPois.length > 0) && (
                <View style={styles.destinationList}>
                  {coordinateSuggestion && (
                    <TouchableOpacity
                      style={styles.destinationItem}
                      onPress={() =>
                        handleSelectDestination({
                          id: 'temp-destination',
                          building_id: floor.building_id,
                          floor_id: id || '',
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
                      <Ionicons name="location-outline" size={20} color="#4ECDC4" />
                      <View style={styles.destinationItemInfo}>
                        <Text style={styles.destinationItemName}>{poi.name}</Text>
                        <Text style={styles.destinationItemCategory}>{poi.category}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Map Viewer */}
            <IndoorMapViewer
              mapImage={
                floor.mapImageUrl 
                  ? `${API_URL}${floor.mapImageUrl}` 
                  : floor.map_image
              }
              mapWidth={floor.width}
              mapHeight={floor.height}
              userLocation={currentPosition && currentPosition.valid && currentPosition.floorId === id ? {
                building_id: floor.building_id,
                floor_id: id || '',
                x: currentPosition.x,
                y: currentPosition.y,
                source: 'beacon',
                timestamp: new Date(),
              } : null}
              destination={selectedDestination}
              route={navigationRoute?.route}
              beacons={beacons}
              pois={pois}
              onMapPress={handleMapPress}
              showDestinationMode={showDestinationMode}
              showRouteLine={true}
              showTurnPrompt={false}
            />
          </View>
        );

      case 'beacons':
        return (
          <View>
            <TouchableOpacity style={styles.addItemButton} onPress={openBeaconModal}>
              <Ionicons name="add-circle-outline" size={20} color="#A78BFA" />
              <Text style={[styles.addItemText, { color: '#A78BFA' }]}>Add Beacon</Text>
            </TouchableOpacity>
            {beacons.map((beacon) => (
              <View key={beacon.id} style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
                  <Ionicons name="bluetooth" size={20} color="#A78BFA" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{beacon.label || beacon.uuid.substring(0, 8)}</Text>
                  <Text style={styles.itemMeta}>Major: {beacon.major} • Minor: {beacon.minor}</Text>
                  <Text style={styles.itemMeta}>Position: ({beacon.x}, {beacon.y})</Text>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteBeacon(beacon)}>
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );

      case 'pois':
        return (
          <View>
            <TouchableOpacity style={styles.addItemButton} onPress={openPOIModal}>
              <Ionicons name="add-circle-outline" size={20} color="#4ECDC4" />
              <Text style={[styles.addItemText, { color: '#4ECDC4' }]}>Add Point of Interest</Text>
            </TouchableOpacity>
            {pois.map((poi) => (
              <View key={poi.id} style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: 'rgba(78, 205, 196, 0.15)' }]}>
                  <Ionicons name="location" size={20} color="#4ECDC4" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{poi.name}</Text>
                  <Text style={styles.itemMeta}>{poi.category} • ({poi.x}, {poi.y})</Text>
                  {poi.description && <Text style={styles.itemLabel}>{poi.description}</Text>}
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePOI(poi)}>
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {!!turnInstruction && !showDestinationMode && (
        <View style={styles.turnPromptScreen} pointerEvents="none">
          <Text style={styles.turnPromptText}>{turnInstruction}</Text>
        </View>
      )}
      <Stack.Screen options={{ headerTitle: `Floor ${floor.floor_number}: ${floor.name}` }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90FF" />}
      >
        {/* Floor Info */}
        <View style={styles.floorInfo}>
          <View style={styles.floorNumber}>
            <Text style={styles.floorNumberText}>{floor.floor_number}</Text>
          </View>
          <View style={styles.floorDetails}>
            <Text style={styles.floorName}>{floor.name}</Text>
            <Text style={styles.floorMeta}>{floor.width} x {floor.height} px • Scale: {floor.scale}x</Text>
          </View>
        </View>

        {/* Tabs */}
        {renderTabs()}

        {/* Tab Content */}
        {renderContent()}
      </ScrollView>

      {/* Beacon Modal */}
      <Modal visible={beaconModalVisible} animationType="slide" transparent onRequestClose={() => setBeaconModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Beacon</Text>
              <TouchableOpacity onPress={() => setBeaconModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>UUID *</Text>
                <TextInput
                  style={styles.input}
                  value={beaconForm.uuid}
                  onChangeText={(t) => setBeaconForm({ ...beaconForm, uuid: t })}
                  placeholder="e.g., F7826DA6-4FA2-4E98-8024-BC5B71E0893E"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Major</Text>
                  <TextInput
                    style={styles.input}
                    value={String(beaconForm.major)}
                    onChangeText={(t) => setBeaconForm({ ...beaconForm, major: parseInt(t) || 0 })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Minor</Text>
                  <TextInput
                    style={styles.input}
                    value={String(beaconForm.minor)}
                    onChangeText={(t) => setBeaconForm({ ...beaconForm, minor: parseInt(t) || 0 })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>X Position</Text>
                  <TextInput
                    style={styles.input}
                    value={String(beaconForm.x)}
                    onChangeText={(t) => setBeaconForm({ ...beaconForm, x: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Y Position</Text>
                  <TextInput
                    style={styles.input}
                    value={String(beaconForm.y)}
                    onChangeText={(t) => setBeaconForm({ ...beaconForm, y: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Label (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={beaconForm.label}
                  onChangeText={(t) => setBeaconForm({ ...beaconForm, label: t })}
                  placeholder="e.g., Lobby Beacon 1"
                  placeholderTextColor="#666"
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setBeaconModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#A78BFA' }]} onPress={handleSaveBeacon}>
                <Text style={styles.saveButtonText}>Add Beacon</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* POI Modal */}
      <Modal visible={poiModalVisible} animationType="slide" transparent onRequestClose={() => setPoiModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Point of Interest</Text>
              <TouchableOpacity onPress={() => setPoiModalVisible(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={poiForm.name}
                  onChangeText={(t) => setPoiForm({ ...poiForm, name: t })}
                  placeholder="e.g., Conference Room A"
                  placeholderTextColor="#666"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.categoryRow}>
                    {POI_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryBtn, poiForm.category === cat && styles.categoryBtnActive]}
                        onPress={() => setPoiForm({ ...poiForm, category: cat })}
                      >
                        <Text style={[styles.categoryBtnText, poiForm.category === cat && styles.categoryBtnTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>X Position</Text>
                  <TextInput
                    style={styles.input}
                    value={String(poiForm.x)}
                    onChangeText={(t) => setPoiForm({ ...poiForm, x: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Y Position</Text>
                  <TextInput
                    style={styles.input}
                    value={String(poiForm.y)}
                    onChangeText={(t) => setPoiForm({ ...poiForm, y: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={poiForm.description}
                  onChangeText={(t) => setPoiForm({ ...poiForm, description: t })}
                  placeholder="Brief description..."
                  placeholderTextColor="#666"
                  multiline
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPoiModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#4ECDC4' }]} onPress={handleSavePOI}>
                <Text style={styles.saveButtonText}>Add POI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
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
  floorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  floorNumber: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#252542',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorNumberText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  floorDetails: {
    flex: 1,
    marginLeft: 14,
  },
  floorName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  floorMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#252542',
  },
  tabText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#4A90FF',
  },
  mapSection: {
    height: 350,
    marginBottom: 16,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FFE66D',
  },
  addItemText: {
    color: '#FFE66D',
    fontSize: 14,
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  itemMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  itemLabel: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#252542',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#252542',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#252542',
  },
  categoryBtnActive: {
    backgroundColor: '#4ECDC4',
  },
  categoryBtnText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryBtnTextActive: {
    color: '#1a1a2e',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#252542',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#252542',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#4A90FF',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  /* Beacon scanning styles */
  scanPanel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  scanningStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scanningText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
  },
  scanInactiveText: {
    color: '#666',
    fontSize: 13,
  },
  beaconCount: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  positionFound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 4,
  },
  positionText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 4,
  },
  destLabel: {
    color: '#4A90FF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  scanBtnActive: {
    backgroundColor: '#EF4444',
  },
  destBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90FF',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  destBtnActive: {
    backgroundColor: '#F97316',
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A78BFA',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  scanBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  destinationSearchPanel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
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
  destinationList: {
    borderTopWidth: 1,
    borderTopColor: '#252542',
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
});
