import React, { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getDashboardMetrics, getRecentTransactions } from '@/db/dashboard';
import { DashboardMetrics, DateRangeFilter, Transaction } from '@/types';
import { formatIDR, formatIDRCompact, formatDateTime, getDateRange, toSQLDate } from '@/utils/currency';

const DATE_FILTERS: { key: DateRangeFilter; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateRangeFilter>('today');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const range = filter !== 'custom' ? getDateRange(filter as 'today' | 'week' | 'month') : null;
      const [m, txns] = await Promise.all([
        getDashboardMetrics(range?.start ?? null, range?.end ?? null),
        getRecentTransactions(8),
      ]);
      setMetrics(m);
      setRecentTxns(txns);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const kpiCards = metrics ? [
    {
      title: 'Laba Kotor', value: formatIDRCompact(metrics.grossProfit),
      icon: 'trending-up' as const, color: Colors.accentGreen,
      subtitle: 'Total pendapatan penjualan',
    },
    {
      title: 'Laba Bersih', value: formatIDRCompact(metrics.netProfit),
      icon: 'cash-outline' as const, color: Colors.primary,
      subtitle: 'Setelah HPP & biaya ops',
    },
    {
      title: 'Total Produk', value: metrics.totalProducts.toString(),
      icon: 'cube-outline' as const, color: Colors.accentOrange,
      subtitle: 'Produk aktif tersedia',
    },
    {
      title: 'Nilai Aset', value: formatIDRCompact(metrics.totalAssets),
      icon: 'wallet-outline' as const, color: Colors.accent,
      subtitle: 'HPP × Stok produk aktif',
    },
    {
      title: 'Transaksi', value: metrics.totalTransactions.toString(),
      icon: 'receipt-outline' as const, color: Colors.primaryLight,
      subtitle: 'Total transaksi sukses',
    },
  ] : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Selamat datang! 👋</Text>
            <Text style={styles.title}>Dashboard POS</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.historyHeaderBtn}
              onPress={() => router.push('/modals/history')}
              activeOpacity={0.7}
            >
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.logoWrap}>
              <Image source={require('../../assets/logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
          </View>
        </View>

        {/* Date Filter */}
        <View style={styles.filterRow}>
          {DATE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : (
          <>
            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
              {kpiCards.map((card, i) => (
                <View
                  key={card.title}
                  style={[
                    styles.kpiCard,
                    { borderLeftColor: card.color },
                    i === 0 || i === 1 ? styles.kpiWide : null,
                  ]}
                >
                  <View style={[styles.kpiIcon, { backgroundColor: card.color + '22' }]}>
                    <Ionicons name={card.icon} size={20} color={card.color} />
                  </View>
                  <Text style={styles.kpiTitle}>{card.title}</Text>
                  <Text style={[styles.kpiValue, { color: card.color }]}>{card.value}</Text>
                  <Text style={styles.kpiSub}>{card.subtitle}</Text>
                </View>
              ))}
            </View>

            {/* Recent Transactions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transaksi Terbaru</Text>
              {recentTxns.length === 0 ? (
                <View style={styles.emptyTxn}>
                  <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>Belum ada transaksi</Text>
                </View>
              ) : (
                recentTxns.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.txnRow}
                    onPress={() => router.push({ pathname: '/modals/checkout', params: { transactionId: String(t.id), fromHistory: 'true' } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.txnIcon}>
                      <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnInvoice}>{t.invoice_number}</Text>
                      <Text style={styles.txnDate}>{formatDateTime(t.created_at)}</Text>
                    </View>
                    <View style={styles.txnRight}>
                      <Text style={styles.txnAmount}>{formatIDR(t.gross_amount)}</Text>
                      <Text style={styles.txnItems}>{t.total_items} item</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    paddingTop: Spacing.md,
  },
  greeting: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
  title: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  loader: { marginTop: 60 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  kpiCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderLeftWidth: 3,
    width: '47%',
    ...Shadow.sm,
  },
  kpiWide: { width: '100%' },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  kpiTitle: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: { fontSize: Fonts.sizes.lg, fontWeight: '800', marginVertical: 2 },
  kpiSub: { color: Colors.textMuted, fontSize: 10 },
  section: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: Fonts.sizes.md,
    fontWeight: '700',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  emptyTxn: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: { color: Colors.textMuted, fontSize: Fonts.sizes.sm },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnInfo: { flex: 1 },
  txnInvoice: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  txnDate: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { color: Colors.accentGreen, fontWeight: '700', fontSize: Fonts.sizes.sm },
  txnItems: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  historyHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
});
