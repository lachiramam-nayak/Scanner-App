import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { LocationStatus } from '../../src/components/LocationStatus';
import { useAppStore } from '../../src/store/appStore';
import { buildingApi, floorApi } from '../../src/services/api';
import { useBeaconScanner } from '../../src/hooks/useBeaconScanner';

export default function ScanScreen() {
  const router = useRouter();
  const {
    userLocation,
    locationMode,
    setUserLocation,
    setLocationMode,
    setSelectedBuilding,
    setSelectedFloor,
    clearLocation,
    setIsScanning: setAppStoreScanning,
  } = useAppStore();

  // iBeacon scanning hook
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

  const [rssiThreshold, setRssiThreshold] = useState<number>(-100);

  // Update app store and user location when position changes
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

      // Also update selected building and floor
      loadBuildingAndFloor(currentPosition.buildingId, currentPosition.floorId);
      // Auto-redirect to Map tab after valid position
      router.replace('/(tabs)');
    }
  }, [currentPosition, isBeaconScanning, router]);

  const loadBuildingAndFloor = async (buildingId: string, floorId: string) => {
    try {
      const building = await buildingApi.getById(buildingId);
      const floor = await floorApi.getById(floorId);
      setSelectedBuilding(building);
      setSelectedFloor(floor);
    } catch (error) {
      console.log('Could not load building/floor details:', error);
    }
  };

  const handleStartBeaconScanning = async () => {
    const success = await startBeaconScanning({
      batchInterval: 1000,
      rssiThreshold: -100,
      smoothingWindow: 5,
    });

    if (!success && Platform.OS !== 'web') {
      Alert.alert(
        'Beacon Scanning Failed',
        scannerStatus.error || 'Could not start Bluetooth scanning. Please check permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleStopBeaconScanning = () => {
    stopBeaconScanning();
    setAppStoreScanning(false);
  };

  const renderBeaconStatus = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.beaconStatus}>
          <Ionicons name="warning" size={20} color="#F97316" />
          <Text style={styles.beaconStatusText}>
            BLE scanning requires a physical Android device
          </Text>
        </View>
      );
    }

    if (isBeaconScanning) {
      return (
        <View style={styles.beaconActive}>
          <View style={styles.beaconActiveHeader}>
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="small" color="#4ADE80" />
            </View>
            <Text style={styles.beaconActiveText}>Scanning for beacons...</Text>
          </View>
          
          {scannedBeacons.length > 0 && (
            <View style={styles.beaconList}>
              <Text style={styles.beaconListTitle}>
                Detected Beacons: {scannedBeacons.length}
              </Text>
              {scannedBeacons.slice(0, 3).map((beacon, index) => {
                const id = `${beacon.uuid}/${beacon.major}/${beacon.minor}`;
                const avg = typeof beacon.avgRssi === 'number' ? beacon.avgRssi : beacon.rssi;
                return (
                  <View key={index} style={styles.beaconItem}>
                    <Ionicons name="bluetooth" size={16} color="#4A90FF" />
                    <Text style={styles.beaconItemText}>
                      {id} (RSSI: {beacon.rssi} dBm, AVG: {typeof avg === 'number' ? avg.toFixed(1) : 'N/A'})
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {currentPosition && currentPosition.valid && (
            <View style={styles.positionInfo}>
              <Ionicons name="location" size={20} color="#4ADE80" />
              <View style={styles.positionText}>
                <Text style={styles.positionLabel}>Current Position:</Text>
                <Text style={styles.positionCoords}>
                  ({currentPosition.x.toFixed(1)}, {currentPosition.y.toFixed(1)})
                </Text>
                <Text style={styles.positionFloor}>
                  {currentPosition.floorName}
                </Text>
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
      );
    }

    return (
      <View style={styles.beaconStatus}>
        <Ionicons name="bluetooth" size={20} color="#666" />
        <Text style={styles.beaconStatusText}>
          {scannerStatus.error || 'Bluetooth scanning inactive'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Location Status */}
        <LocationStatus
          userLocation={userLocation}
          locationMode={locationMode}
          onClear={() => {
            clearLocation();
            handleStopBeaconScanning();
          }}
        />

        {/* Beacon Section - PRIMARY POSITIONING METHOD */}
        <View style={[styles.section, styles.primarySection]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, styles.primaryIcon]}>
              <Ionicons name="bluetooth" size={24} color="#4ADE80" />
            </View>
            <Text style={styles.sectionTitle}>iBeacon Positioning</Text>
            <View style={[styles.badge, styles.activeBadge]}>
              <Text style={[styles.badgeText, styles.activeBadgeText]}>Active</Text>
            </View>
          </View>
          <Text style={styles.sectionDescription}>
            Real-time indoor positioning using iBeacon technology. Start scanning to automatically detect your location.
          </Text>
          
          {renderBeaconStatus()}

          {Platform.OS !== 'web' && (
            <>
              <View style={styles.thresholdRow}>
                <Text style={styles.thresholdLabel}>RSSI Threshold</Text>
                <TextInput
                  style={styles.thresholdInput}
                  keyboardType="numeric"
                  value={String(rssiThreshold)}
                  onChangeText={(t) => {
                    const n = parseInt(t, 10);
                    if (Number.isNaN(n)) {
                      setRssiThreshold(-100);
                    } else {
                      setRssiThreshold(n);
                    }
                  }}
                />
                <Text style={styles.thresholdNote}>dBm</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.scanButton,
                  isBeaconScanning && styles.stopButton
                ]}
                onPress={isBeaconScanning ? handleStopBeaconScanning : async () => {
                  const success = await startBeaconScanning({
                    batchInterval: 2000,
                    rssiThreshold: rssiThreshold,
                    smoothingWindow: 5,
                  });

                  if (!success && Platform.OS !== 'web') {
                    Alert.alert(
                      'Beacon Scanning Failed',
                      scannerStatus.error || 'Could not start Bluetooth scanning. Please check permissions and try again.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
              >
                <Ionicons 
                  name={isBeaconScanning ? "stop-circle" : "bluetooth"} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.scanButtonText}>
                  {isBeaconScanning ? 'Stop Scanning' : 'Start Beacon Scanning'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Mock Location Section (for testing) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
              <Ionicons name="bug-outline" size={24} color="#F97316" />
            </View>
            <Text style={styles.sectionTitle}>Test Mode</Text>
            <View style={[styles.badge, { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
              <Text style={[styles.badgeText, { color: '#F97316' }]}>Testing</Text>
            </View>
          </View>
          <Text style={styles.sectionDescription}>
            Simulate beacon positioning for testing without physical beacons.
          </Text>
          <TouchableOpacity
            style={styles.mockLocationButton}
            onPress={async () => {
              try {
                // Get first building and floor from API
                const buildings = await buildingApi.getAll();
                const floors = await floorApi.getAll();
                
                if (buildings.length > 0 && floors.length > 0) {
                  const building = buildings[0];
                  const floor = floors[0];
                  
                  setSelectedBuilding(building);
                  setSelectedFloor(floor);
                  setLocationMode('mock');
                  setUserLocation({
                    building_id: building.id,
                    floor_id: floor.id,
                    x: 191,
                    y: 89,
                    source: 'mock',
                    timestamp: new Date(),
                  });
                  
                  Alert.alert(
                    'Mock Location Set',
                    `Simulating position at (191, 89) on ${floor.name}`,
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert('Error', 'No buildings or floors found in the system');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to set mock location');
              }
            }}
          >
            <Ionicons name="location-outline" size={20} color="#F97316" />
            <Text style={styles.mockLocationButtonText}>Set Mock Position</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  primarySection: {
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 230, 109, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIcon: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  badgeText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '600',
  },
  activeBadgeText: {
    color: '#4ADE80',
  },
  sectionDescription: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 52,
    marginBottom: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginLeft: 52,
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 52,
    marginBottom: 12,
    gap: 8,
  },
  thresholdLabel: {
    color: '#fff',
    fontSize: 13,
    width: 110,
  },
  thresholdInput: {
    backgroundColor: '#0f172a',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    width: 80,
  },
  thresholdNote: {
    color: '#888',
    fontSize: 13,
  },
  beaconPlaceholder: {
    marginLeft: 52,
  },
  beaconStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252542',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginLeft: 52,
    marginBottom: 12,
  },
  beaconStatusText: {
    color: '#666',
    fontSize: 13,
    flex: 1,
  },
  beaconActive: {
    marginLeft: 52,
    marginBottom: 12,
  },
  beaconActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  scanningIndicator: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  mockLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginLeft: 52,
    gap: 8,
  },
  mockLocationButtonText: {
    color: '#F97316',
    fontSize: 14,
    fontWeight: '600',
  },
  mockButton: {
    marginTop: 24,
    backgroundColor: '#4A90FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  mockButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
