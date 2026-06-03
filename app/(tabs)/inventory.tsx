import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveProducts, softDeleteProduct, searchProducts } from '@/db/products';
import { getActiveCategories, insertCategory, softDeleteCategory, updateCategory } from '@/db/categories';
import { getDatabase } from '@/db/database';
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
  const [catManagerVisible, setCatManagerVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');

  // QR Code Scanner State
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await insertCategory(newCatName.trim());
      Toast.show({ type: 'success', text1: 'Kategori ditambahkan!' });
      setNewCatName('');
      loadData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal menambah kategori', text2: e.message });
    }
  };

  const handleEditCategory = async (id: number) => {
    if (!editingCatName.trim()) return;
    try {
      await updateCategory(id, editingCatName.trim());
      Toast.show({ type: 'success', text1: 'Kategori diperbarui!' });
      setEditingCatId(null);
      setEditingCatName('');
      loadData();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal mengubah kategori', text2: e.message });
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    try {
      const db = getDatabase();
      const countResult = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND deleted_at IS NULL',
        [id]
      );
      if (countResult && countResult.count > 0) {
        Alert.alert(
          'Tidak Bisa Dihapus',
          `Kategori "${name}" tidak dapat dihapus karena memiliki ${countResult.count} produk aktif yang terhubung dengannya.`
        );
        return;
      }

      Alert.alert(
        'Hapus Kategori?',
        `Apakah Anda yakin ingin menghapus kategori "${name}"?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: async () => {
              try {
                await softDeleteCategory(id);
                Toast.show({ type: 'success', text1: 'Kategori dihapus' });
                if (selectedCategory === id) {
                  setSelectedCategory(null);
                }
                loadData();
              } catch (e: any) {
                Toast.show({ type: 'error', text1: 'Gagal menghapus kategori', text2: e.message });
              }
            }
          }
        ]
      );
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal memeriksa produk kategori', text2: e.message });
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        searchQuery ? searchProducts(searchQuery) : getActiveProducts(),
        getActiveCategories(),
      ]);
      let filtered = prods;
      if (selectedCategory !== null) {
        filtered = prods.filter(p => p.category_id == selectedCategory);
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

  // QR Code scanned callback inside Inventory
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!data || scanned) return;
    setScanned(true);
    const sku = data.trim().replace(/#/g, '-');
    setSearchQuery(sku);
    setScannerVisible(false);
    setScanned(false);
    Toast.show({
      type: 'success',
      text1: 'QR Code terpindai!',
      text2: `Mencari SKU: ${sku}`,
      visibilityTime: 1500,
    });
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
            <Text style={styles.buyPrice}>Beli: {formatIDR(item.buy_price)}</Text>
            <Text style={[styles.stock, isLowStock && styles.stockLow, isOutOfStock && styles.stockEmpty]}>
              Stok: {item.stock} {isOutOfStock ? '⚠️ Habis' : isLowStock ? '⚠️ Menipis' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.productActions}>
          {/* View QR Code */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/modals/barcode-view', params: { productId: item.id, sku: item.sku, name: item.name } })}
          >
            <Ionicons name="qr-code-outline" size={18} color={Colors.primary} />
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
            style={[styles.headerBtn, styles.catBtn]}
            onPress={() => {
              setDropdownOpen(false);
              setCatManagerVisible(true);
            }}
          >
            <Ionicons name="folder-open-outline" size={18} color={Colors.primary} />
            <Text style={styles.catBtnText}>Kategori</Text>
          </TouchableOpacity>
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
            onChangeText={(text) => setSearchQuery(text.replace(/#/g, '-'))}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: Spacing.xs }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.scanHeaderBtn}
          onPress={() => setScannerVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Category Dropdown Filter */}
      {categories.length > 0 && (
        <View style={styles.dropdownContainer}>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setDropdownOpen(!dropdownOpen)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <Ionicons name="filter-outline" size={16} color={Colors.primary} />
              <Text style={styles.dropdownBtnText}>
                Kategori: {selectedCategory ? (categories.find(c => c.id === selectedCategory)?.name || 'Semua') : 'Semua'}
              </Text>
            </View>
            <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownMenu}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                <TouchableOpacity
                  style={[styles.dropdownItem, selectedCategory === null && styles.dropdownItemActive]}
                  onPress={() => {
                    setSelectedCategory(null);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, selectedCategory === null && styles.dropdownItemTextActive]}>Semua</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.dropdownItem, selectedCategory === cat.id && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedCategory(cat.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selectedCategory === cat.id && styles.dropdownItemTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
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

      {/* Category Manager Modal */}
      <Modal
        visible={catManagerVisible}
        animationType="slide"
        onRequestClose={() => setCatManagerVisible(false)}
      >
        <SafeAreaView style={styles.catModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={styles.catModalHeader}>
              <Text style={styles.catModalTitle}>Kelola Kategori</Text>
              <TouchableOpacity onPress={() => setCatManagerVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Add New Category Row */}
            <View style={styles.addCatRow}>
              <TextInput
                style={styles.addCatInput}
                placeholder="Nama kategori baru..."
                placeholderTextColor={Colors.textMuted}
                value={newCatName}
                onChangeText={setNewCatName}
              />
              <TouchableOpacity style={styles.addCatBtnSubmit} onPress={handleAddCategory}>
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={styles.addCatBtnSubmitText}>Tambah</Text>
              </TouchableOpacity>
            </View>

            {/* Categories List */}
            <FlatList
              data={categories}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.catModalList}
              renderItem={({ item }) => (
                <View style={styles.catModalRow}>
                  {editingCatId === item.id ? (
                    <View style={{ flexDirection: 'row', flex: 1, gap: Spacing.sm, alignItems: 'center' }}>
                      <TextInput
                        style={[styles.addCatInput, { height: 38, flex: 1 }]}
                        value={editingCatName}
                        onChangeText={setEditingCatName}
                        autoFocus
                      />
                      <TouchableOpacity onPress={() => handleEditCategory(item.id)}>
                        <Ionicons name="checkmark-circle" size={24} color={Colors.accentGreen} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => {
                        setEditingCatId(null);
                        setEditingCatName('');
                      }}>
                        <Ionicons name="close-circle" size={24} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.catModalRowLeft}>
                        <Ionicons name="folder" size={20} color={Colors.primary} />
                        <Text style={styles.catModalRowName}>{item.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => {
                          setEditingCatId(item.id);
                          setEditingCatName(item.name);
                        }}>
                          <Ionicons name="pencil" size={16} color={Colors.accentOrange} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteCategory(item.id, item.name)}>
                          <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyCatContainer}>
                  <Ionicons name="folder-outline" size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyCatText}>Belum ada kategori</Text>
                </View>
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* QR Code Scanner Modal for Search */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => {
          setScannerVisible(false);
          setScanned(false);
        }}
      >
        <SafeAreaView style={styles.scannerModal}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Cari Berdasarkan QR Code</Text>
            <TouchableOpacity
              onPress={() => {
                setScannerVisible(false);
                setScanned(false);
              }}
              style={styles.scannerCloseBtn}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Camera View Area */}
          <View style={styles.cameraContainer}>
            {!cameraPermission ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
            ) : !cameraPermission.granted ? (
              <View style={styles.permissionContainer}>
                <Ionicons name="camera-outline" size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.sm }} />
                <Text style={styles.permissionText}>Aplikasi membutuhkan izin kamera untuk memindai QR Code.</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
                  <Text style={styles.permissionBtnText}>Berikan Izin Kamera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              scannerVisible && (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr', 'ean13', 'code128', 'code39'],
                  }}
                  onBarcodeScanned={handleBarcodeScanned}
                >
                  {/* Visual Viewfinder Overlay */}
                  <View style={styles.overlayContainer}>
                    <View style={styles.viewfinder}>
                      <View style={styles.viewfinderCornerTL} />
                      <View style={styles.viewfinderCornerTR} />
                      <View style={styles.viewfinderCornerBL} />
                      <View style={styles.viewfinderCornerBR} />
                      <View style={styles.laserLine} />
                    </View>
                    <Text style={styles.overlayInstructions}>
                      Arahkan kamera ke QR Code produk untuk mencari
                    </Text>
                  </View>
                </CameraView>
              )
            )}
          </View>
        </SafeAreaView>
      </Modal>

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
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 46,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.sizes.sm },
  scanHeaderBtn: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    width: 46,
    height: 46,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownContainer: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    zIndex: 10,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  dropdownBtnText: {
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
    fontWeight: '600',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
    overflow: 'hidden',
    zIndex: 999,
  },
  dropdownItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemActive: {
    backgroundColor: Colors.primary + '15',
  },
  dropdownItemText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
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
  buyPrice: { color: Colors.textSecondary, fontSize: 10, marginTop: 1 },
  stockLow: { color: Colors.warning },
  stockEmpty: { color: Colors.error },
  productActions: { gap: Spacing.xs },
  actionBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  catBtn: {
    backgroundColor: Colors.primary + '22',
    borderWidth: 1, borderColor: Colors.primary + '44',
    flexDirection: 'row', gap: 4,
  },
  catBtnText: { color: Colors.primary, fontWeight: '700', fontSize: Fonts.sizes.sm },
  catModal: { flex: 1, backgroundColor: Colors.background },
  catModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  catModalTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  addCatRow: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center',
  },
  addCatInput: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    color: Colors.text, fontSize: Fonts.sizes.sm, borderWidth: 1, borderColor: Colors.border,
  },
  addCatBtnSubmit: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingHorizontal: Spacing.md, height: 44,
  },
  addCatBtnSubmitText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
  catModalList: { padding: Spacing.base },
  catModalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  catModalRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  catModalRowName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  emptyCatContainer: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyCatText: { color: Colors.textMuted, fontSize: Fonts.sizes.sm },

  // QR Code Scanner Modal Styles
  scannerModal: { flex: 1, backgroundColor: Colors.background },
  scannerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  scannerTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  scannerCloseBtn: { padding: Spacing.xs },
  cameraContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.base },
  permissionText: { color: Colors.textSecondary, textAlign: 'center', fontSize: Fonts.sizes.sm, lineHeight: 20 },
  permissionBtn: { backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.lg },
  permissionBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
  overlayContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  viewfinder: {
    width: 250, height: 250, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative', justifyContent: 'center', alignItems: 'center',
  },
  viewfinderCornerTL: { position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTopWidth: 4, borderLeftWidth: 4, borderColor: Colors.primary, borderTopLeftRadius: 8 },
  viewfinderCornerTR: { position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTopWidth: 4, borderRightWidth: 4, borderColor: Colors.primary, borderTopRightRadius: 8 },
  viewfinderCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: Colors.primary, borderBottomLeftRadius: 8 },
  viewfinderCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottomWidth: 4, borderRightWidth: 4, borderColor: Colors.primary, borderBottomRightRadius: 8 },
  laserLine: { width: '85%', height: 2, backgroundColor: Colors.accent, position: 'absolute' },
  overlayInstructions: { color: Colors.white, marginTop: Spacing.lg, fontSize: Fonts.sizes.sm, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
});
