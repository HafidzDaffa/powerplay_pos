import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveProducts, softDeleteProduct, searchProducts } from '@/db/products';
import { getActiveCategories } from '@/db/categories';
import { exportProductsToExcel } from '@/services/exportService';
import { Product, Category } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';
import EmptyState from '@/components/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from 'react-native-toast-message';

export default function InventoryScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        searchQuery ? searchProducts(searchQuery) : getActiveProducts(),
        getActiveCategories(),
      ]);
      let filtered = prods;
      if (selectedCategory) {
        filtered = prods.filter(p => p.category_id === selectedCategory);
      }
      setProducts(filtered);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteProduct(deleteTarget.id);
      Toast.show({ type: 'success', text1: 'Produk dihapus', text2: deleteTarget.name });
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Gagal menghapus produk' });
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportProductsToExcel();
      Toast.show({ type: 'success', text1: 'Ekspor Excel berhasil!' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal ekspor', text2: e.message });
    } finally {
      setExporting(false);
    }
  };

  const renderItem = ({ item }: { item: Product }) => {
    const isLowStock = item.stock <= 5;
    const isOutOfStock = item.stock === 0;
    return (
      <View style={[styles.productRow, isOutOfStock && styles.outOfStockRow]}>
        <View style={styles.productLeft}>
          <View style={styles.productIconWrap}>
            <Ionicons name="cube" size={22} color={Colors.primary} />
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.productSku}>{item.sku}</Text>
            {item.category_name && (
              <View style={styles.catBadge}>
                <Text style={styles.catText}>{item.category_name}</Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatIDR(item.fix_price)}</Text>
              {item.discount > 0 && (
                <Text style={styles.discount}>Diskon {formatIDR(item.discount)}</Text>
              )}
            </View>
            <Text style={[styles.stock, isLowStock && styles.stockLow, isOutOfStock && styles.stockEmpty]}>
              Stok: {item.stock} {isOutOfStock ? '⚠️ Habis' : isLowStock ? '⚠️ Menipis' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.productActions}>
          {/* View Barcode */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/modals/barcode-view', params: { productId: item.id, sku: item.sku, name: item.name } })}
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          {/* Edit */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/modals/product-form', params: { productId: item.id } })}
          >
            <Ionicons name="create-outline" size={18} color={Colors.accentOrange} />
          </TouchableOpacity>
          {/* Delete */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setDeleteTarget(item)}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventori</Text>
          <Text style={styles.headerSub}>{products.length} produk aktif</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, styles.excelBtn]}
            onPress={handleExportExcel}
            disabled={exporting}
          >
            <Ionicons name="document-text-outline" size={18} color={Colors.accentGreen} />
            <Text style={styles.excelBtnText}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.addBtn]}
            onPress={() => router.push('/modals/product-form')}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama atau SKU produk..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      {categories.length > 0 && (
        <FlatList
          data={[{ id: null, name: 'Semua' }, ...categories] as any[]}
          keyExtractor={(item) => String(item.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catList}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.catChipText, selectedCategory === cat.id && styles.catChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Products List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={products.length === 0 ? styles.empty : styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="Tidak ada produk"
              subtitle="Tap tombol + untuk menambah produk baru"
            />
          }
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Hapus Produk?"
        message={`Produk "${deleteTarget?.name}" akan dipindahkan ke Tempat Sampah. Anda dapat memulihkannya kapan saja.`}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base,
  },
  headerTitle: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  headerSub: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  headerBtn: {
    height: 40, borderRadius: Radius.lg, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: Spacing.md,
  },
  excelBtn: {
    backgroundColor: Colors.accentGreen + '22',
    borderWidth: 1, borderColor: Colors.accentGreen + '44',
    flexDirection: 'row', gap: 4,
  },
  excelBtnText: { color: Colors.accentGreen, fontWeight: '700', fontSize: Fonts.sizes.sm },
  addBtn: { backgroundColor: Colors.primary, width: 40, paddingHorizontal: 0 },
  searchRow: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 46,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.sizes.sm },
  catList: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.sm },
  catChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  catChipTextActive: { color: Colors.white },
  loader: { marginTop: 60 },
  list: { padding: Spacing.sm },
  empty: { flex: 1 },
  productRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.lg, marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  outOfStockRow: { borderColor: Colors.error + '44', opacity: 0.8 },
  productLeft: { flex: 1, flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  productIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { flex: 1 },
  productName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700', marginBottom: 2 },
  productSku: { color: Colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginBottom: 4 },
  catBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4,
  },
  catText: { color: Colors.primary, fontSize: 10, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  price: { color: Colors.accentGreen, fontWeight: '800', fontSize: Fonts.sizes.sm },
  discount: { color: Colors.textMuted, fontSize: 10 },
  stock: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  stockLow: { color: Colors.warning },
  stockEmpty: { color: Colors.error },
  productActions: { gap: Spacing.xs },
  actionBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
});
