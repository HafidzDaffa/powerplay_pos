import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { exportDatabaseAsJSON, exportDatabaseFile, exportProductsToExcel } from '@/services/exportService';
import { importDatabaseFromJSON } from '@/services/importService';
import Toast from 'react-native-toast-message';

type LoadingKey = 'json' | 'db' | 'excel' | 'import' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<LoadingKey>(null);

  const handle = async (key: LoadingKey, fn: () => Promise<any>) => {
    setLoading(key);
    try {
      const msg = await fn();
      if (msg) Toast.show({ type: 'success', text1: msg });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    } finally {
      setLoading(null);
    }
  };

  const menuItems = [
    {
      section: 'Ekspor Data',
      items: [
        {
          key: 'json',
          icon: 'code-download-outline',
          label: 'Ekspor sebagai JSON',
          subtitle: 'Backup lengkap semua data termasuk timestamp',
          color: Colors.primary,
          action: () => handle('json', exportDatabaseAsJSON),
        },
        {
          key: 'db',
          icon: 'server-outline',
          label: 'Ekspor File .db',
          subtitle: 'Ekspor raw SQLite database untuk migrasi perangkat',
          color: Colors.accentOrange,
          action: () => handle('db', exportDatabaseFile),
        },
        {
          key: 'excel',
          icon: 'document-text-outline',
          label: 'Ekspor Produk ke Excel',
          subtitle: 'Data produk & QR Code SKU dalam format .xlsx',
          color: Colors.accentGreen,
          action: () => handle('excel', exportProductsToExcel),
        },
      ],
    },
    {
      section: 'Impor Data',
      items: [
        {
          key: 'import',
          icon: 'cloud-upload-outline',
          label: 'Impor dari JSON',
          subtitle: 'PERINGATAN: Akan menimpa data yang ada',
          color: Colors.accent,
          action: () => handle('import', importDatabaseFromJSON),
        },
      ],
    },
    {
      section: 'Kelola Data',
      items: [
        {
          key: null,
          icon: 'receipt-outline',
          label: 'Riwayat Transaksi',
          subtitle: 'Lihat daftar transaksi sukses & ekspor invoice struk',
          color: Colors.accentGreen,
          action: () => router.push('/modals/history'),
        },
        {
          key: null,
          icon: 'trash-outline',
          label: 'Tempat Sampah',
          subtitle: 'Kelola produk, transaksi & arus kas yang dihapus',
          color: Colors.error,
          action: () => router.push('/modals/trash'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/logo.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>POS Dependor</Text>
          <Text style={styles.version}>Versi 1.0.0 • Android</Text>
        </View>

        {menuItems.map((section) => (
          <View key={section.section} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    i < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={item.action}
                  disabled={loading !== null}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '22' }]}>
                    {loading === item.key ? (
                      <ActivityIndicator size="small" color={item.color} />
                    ) : (
                      <Ionicons name={item.icon as any} size={22} color={item.color} />
                    )}
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSub}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.footer}>
          Dependor © 2026
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { alignItems: 'center', padding: Spacing.xl, paddingBottom: Spacing.lg },
  logoWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + '22', alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.md, ...Shadow.md,
    overflow: 'hidden',
  },
  appName: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  version: { color: Colors.textMuted, fontSize: Fonts.sizes.sm, marginTop: 4 },
  section: { marginHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionTitle: {
    color: Colors.textSecondary, fontSize: Fonts.sizes.xs,
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: Spacing.sm, paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.base, gap: Spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuIcon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  menuInfo: { flex: 1 },
  menuLabel: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700', marginBottom: 2 },
  menuSub: { color: Colors.textMuted, fontSize: Fonts.sizes.xs },
  footer: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', padding: Spacing.base },
});
