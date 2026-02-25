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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { EmptyState } from '../../src/components/EmptyState';
import { ListSkeleton } from '../../src/components/SkeletonLoader';
import { Building, Floor, Beacon, POI } from '../../src/store/appStore';
import { buildingApi, floorApi, beaconApi, poiApi } from '../../src/services/api';
import { useBeaconScanner } from '../../src/hooks/useBeaconScanner';
import { useAppStore } from '../../src/store/appStore';

export default function BuildingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [building, setBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Floor modal
  const [floorModalVisible, setFloorModalVisible] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [floorForm, setFloorForm] = useState({
    floor_number: 1,
    name: '',
    width: 1000,
    height: 800,
    scale: 1,
    map_image: '',
  });

  // Stats
  const [stats, setStats] = useState({
    beacons: 0,
    pois: 0,
  });

  // Beacon scanning hook + app store
  const {
    isScanning: isBeaconScanning,
    scannerStatus,
    scannedBeacons,
    currentPosition,
    isPositioning,
    positionError,
    startScanning: startBeaconScanning,
    stopScanning: stopBeaconScanning,
  } = useBeaconScanner();

  const {
    setUserLocation,
    setLocationMode,
    setSelectedBuilding,
    setSelectedFloor,
    setIsScanning: setAppStoreScanning,
  } = useAppStore();

  useEffect(() => {
    if (currentPosition && currentPosition.valid) {
      setUserLocation({
        building_id: currentPosition.buildingId,
        floor_id: currentPosition.floorId,
        x: currentPosition.x,
        y: currentPosition.y,
        source: 'beacon',
        timestamp: new Date(),
      });
      setLocationMode('beacon');
      setAppStoreScanning(isBeaconScanning);

      // load and set selected building/floor
      (async () => {
        try {
          const b = await buildingApi.getById(currentPosition.buildingId);
          const f = await floorApi.getById(currentPosition.floorId);
          setSelectedBuilding(b);
          setSelectedFloor(f);
        } catch (err) {
          console.log('Failed to load building/floor for position', err);
        }
      })();
    }
  }, [currentPosition]);

  const handleStartBeaconScanning = async () => {
    const success = await startBeaconScanning({ batchInterval: 2000, rssiThreshold: -90 });
    if (!success && Platform.OS !== 'web') {
      Alert.alert('Beacon Scanning Failed', scannerStatus.error || 'Could not start Bluetooth scanning. Please check permissions and try again.');
    }
  };

  const handleStopBeaconScanning = () => {
    stopBeaconScanning();
    setAppStoreScanning(false);
  };

  const loadBuilding = useCallback(async () => {
    if (!id) return;
    try {
      const data = await buildingApi.getById(id);
      setBuilding(data);
      setSelectedBuilding(data);
    } catch (error) {
      console.error('Error loading building:', error);
      Alert.alert('Error', 'Failed to load building');
    }
  }, [id]);

  const loadFloors = useCallback(async () => {
    if (!id) return;
    try {
      const data = await floorApi.getAll(id);
      setFloors(data);
      if (data.length > 0) {
        setSelectedFloor(data[0]);
      }
    } catch (error) {
      console.error('Error loading floors:', error);
    }
  }, [id]);

  const loadStats = useCallback(async () => {
    if (!id) return;
    try {
      const [beacons, pois] = await Promise.all([
        beaconApi.getAll(id),
        poiApi.getAll(id),
      ]);
      setStats({
        beacons: beacons.length,
        pois: pois.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [id]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadBuilding(), loadFloors(), loadStats()]);
    setLoading(false);
  }, [loadBuilding, loadFloors, loadStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const openFloorModal = (floor?: Floor) => {
    if (floor) {
      setEditingFloor(floor);
      setFloorForm({
        floor_number: floor.floor_number,
        name: floor.name,
        width: floor.width,
        height: floor.height,
        scale: floor.scale,
        map_image: floor.map_image || '',
      });
    } else {
      setEditingFloor(null);
      setFloorForm({
        floor_number: floors.length > 0 ? Math.max(...floors.map((f) => f.floor_number)) + 1 : 1,
        name: '',
        width: 1000,
        height: 800,
        scale: 1,
        map_image: '',
      });
    }
    setFloorModalVisible(true);
  };

  const closeFloorModal = () => {
    setFloorModalVisible(false);
    setEditingFloor(null);
  };

  const pickMapImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const nextForm = { ...floorForm, map_image: base64Image };
      setFloorForm(nextForm);

      // If name is empty, set a reasonable default so we can save immediately
      if (!nextForm.name || !nextForm.name.trim()) {
        nextForm.name = `Floor ${nextForm.floor_number}`;
      }

      // Save the floor and open the map view for it
      try {
        let saved: any;
        if (editingFloor) {
          saved = await floorApi.update(editingFloor.id, nextForm);
        } else {
          saved = await floorApi.create({ building_id: id!, ...nextForm });
        }
        closeFloorModal();
        await loadFloors();
        await loadStats();
        if (saved && saved.id) {
          router.push(`/floor/${saved.id}`);
        }
      } catch (error) {
        console.error('Error saving floor after image pick:', error);
        Alert.alert('Error', 'Failed to save floor with selected image');
      }
    }
  };

  const handleSaveFloor = async () => {
    if (!floorForm.name.trim()) {
      Alert.alert('Error', 'Floor name is required');
      return;
    }

    try {
      if (editingFloor) {
        await floorApi.update(editingFloor.id, floorForm);
      } else {
        await floorApi.create({
          building_id: id!,
          ...floorForm,
        });
      }
      closeFloorModal();
      loadFloors();
      loadStats();
    } catch (error) {
      console.error('Error saving floor:', error);
      Alert.alert('Error', 'Failed to save floor');
    }
  };

  const handleDeleteFloor = (floor: Floor) => {
    Alert.alert(
      'Delete Floor',
      `Are you sure you want to delete "${floor.name}"? This will also delete all QR codes, beacons, and POIs on this floor.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await floorApi.delete(floor.id);
              loadFloors();
              loadStats();
            } catch (error) {
              console.error('Error deleting floor:', error);
              Alert.alert('Error', 'Failed to delete floor');
            }
          },
        },
      ]
    );
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

  if (!building) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <Stack.Screen options={{ headerTitle: 'Not Found' }} />
        <EmptyState
          icon="alert-circle-outline"
          title="Building Not Found"
          message="This building may have been deleted."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Stack.Screen options={{ headerTitle: building.name }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A90FF" />
        }
      >
        {/* Building Info */}
        <View style={styles.buildingInfo}>
          <View style={styles.buildingIcon}>
            <Ionicons name="business" size={32} color="#4A90FF" />
          </View>
          <View style={styles.buildingDetails}>
            <Text style={styles.buildingName}>{building.name}</Text>
            {building.description && (
              <Text style={styles.buildingDescription}>{building.description}</Text>
            )}
            {building.address && (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={14} color="#888" />
                <Text style={styles.buildingAddress}>{building.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{floors.length}</Text>
            <Text style={styles.statLabel}>Floors</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pois}</Text>
            <Text style={styles.statLabel}>POIs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.beacons}</Text>
            <Text style={styles.statLabel}>Beacons</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.openMapButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="map-outline" size={20} color="#fff" />
          <Text style={styles.openMapButtonText}>Open Map</Text>
        </TouchableOpacity>

        {/* Beacon Quick Scan */}
        <View style={[styles.section, styles.beaconSection]}>
          <View style={styles.sectionHeader}>
            <View style={styles.beaconIcon}>
              <Ionicons name="bluetooth" size={20} color="#4ADE80" />
            </View>
            <Text style={styles.sectionTitle}>Quick iBeacon Scan</Text>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.beaconStatus}>
              <Ionicons name="warning" size={18} color="#F97316" />
              <Text style={styles.beaconStatusText}>BLE scanning requires a physical Android device</Text>
            </View>
          ) : isBeaconScanning ? (
            <View>
              <View style={styles.beaconActiveHeader}>
                <ActivityIndicator size="small" color="#4ADE80" />
                <Text style={styles.beaconActiveText}>Finding nearest iBeacons...</Text>
              </View>

              {scannedBeacons.length > 0 && (
                <View style={styles.beaconList}>
                  <Text style={styles.beaconListTitle}>Nearby Beacons ({scannedBeacons.length})</Text>
                  {scannedBeacons.slice(0, 4).map((b, i) => (
                    <View key={i} style={styles.beaconItem}>
                      <Ionicons name="bluetooth" size={16} color="#4A90FF" />
                      <Text style={styles.beaconItemText}>{b.major}:{b.minor} — RSSI {b.rssi}</Text>
                    </View>
                  ))}
                </View>
              )}

              {currentPosition && currentPosition.valid && (
                <View style={styles.positionInfo}>
                  <Ionicons name="location" size={18} color="#4ADE80" />
                  <View style={styles.positionText}>
                    <Text style={styles.positionLabel}>Current Position</Text>
                    <Text style={styles.positionCoords}>({currentPosition.x.toFixed(1)}, {currentPosition.y.toFixed(1)})</Text>
                    <Text style={styles.positionFloor}>{currentPosition.floorName}</Text>
                  </View>
                </View>
              )}

              {isPositioning && (
                <View style={styles.positioningIndicator}>
                  <ActivityIndicator size="small" color="#4A90FF" />
                  <Text style={styles.positioningText}>Computing position...</Text>
                </View>
              )}

              {positionError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.errorText}>{positionError}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.beaconStatus}>
              <Ionicons name="bluetooth" size={18} color="#666" />
              <Text style={styles.beaconStatusText}>{scannerStatus.error || 'Bluetooth scanning inactive'}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.scanButton, isBeaconScanning && styles.stopButton]}
            onPress={isBeaconScanning ? handleStopBeaconScanning : handleStartBeaconScanning}
          >
            <Ionicons name={isBeaconScanning ? 'stop-circle' : 'bluetooth'} size={20} color="#fff" />
            <Text style={styles.scanButtonText}>{isBeaconScanning ? 'Stop Scanning' : 'Start Beacon Scan'}</Text>
          </TouchableOpacity>
        </View>

        {/* Floors Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Floors</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => openFloorModal()}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Floor</Text>
            </TouchableOpacity>
          </View>

          {floors.length === 0 ? (
            <View style={styles.emptyFloors}>
              <Ionicons name="layers-outline" size={32} color="#666" />
              <Text style={styles.emptyFloorsText}>No floors yet</Text>
              <Text style={styles.emptyFloorsSubtext}>Add floors to set up the indoor map</Text>
            </View>
          ) : (
            floors.map((floor) => (
              <TouchableOpacity
                key={floor.id}
                style={styles.floorCard}
                onPress={() => router.push(`/floor/${floor.id}`)}
              >
                <View style={styles.floorNumber}>
                  <Text style={styles.floorNumberText}>{floor.floor_number}</Text>
                </View>
                <View style={styles.floorInfo}>
                  <Text style={styles.floorName}>{floor.name}</Text>
                  <Text style={styles.floorMeta}>
                    {floor.width} x {floor.height} • Scale: {floor.scale}x
                  </Text>
                  {floor.map_image && (
                    <View style={styles.hasMapBadge}>
                      <Ionicons name="image-outline" size={12} color="#4ECDC4" />
                      <Text style={styles.hasMapText}>Map uploaded</Text>
                    </View>
                  )}
                </View>
                <View style={styles.floorActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openFloorModal(floor)}>
                    <Ionicons name="pencil-outline" size={18} color="#4A90FF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteFloor(floor)}>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floor Modal */}
      <Modal visible={floorModalVisible} animationType="slide" transparent onRequestClose={closeFloorModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingFloor ? 'Edit Floor' : 'Add Floor'}</Text>
              <TouchableOpacity onPress={closeFloorModal}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Floor Number *</Text>
                <TextInput
                  style={styles.input}
                  value={String(floorForm.floor_number)}
                  onChangeText={(text) => setFloorForm({ ...floorForm, floor_number: parseInt(text) || 0 })}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={floorForm.name}
                  onChangeText={(text) => setFloorForm({ ...floorForm, name: text })}
                  placeholder="Ground Floor"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Width (px)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(floorForm.width)}
                    onChangeText={(text) => setFloorForm({ ...floorForm, width: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="1000"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Height (px)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(floorForm.height)}
                    onChangeText={(text) => setFloorForm({ ...floorForm, height: parseInt(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="800"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Scale (px/m)</Text>
                <TextInput
                  style={styles.input}
                  value={String(floorForm.scale)}
                  onChangeText={(text) => setFloorForm({ ...floorForm, scale: parseFloat(text) || 1 })}
                  keyboardType="decimal-pad"
                  placeholder="1.0"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Floor Map</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={pickMapImage}>
                  <Ionicons name="image-outline" size={24} color="#4A90FF" />
                  <Text style={styles.uploadButtonText}>
                    {floorForm.map_image ? 'Change Map Image' : 'Upload Map Image'}
                  </Text>
                </TouchableOpacity>
                {floorForm.map_image && (
                  <View style={styles.mapPreview}>
                    <Text style={styles.mapPreviewText}>Map image selected</Text>
                    <TouchableOpacity onPress={() => setFloorForm({ ...floorForm, map_image: '' })}>
                      <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeFloorModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveFloor}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
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
  buildingInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  buildingIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 144, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingDetails: {
    flex: 1,
    marginLeft: 16,
  },
  buildingName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  buildingDescription: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  buildingAddress: {
    color: '#666',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  openMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4A90FF',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
  },
  openMapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#252542',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyFloors: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  emptyFloorsText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyFloorsSubtext: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },
  floorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  floorNumber: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#252542',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorNumberText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  floorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  floorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  floorMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  hasMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  hasMapText: {
    color: '#4ECDC4',
    fontSize: 11,
  },
  floorActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#252542',
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
    maxHeight: '85%',
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#252542',
    borderRadius: 8,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#4A90FF',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#4A90FF',
    fontSize: 14,
    fontWeight: '600',
  },
  mapPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  mapPreviewText: {
    color: '#4ECDC4',
    fontSize: 13,
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
    flexDirection: 'row',
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#4A90FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  beaconIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Beacon styles */
  beaconSection: {
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 12,
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  beaconStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252542',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  beaconStatusText: {
    color: '#666',
    fontSize: 13,
    flex: 1,
  },
  beaconActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  beaconActiveText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  beaconList: {
    backgroundColor: '#252542',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  beaconListTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  beaconItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  beaconItemText: {
    color: '#888',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  positionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  positionText: {
    flex: 1,
  },
  positionLabel: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  positionCoords: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  positionFloor: {
    color: '#888',
    fontSize: 12,
  },
  positioningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  positioningText: {
    color: '#4A90FF',
    fontSize: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
});
