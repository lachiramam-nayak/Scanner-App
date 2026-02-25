import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppStore } from '../../src/store/appStore';

export default function SettingsScreen() {
  const { clearLocation } = useAppStore();

  const handleClearData = () => {
    Alert.alert(
      'Clear Location Data',
      'This will clear your current location and position data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearLocation,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.appInfo}>
            <View style={styles.appIcon}>
              <Ionicons name="navigate" size={32} color="#4A90FF" />
            </View>
            <Text style={styles.appName}>Indoor Wayfinding</Text>
            <Text style={styles.appVersion}>Version 1.0.0 - Phase 1</Text>
          </View>
        </View>

        {/* Location Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <TouchableOpacity style={styles.settingItem} onPress={handleClearData}>
            <View style={styles.settingIcon}>
              <Ionicons name="location-outline" size={22} color="#FF6B6B" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Clear Location Data</Text>
              <Text style={styles.settingDescription}>Reset your current position</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
              <Ionicons name="bluetooth" size={20} color="#A78BFA" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>Beacon Positioning</Text>
              <Text style={styles.featureStatus}>Active</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusActive]}>
              <Ionicons name="checkmark" size={14} color="#4ECDC4" />
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(255, 107, 107, 0.15)' }]}>
              <Ionicons name="navigate" size={20} color="#FF6B6B" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureLabel}>Turn-by-Turn Navigation</Text>
              <Text style={styles.featureStatus}>Coming in Phase 2</Text>
            </View>
            <View style={[styles.statusBadge, styles.statusPending]}>
              <Ionicons name="time-outline" size={14} color="#F97316" />
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Phase 1 Features</Text>
            <Text style={styles.aboutDescription}>
              • Building & floor management{"\n"}
              • Interactive indoor map viewer{"\n"}
              • Destination selection{"\n"}
              • Beacon positioning
            </Text>
          </View>

          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Planned for Phase 2</Text>
            <Text style={styles.aboutDescription}>
              • Graph-based navigation nodes{"\n"}
              • Turn-by-turn guidance{"\n"}
              • Multi-floor routing
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Indoor Wayfinding Application</Text>
          <Text style={styles.footerSubtext}>Built for GPS-challenged environments</Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 144, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  appVersion: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  settingDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  featureStatus: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActive: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  aboutItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  aboutLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  aboutDescription: {
    color: '#888',
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: '#666',
    fontSize: 13,
  },
  footerSubtext: {
    color: '#444',
    fontSize: 11,
    marginTop: 4,
  },
});
