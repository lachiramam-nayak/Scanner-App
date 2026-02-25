import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { EmptyState } from '../../src/components/EmptyState';
import { ListSkeleton } from '../../src/components/SkeletonLoader';
import { Building } from '../../src/store/appStore';
import { buildingApi } from '../../src/services/api';

export default function BuildingsScreen() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
  });

  const loadBuildings = useCallback(async () => {
    try {
      const data = await buildingApi.getAll();
      setBuildings(data);
    } catch (error) {
      console.error('Error loading buildings:', error);
      Alert.alert('Error', 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBuildings();
    setRefreshing(false);
  };

  const openModal = (building?: Building) => {
    if (building) {
      setEditingBuilding(building);
      setFormData({
        name: building.name,
        description: building.description || '',
        address: building.address || '',
      });
    } else {
      setEditingBuilding(null);
      setFormData({ name: '', description: '', address: '' });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingBuilding(null);
    setFormData({ name: '', description: '', address: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Building name is required');
      return;
    }

    try {
      if (editingBuilding) {
        await buildingApi.update(editingBuilding.id, formData);
      } else {
        await buildingApi.create(formData);
      }
      closeModal();
      loadBuildings();
    } catch (error) {
      console.error('Error saving building:', error);
      Alert.alert('Error', 'Failed to save building');
    }
  };

  const handleDelete = (building: Building) => {
    Alert.alert(
      'Delete Building',
      `Are you sure you want to delete "${building.name}"? This will also delete all associated floors, QR codes, beacons, and points of interest.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await buildingApi.delete(building.id);
              loadBuildings();
            } catch (error) {
              console.error('Error deleting building:', error);
              Alert.alert('Error', 'Failed to delete building');
            }
          },
        },
      ]
    );
  };

  const renderBuilding = ({ item }: { item: Building }) => (
    <TouchableOpacity
      style={styles.buildingCard}
      onPress={() => router.push(`/building/${item.id}`)}
    >
      <View style={styles.buildingIcon}>
        <Ionicons name="business" size={28} color="#4A90FF" />
      </View>
      <View style={styles.buildingInfo}>
        <Text style={styles.buildingName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.buildingDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        {item.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color="#888" />
            <Text style={styles.buildingAddress} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.buildingActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openModal(item)}
        >
          <Ionicons name="pencil-outline" size={20} color="#4A90FF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.content}>
          <ListSkeleton count={4} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {buildings.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No Buildings Yet"
          message="Create your first building to start setting up indoor navigation."
          actionLabel="Add Building"
          onAction={() => openModal()}
        />
      ) : (
        <FlatList
          data={buildings}
          renderItem={renderBuilding}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4A90FF"
            />
          }
        />
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => openModal()}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBuilding ? 'Edit Building' : 'Add Building'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                  placeholder="Building name"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                  placeholder="Optional description"
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={formData.address}
                  onChangeText={(text) =>
                    setFormData({ ...formData, address: text })
                  }
                  placeholder="Building address"
                  placeholderTextColor="#666"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
              >
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
  content: {
    padding: 16,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  buildingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  buildingIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 144, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  buildingName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buildingDescription: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  buildingAddress: {
    color: '#666',
    fontSize: 12,
  },
  buildingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#252542',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90FF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#4A90FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
});
