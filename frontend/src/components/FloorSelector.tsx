import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Floor } from '../store/appStore';

interface FloorSelectorProps {
  floors: Floor[];
  selectedFloor: Floor | null;
  onSelectFloor: (floor: Floor) => void;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  floors,
  selectedFloor,
  onSelectFloor,
}) => {
  if (floors.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="layers-outline" size={16} color="#888" />
        <Text style={styles.headerText}>Floors</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.floorList}>
          {floors.map((floor) => (
            <TouchableOpacity
              key={floor.id}
              style={[
                styles.floorButton,
                selectedFloor?.id === floor.id && styles.floorButtonSelected,
              ]}
              onPress={() => onSelectFloor(floor)}
            >
              <Text
                style={[
                  styles.floorNumber,
                  selectedFloor?.id === floor.id && styles.floorNumberSelected,
                ]}
              >
                {floor.floor_number}
              </Text>
              <Text
                style={[
                  styles.floorName,
                  selectedFloor?.id === floor.id && styles.floorNameSelected,
                ]}
                numberOfLines={1}
              >
                {floor.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerText: {
    color: '#888',
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },
  floorList: {
    flexDirection: 'row',
    gap: 8,
  },
  floorButton: {
    backgroundColor: '#252542',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 56,
    alignItems: 'center',
  },
  floorButtonSelected: {
    backgroundColor: '#4A90FF',
  },
  floorNumber: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  floorNumberSelected: {
    color: '#fff',
  },
  floorName: {
    color: '#888',
    fontSize: 10,
    marginTop: 1,
  },
  floorNameSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
