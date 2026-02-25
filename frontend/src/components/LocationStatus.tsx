import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserLocation } from '../store/appStore';

interface LocationStatusProps {
  userLocation: UserLocation | null;
  locationMode: 'qr' | 'beacon' | 'mock' | null;
  buildingName?: string;
  floorName?: string;
  onClear?: () => void;
}

export const LocationStatus: React.FC<LocationStatusProps> = ({
  userLocation,
  locationMode,
  buildingName,
  floorName,
  onClear,
}) => {
  const getModeInfo = () => {
    switch (locationMode) {
      case 'qr':
        return { icon: 'qr-code-outline' as const, color: '#FFE66D', label: 'QR Code' };
      case 'beacon':
        return { icon: 'bluetooth-outline' as const, color: '#A78BFA', label: 'Beacon' };
      case 'mock':
        return { icon: 'bug-outline' as const, color: '#F97316', label: 'Mock' };
      default:
        return { icon: 'location-outline' as const, color: '#888', label: 'Unknown' };
    }
  };

  const modeInfo = getModeInfo();

  if (!userLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.noLocation}>
          <Ionicons name="location-outline" size={20} color="#888" />
          <Text style={styles.noLocationText}>No location set</Text>
        </View>
        <Text style={styles.hint}>Scan a QR code to fix your position</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.locationInfo}>
        <View style={styles.locationHeader}>
          <View style={[styles.modeIndicator, { backgroundColor: modeInfo.color }]}>
            <Ionicons name={modeInfo.icon} size={14} color="#1a1a2e" />
          </View>
          <Text style={styles.modeLabel}>{modeInfo.label}</Text>
          {onClear && (
            <TouchableOpacity style={styles.clearButton} onPress={onClear}>
              <Ionicons name="close-circle" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.locationDetails}>
          {buildingName && (
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={14} color="#888" />
              <Text style={styles.detailText}>{buildingName}</Text>
            </View>
          )}
          {floorName && (
            <View style={styles.detailRow}>
              <Ionicons name="layers-outline" size={14} color="#888" />
              <Text style={styles.detailText}>{floorName}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="navigate-outline" size={14} color="#888" />
            <Text style={styles.detailText}>
              ({Math.round(userLocation.x)}, {Math.round(userLocation.y)})
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  noLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLocationText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
  },
  hint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  locationInfo: {
    gap: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  clearButton: {
    padding: 4,
  },
  locationDetails: {
    gap: 4,
    marginLeft: 32,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: '#aaa',
    fontSize: 13,
    marginLeft: 6,
  },
});
