import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getTransactionWithItems } from '@/db/transactions';
import { TransactionWithItems } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';

export default function CheckoutModal() {
  const router = useRouter();
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  const [txn, setTxn] = useState<TransactionWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (transactionId) {
      getTransactionWithItems(parseInt(transactionId))
        .then(setTxn)
        .finally(() => setLoading(false));
    }
  }, [transactionId]);

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
    </SafeAreaView>
  );

  if (!txn) return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.error}>Transaksi tidak ditemukan</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.accentGreen} />
        </View>
        <Text style={styles.successTitle}>Pembayaran Berhasil!</Text>
        <Text style={styles.invoice}>{txn.invoice_number}</Text>
        <Text style={styles.date}>{formatDateTime(txn.created_at)}</Text>
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rincian Produk</Text>
          {txn.items.map((item, i) => (
            <View key={item.id} style={[styles.itemRow, i > 0 && styles.itemBorder]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product_name ?? `Produk #${item.product_id}`}</Text>
                <Text style={styles.itemSku}>{item.product_sku}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemTotal}>{formatIDR(item.fix_price * item.quantity)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Item</Text>
            <Text style={styles.summaryValue}>{txn.total_items} item</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Laba Kotor</Text>
            <Text style={[styles.summaryValue, { color: Colors.accentGreen }]}>{formatIDR(txn.gross_amount)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>TOTAL BAYAR</Text>
            <Text style={styles.totalValue}>{formatIDR(txn.gross_amount)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.newTxnBtn} onPress={() => router.back()}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
          <Text style={styles.newTxnText}>Transaksi Baru</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center' },
  error: { color: Colors.error, textAlign: 'center', marginTop: 60 },
  header: {
    alignItems: 'center', padding: Spacing.xl,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accentGreen + '22', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md, ...Shadow.md,
  },
  successTitle: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800', marginBottom: Spacing.sm },
  invoice: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontFamily: 'monospace' },
  date: { color: Colors.textMuted, fontSize: Fonts.sizes.xs, marginTop: 4 },
  scroll: { flex: 1 },
  card: {
    margin: Spacing.base, backgroundColor: Colors.card,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', ...Shadow.sm, marginBottom: Spacing.sm,
  },
  cardTitle: {
    color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  itemBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  itemInfo: { flex: 1 },
  itemName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  itemSku: { color: Colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs },
  itemTotal: { color: Colors.accentGreen, fontWeight: '700', fontSize: Fonts.sizes.sm },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryLabel: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },
  summaryValue: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  totalRow: { borderBottomWidth: 0, paddingVertical: Spacing.md },
  totalLabel: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  totalValue: { color: Colors.accentGreen, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  footer: {
    padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  newTxnBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md,
    gap: Spacing.sm, ...Shadow.md,
  },
  newTxnText: { color: Colors.white, fontWeight: '800', fontSize: Fonts.sizes.md },
});
