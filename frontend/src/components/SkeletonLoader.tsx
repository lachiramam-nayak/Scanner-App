import React from 'react';
import { View, StyleSheet, Dimensions, Animated as RNAnimated } from 'react-native';
import { useEffect } from 'react';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const opacityAnim = React.useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 750,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacityAnim]);

  return (
    <RNAnimated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity: opacityAnim },
        style,
      ]}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <View style={styles.card}>
      <SkeletonLoader height={24} width="60%" />
      <SkeletonLoader height={14} width="80%" style={{ marginTop: 8 }} />
      <SkeletonLoader height={14} width="40%" style={{ marginTop: 4 }} />
    </View>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#2a2a4a',
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
});
