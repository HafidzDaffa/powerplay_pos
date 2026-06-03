import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { documentDirectory, copyAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getTransactionWithItems, voidTransaction } from '@/db/transactions';
import { TransactionWithItems } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';

export default function CheckoutModal() {
  const router = useRouter();
  const { transactionId, fromHistory } = useLocalSearchParams<{ transactionId: string; fromHistory?: string }>();
  const [txn, setTxn] = useState<TransactionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const viewShotRef = useRef<any>(null);

  const loadTransactionData = () => {
    if (transactionId) {
      getTransactionWithItems(parseInt(transactionId))
        .then(setTxn)
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadTransactionData();
  }, [transactionId]);

  const handleShareText = async () => {
    if (!txn) return;
    try {
      let receiptText = `============================\n`;
      receiptText += `         Dependor\n`;
      if (txn.deleted_at) {
        receiptText += `*** TRANSAKSI BATAL / VOID ***\n`;
      }
      receiptText += `============================\n`;
      receiptText += `Invoice : ${txn.invoice_number}\n`;
      receiptText += `Tanggal : ${formatDateTime(txn.created_at)}\n`;
      receiptText += `----------------------------\n`;
      receiptText += `Rincian Produk:\n`;

      txn.items.forEach((item, index) => {
        const name = item.product_name ?? `Produk #${item.product_id}`;
        receiptText += `${index + 1}. ${name}\n`;
        receiptText += `   ${item.quantity} x ${formatIDR(item.fix_price)} = ${formatIDR(item.fix_price * item.quantity)}\n`;
      });

      receiptText += `----------------------------\n`;
      receiptText += `Total Item  : ${txn.total_items}\n`;
      receiptText += `TOTAL BAYAR : ${formatIDR(txn.gross_amount)}\n`;
      receiptText += `============================\n`;
      receiptText += ` Terima Kasih Telah Berbelanja!\n`;
      receiptText += `============================`;

      await Share.share({
        message: receiptText,
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal membagikan struk', text2: e.message });
    }
  };

  const handleShareImage = async () => {
    setExporting(true);
    try {
      if (!viewShotRef.current) throw new Error('Ref tidak ditemukan');
      const uri = await viewShotRef.current.capture();
      const filename = `invoice_${txn?.invoice_number}_${Date.now()}.png`;
      const destUri = (documentDirectory ?? '') + filename;
      await copyAsync({ from: uri, to: destUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destUri, { mimeType: 'image/png', dialogTitle: `Struk ${txn?.invoice_number}` });
      }
      Toast.show({ type: 'success', text1: 'Struk berhasil diekspor!', text2: filename });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal mengekspor struk', text2: e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleVoidTransaction = async () => {
    if (!txn) return;
    setVoiding(true);
    try {
      await voidTransaction(txn.id);
      Toast.show({
        type: 'success',
        text1: 'Transaksi Dibatalkan!',
        text2: `Invoice ${txn.invoice_number} telah dipindahkan ke tempat sampah.`,
      });
      setConfirmVoid(false);
      // Reload transaction to update current state
      loadTransactionData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal membatalkan transaksi', text2: e.message });
    } finally {
      setVoiding(false);
    }
  };

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
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.successIcon, txn.deleted_at && styles.voidIcon]}>
          <Ionicons
            name={txn.deleted_at ? 'close-circle' : 'checkmark-circle'}
            size={38}
            color={txn.deleted_at ? Colors.error : Colors.accentGreen}
          />
        </View>
        <Text style={styles.successTitle}>
          {txn.deleted_at
            ? 'Transaksi Dibatalkan (Void)'
            : fromHistory === 'true'
            ? 'Detail Transaksi'
            : 'Pembayaran Berhasil!'}
        </Text>
        <Text style={styles.invoice}>{txn.invoice_number}</Text>
        <Text style={styles.date}>{formatDateTime(txn.created_at)}</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Thermal Receipt Visual container wrapped in ViewShot for export */}
        <ViewShot
          ref={viewShotRef}
          options={{ format: 'png', quality: 1.0 }}
          style={styles.viewShotContainer}
        >
          <View style={styles.receiptCard}>
            {txn.deleted_at && (
              <View style={styles.voidBanner}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.voidBannerText}>TRANSAKSI BATAL / VOID</Text>
              </View>
            )}

            <View style={styles.receiptHeader}>
              <Text style={styles.receiptBrand}>Dependor</Text>
            </View>

            <View style={styles.dividerDot} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice</Text>
              <Text style={styles.metaValue}>{txn.invoice_number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Tanggal</Text>
              <Text style={styles.metaValue}>{formatDateTime(txn.created_at)}</Text>
            </View>

            <View style={styles.dividerDot} />

            <Text style={styles.itemsTitle}>Rincian Produk</Text>
            {txn.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.product_name ?? `Produk #${item.product_id}`}
                  </Text>
                  <Text style={styles.itemSku}>{item.product_sku ?? '-'}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>{item.quantity} x {formatIDR(item.fix_price)}</Text>
                  <Text style={styles.itemTotal}>{formatIDR(item.fix_price * item.quantity)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.dividerDot} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Item</Text>
              <Text style={styles.summaryValue}>{txn.total_items} item</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.totalLabel}>TOTAL BAYAR</Text>
              <Text style={[styles.totalValue, txn.deleted_at && styles.voidTotalValue]}>
                {formatIDR(txn.gross_amount)}
              </Text>
            </View>

            <View style={styles.dividerDot} />

            <Text style={styles.thankYouText}>
              {txn.deleted_at ? 'Transaksi telah dibatalkan' : 'Terima Kasih Telah Berbelanja! 🙏'}
            </Text>
          </View>
        </ViewShot>

        {/* Share & Export Options */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard} onPress={handleShareText}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '15' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Bagikan Teks</Text>
            <Text style={styles.actionSub}>Kirim struk teks ke WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={handleShareImage} disabled={exporting}>
            <View style={[styles.actionIcon, { backgroundColor: Colors.accentGreen + '15' }]}>
              {exporting ? (
                <ActivityIndicator size="small" color={Colors.accentGreen} />
              ) : (
                <Ionicons name="image-outline" size={24} color={Colors.accentGreen} />
              )}
            </View>
            <Text style={styles.actionLabel}>Ekspor Gambar</Text>
            <Text style={styles.actionSub}>Simpan/bagikan gambar struk</Text>
          </TouchableOpacity>
        </View>

        {/* Soft Delete / Void Transaction Button (Only shown if active) */}
        {!txn.deleted_at && (
          <TouchableOpacity
            style={styles.voidBtn}
            onPress={() => setConfirmVoid(true)}
            activeOpacity={0.8}
            disabled={voiding}
          >
            {voiding ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                <Text style={styles.voidBtnText}>Batalkan Transaksi (Soft Delete)</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Reusable back button based on origin */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.newTxnBtn, fromHistory === 'true' && styles.closeBtn]}
          onPress={() => router.back()}
        >
          <Ionicons
            name={fromHistory === 'true' ? 'close-circle-outline' : 'add-circle-outline'}
            size={20}
            color={Colors.white}
          />
          <Text style={styles.newTxnText}>
            {fromHistory === 'true' ? 'Tutup Rincian' : 'Transaksi Baru'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal to Void Transaction */}
      <ConfirmModal
        visible={confirmVoid}
        title="Batalkan Transaksi?"
        message={`Apakah Anda yakin ingin membatalkan transaksi ${txn.invoice_number}? Stok produk akan dikembalikan ke inventori.`}
        confirmText="Ya, Batalkan"
        cancelText="Kembali"
        confirmColor={Colors.error}
        icon="alert-circle-outline"
        onConfirm={handleVoidTransaction}
        onCancel={() => setConfirmVoid(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center' },
  error: { color: Colors.error, textAlign: 'center', marginTop: 60 },
  header: {
    alignItems: 'center', padding: Spacing.base,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  successIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.accentGreen + '22', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  voidIcon: {
    backgroundColor: Colors.error + '22',
  },
  successTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800', marginBottom: 2 },
  invoice: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontFamily: 'monospace' },
  date: { color: Colors.textMuted, fontSize: Fonts.sizes.xs, marginTop: 2 },
  scroll: { flex: 1 },

  // Thermal paper receipt styles (viewshot)
  viewShotContainer: {
    padding: Spacing.base,
    backgroundColor: Colors.background,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.md,
  },
  voidBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  voidBannerText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  receiptHeader: {
    alignItems: 'center',
  },
  receiptBrand: {
    color: '#0F172A',
    fontSize: Fonts.sizes.md,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  receiptSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dividerDot: {
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: '#94A3B8',
    marginVertical: Spacing.base,
    height: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  metaValue: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  itemsTitle: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  itemName: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  itemSku: {
    color: '#94A3B8',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemQty: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '500',
  },
  itemTotal: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#1E293B',
    fontSize: 11,
    fontWeight: '700',
  },
  totalLabel: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  totalValue: {
    color: '#059669',
    fontSize: Fonts.sizes.md,
    fontWeight: '800',
  },
  voidTotalValue: {
    color: '#DC2626',
    textDecorationLine: 'line-through',
  },
  thankYouText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Premium actions row
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  actionSub: {
    color: Colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },

  // Void Button Styles
  voidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '12',
    borderWidth: 1,
    borderColor: Colors.error + '22',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    gap: Spacing.xs,
  },
  voidBtnText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: Fonts.sizes.sm,
  },

  footer: {
    padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface,
  },
  newTxnBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md,
    gap: Spacing.sm, ...Shadow.md,
  },
  closeBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newTxnText: { color: Colors.white, fontWeight: '800', fontSize: Fonts.sizes.sm },
});
