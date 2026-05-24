import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getDeletedProducts, restoreProduct, hardDeleteProduct } from '@/db/products';
import { getDeletedTransactions, restoreTransaction, hardDeleteTransaction } from '@/db/transactions';
import { getDeletedCashflows, restoreCashflow, hardDeleteCashflow } from '@/db/cashflow';
import { Product, Transaction, Cashflow } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';
import Toast from 'react-native-toast-message';

type Tab = 'products' | 'transactions' | 'cashflows';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'products', label: 'Produk', icon: 'cube-outline' },
  { key: 'transactions', label: 'Transaksi', icon: 'receipt-outline' },
  { key: 'cashflows', label: 'Arus Kas', icon: 'wallet-outline' },
];

export default function TrashModal() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmItem, setConfirmItem] = useState<{ id: number; name: string; action: 'restore' | 'delete' } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [prods, txns, flows] = await Promise.all([
        getDeletedProducts(),
        getDeletedTransactions(),
        getDeletedCashflows(),
      ]);
      setProducts(prods);
      setTransactions(txns);
      setCashflows(flows);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async () => {
    if (!confirmItem) return;
    const { id, action } = confirmItem;
    try {
      if (tab === 'products') {
        action === 'restore' ? await restoreProduct(id) : await hardDeleteProduct(id);
      } else if (tab === 'transactions') {
        action === 'restore' ? await restoreTransaction(id) : await hardDeleteTransaction(id);
      } else {
        action === 'restore' ? await restoreCashflow(id) : await hardDeleteCashflow(id);
      }
      Toast.show({ type: 'success', text1: action === 'restore' ? 'Dipulihkan!' : 'Dihapus permanen!' });
      setConfirmItem(null);
      loadData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Operasi gagal', text2: e.message });
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardSub}>{item.sku}</Text>
        <Text style={styles.cardDate}>Dihapus: {formatDateTime(item.deleted_at!)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.restoreBtn]}
          onPress={() => setConfirmItem({ id: item.id, name: item.name, action: 'restore' })}>
          <Ionicons name="refresh-outline" size={16} color={Colors.accentGreen} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => setConfirmItem({ id: item.id, name: item.name, action: 'delete' })}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName}>{item.invoice_number}</Text>
        <Text style={styles.cardSub}>{formatIDR(item.gross_amount)} • {item.total_items} item</Text>
        <Text style={styles.cardDate}>Dibatalkan: {formatDateTime(item.deleted_at!)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.restoreBtn]}
          onPress={() => setConfirmItem({ id: item.id, name: item.invoice_number, action: 'restore' })}>
          <Ionicons name="refresh-outline" size={16} color={Colors.accentGreen} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => setConfirmItem({ id: item.id, name: item.invoice_number, action: 'delete' })}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCashflow = ({ item }: { item: Cashflow }) => (
    <View style={styles.card}>
      <View style={[styles.typeIcon, { backgroundColor: item.type === 'INCOME' ? Colors.accentGreen + '22' : Colors.error + '22' }]}>
        <Ionicons name={item.type === 'INCOME' ? 'arrow-down-circle' : 'arrow-up-circle'} size={18}
          color={item.type === 'INCOME' ? Colors.accentGreen : Colors.error} />
      </View>
      <View style={styles.cardLeft}>
        <Text style={styles.cardName}>{item.title}</Text>
        <Text style={[styles.cardSub, { color: item.type === 'INCOME' ? Colors.accentGreen : Colors.error }]}>
          {item.type === 'INCOME' ? '+' : '-'}{formatIDR(item.amount)}
        </Text>
        <Text style={styles.cardDate}>Dihapus: {formatDateTime(item.deleted_at!)}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.restoreBtn]}
          onPress={() => setConfirmItem({ id: item.id, name: item.title, action: 'restore' })}>
          <Ionicons name="refresh-outline" size={16} color={Colors.accentGreen} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => setConfirmItem({ id: item.id, name: item.title, action: 'delete' })}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const currentData = tab === 'products' ? products : tab === 'transactions' ? transactions : cashflows;
  const currentRender = tab === 'products' ? renderProduct : tab === 'transactions' ? renderTransaction : renderCashflow;
  const emptyIcons = { products: 'cube-outline', transactions: 'receipt-outline', cashflows: 'wallet-outline' } as const;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Tempat Sampah</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count = t.key === 'products' ? products.length : t.key === 'transactions' ? transactions.length : cashflows.length;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{count}</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={currentData as any[]}
          keyExtractor={(item) => String(item.id)}
          renderItem={currentRender as any}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
          }
          contentContainerStyle={currentData.length === 0 ? styles.empty : styles.list}
          ListEmptyComponent={
            <EmptyState icon={emptyIcons[tab]} title="Tempat Sampah Kosong" subtitle="Item yang dihapus akan muncul di sini" />
          }
        />
      )}

      <ConfirmModal
        visible={!!confirmItem}
        title={confirmItem?.action === 'restore' ? 'Pulihkan Item?' : 'Hapus Permanen?'}
        message={confirmItem?.action === 'restore'
          ? `"${confirmItem?.name}" akan dipulihkan dan kembali aktif.`
          : `"${confirmItem?.name}" akan dihapus PERMANEN. Tindakan ini tidak dapat dibatalkan!`
        }
        confirmText={confirmItem?.action === 'restore' ? 'Pulihkan' : 'Hapus Permanen'}
        confirmColor={confirmItem?.action === 'restore' ? Colors.accentGreen : Colors.error}
        icon={confirmItem?.action === 'restore' ? 'refresh-outline' : 'trash-outline'}
        onConfirm={handleAction}
        onCancel={() => setConfirmItem(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, gap: 4, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },
  tabBadge: {
    backgroundColor: Colors.error, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tabBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  loader: { marginTop: 60 },
  list: { padding: Spacing.sm },
  empty: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.lg, marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border + '88', ...Shadow.sm, gap: Spacing.md,
  },
  typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardLeft: { flex: 1 },
  cardName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700', marginBottom: 2 },
  cardSub: { color: Colors.textSecondary, fontSize: 11, marginBottom: 2 },
  cardDate: { color: Colors.textMuted, fontSize: 10 },
  cardActions: { gap: Spacing.xs },
  actionBtn: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  restoreBtn: { backgroundColor: Colors.accentGreen + '11', borderColor: Colors.accentGreen + '44' },
  deleteBtn: { backgroundColor: Colors.error + '11', borderColor: Colors.error + '44' },
});
