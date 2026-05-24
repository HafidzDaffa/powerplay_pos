import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Fonts, Shadow } from '../constants/theme';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  trend?: number; // percentage change
}

export default function KPICard({ title, value, subtitle, icon, color, trend }: KPICardProps) {
  const isPositive = !trend || trend >= 0;
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {trend !== undefined && (
        <View style={styles.trendRow}>
          <Ionicons
            name={isPositive ? 'trending-up' : 'trending-down'}
            size={12}
            color={isPositive ? Colors.success : Colors.error}
          />
          <Text style={[styles.trend, { color: isPositive ? Colors.success : Colors.error }]}>
            {isPositive ? '+' : ''}{trend.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    ...Shadow.md,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: Fonts.sizes.lg,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Fonts.sizes.xs,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 3,
  },
  trend: {
    fontSize: Fonts.sizes.xs,
    fontWeight: '600',
  },
});
