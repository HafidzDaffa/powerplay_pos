import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { documentDirectory, copyAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import BarcodeGenerator from '@/components/BarcodeGenerator';
import Toast from 'react-native-toast-message';

export default function BarcodeViewModal() {
  const router = useRouter();
  const { sku, name, productId } = useLocalSearchParams<{ sku: string; name: string; productId: string }>();
  const viewShotRef = useRef<any>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (!viewShotRef.current) throw new Error('Ref tidak ditemukan');
      const uri = await viewShotRef.current.capture();
      const filename = `barcode_${sku}_${Date.now()}.png`;
      const destUri = (documentDirectory ?? '') + filename;
      await copyAsync({ from: uri, to: destUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destUri, { mimeType: 'image/png', dialogTitle: `Barcode ${sku}` });
      }
      Toast.show({ type: 'success', text1: 'Barcode disimpan!', text2: filename });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal menyimpan', text2: e.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Barcode Produk</Text>
          <Text style={styles.headerSub}>{name}</Text>
        </View>
        <TouchableOpacity
          style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
          onPress={handleDownload}
          disabled={downloading}
        >
          <Ionicons name="download-outline" size={22} color={Colors.accentGreen} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Barcode Card */}
        <View style={styles.barcodeCard}>
          <Text style={styles.productName}>{name}</Text>
          <Text style={styles.skuLabel}>SKU: {sku}</Text>

          {/* Captured barcode */}
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1.0 }}
            style={styles.viewShot}
          >
            <View style={styles.barcodeWrapper}>
              <BarcodeGenerator
                value={sku || 'DEFAULT'}
                width={280}
                height={90}
                showText
                background="#FFFFFF"
                color="#000000"
              />
            </View>
          </ViewShot>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleDownload}
            disabled={downloading}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.accentGreen + '22' }]}>
              <Ionicons name="download-outline" size={28} color={Colors.accentGreen} />
            </View>
            <Text style={styles.actionTitle}>Unduh PNG</Text>
            <Text style={styles.actionSub}>Simpan barcode sebagai gambar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleDownload}
            disabled={downloading}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '22' }]}>
              <Ionicons name="share-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Bagikan</Text>
            <Text style={styles.actionSub}>Kirim via WhatsApp, email, dll.</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            Barcode ini menggunakan standar Code-128B dan dapat dipindai oleh semua scanner barcode modern.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface, gap: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '700' },
  headerSub: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },
  downloadBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accentGreen + '22', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.accentGreen + '44',
  },
  downloadBtnDisabled: { opacity: 0.5 },
  content: { padding: Spacing.base, gap: Spacing.base },
  barcodeCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, ...Shadow.md,
  },
  productName: { color: Colors.text, fontSize: Fonts.sizes.lg, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  skuLabel: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, marginBottom: Spacing.lg },
  viewShot: { borderRadius: Radius.md, overflow: 'hidden' },
  barcodeWrapper: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: Radius.md },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.base, alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700' },
  actionSub: { color: Colors.textMuted, fontSize: 11, textAlign: 'center' },
  infoCard: {
    flexDirection: 'row', backgroundColor: Colors.primary + '11',
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary + '33', alignItems: 'flex-start',
  },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
});
