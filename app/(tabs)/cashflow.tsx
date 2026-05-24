import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveCashflows, softDeleteCashflow } from '@/db/cashflow';
import { Cashflow } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';
import EmptyState from '@/components/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from 'react-native-toast-message';

export default function CashflowScreen() {
  const router = useRouter();
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cashflow | null>(null);
  const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');

  const loadData = useCallback(async () => {
    try {
      const data = await getActiveCashflows();
      setCashflows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = filter === 'all' ? cashflows : cashflows.filter(c => c.type === filter);
  const totalIncome = cashflows.filter(c => c.type === 'INCOME').reduce((s, c) => s + c.amount, 0);
  const totalExpense = cashflows.filter(c => c.type === 'EXPENSE').reduce((s, c) => s + c.amount, 0);
  const netFlow = totalIncome - totalExpense;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteCashflow(deleteTarget.id);
      Toast.show({ type: 'success', text1: 'Entri dihapus' });
      setDeleteTarget(null);
      loadData();
    } catch {
      Toast.show({ type: 'error', text1: 'Gagal menghapus' });
    }
  };

  const renderItem = ({ item }: { item: Cashflow }) => (
    <View style={styles.card}>
      <View style={[styles.typeIcon, { backgroundColor: item.type === 'INCOME' ? Colors.accentGreen + '22' : Colors.error + '22' }]}>
        <Ionicons
          name={item.type === 'INCOME' ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={22}
          color={item.type === 'INCOME' ? Colors.accentGreen : Colors.error}
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDate}>{formatDateTime(item.created_at)}</Text>
        {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.cardAmount, { color: item.type === 'INCOME' ? Colors.accentGreen : Colors.error }]}>
          {item.type === 'INCOME' ? '+' : '-'}{formatIDR(item.amount)}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/modals/cashflow-form', params: { cashflowId: item.id } })}
          >
            <Ionicons name="create-outline" size={16} color={Colors.accentOrange} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setDeleteTarget(item)}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Arus Kas</Text>
          <Text style={styles.sub}>Pemasukan & pengeluaran operasional</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/modals/cashflow-form')}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.accentGreen }]}>
          <Text style={styles.summaryLabel}>Pemasukan</Text>
          <Text style={[styles.summaryValue, { color: Colors.accentGreen }]}>{formatIDR(totalIncome)}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.error }]}>
          <Text style={styles.summaryLabel}>Pengeluaran</Text>
          <Text style={[styles.summaryValue, { color: Colors.error }]}>{formatIDR(totalExpense)}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: netFlow >= 0 ? Colors.primary : Colors.error }]}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[styles.summaryValue, { color: netFlow >= 0 ? Colors.primary : Colors.error }]}>
            {netFlow >= 0 ? '+' : ''}{formatIDR(netFlow)}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'INCOME', 'EXPENSE'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Semua' : f === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
          }
          contentContainerStyle={filtered.length === 0 ? styles.empty : styles.list}
          ListEmptyComponent={
            <EmptyState icon="wallet-outline" title="Tidak ada entri" subtitle="Tap + untuk menambah pemasukan atau pengeluaran" />
          }
        />
      )}

      <ConfirmModal
        visible={!!deleteTarget}
        title="Hapus Entri?"
        message={`"${deleteTarget?.title}" akan dipindahkan ke Tempat Sampah.`}
        confirmText="Hapus"
        confirmColor={Colors.error}
        icon="trash-outline"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base,
  },
  title: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.primary, width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  summaryCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, borderLeftWidth: 3, ...Shadow.sm,
  },
  summaryLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { fontSize: Fonts.sizes.sm, fontWeight: '800', marginTop: 4 },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.base },
  filterBtn: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  loader: { marginTop: 60 },
  list: { padding: Spacing.sm },
  empty: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.lg, marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, gap: Spacing.md,
  },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700' },
  cardDate: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  cardNotes: { color: Colors.textSecondary, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', gap: Spacing.sm },
  cardAmount: { fontSize: Fonts.sizes.sm, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: {
    width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
});
