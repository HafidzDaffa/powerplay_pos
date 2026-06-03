import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Dimensions, RefreshControl,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveProducts, searchProducts, getProductBySku } from '@/db/products';
import { createTransaction } from '@/db/transactions';
import { Product, CartItem } from '@/types';
import { formatIDR } from '@/utils/currency';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.base * 2 - Spacing.sm) / 2;

export default function POSScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // QR Code Scanner State
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const prods = searchQuery
        ? await searchProducts(searchQuery)
        : await getActiveProducts();
      setProducts(prods);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const addToCart = (product: Product) => {
    if (product.stock === 0) {
      Toast.show({
        type: 'error',
        text1: 'Stok Produk Kosong!',
        text2: `${product.name} tidak memiliki sisa stok.`,
        visibilityTime: 2500,
      });
      return;
    }

    let addedSuccessfully = false;
    let warningMessage = '';

    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty >= product.stock) {
        Toast.show({
          type: 'error',
          text1: 'Stok Tidak Mencukupi!',
          text2: `Batas stok ${product.name} adalah ${product.stock} pcs.`,
          visibilityTime: 2500,
        });
        return prev;
      }

      addedSuccessfully = true;
      const newQty = currentQty + 1;

      // Check if remaining stock is very low (e.g., <= 3 pcs remaining)
      const remainingStock = product.stock - newQty;
      if (remainingStock <= 3 && remainingStock > 0) {
        warningMessage = `Stok hampir habis! Tersisa ${remainingStock} pcs.`;
      }

      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: newQty } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    if (addedSuccessfully) {
      Toast.show({
        type: warningMessage ? 'info' : 'success',
        text1: warningMessage ? warningMessage : `${product.name} ditambahkan`,
        text2: warningMessage ? `${product.name} dimasukkan ke keranjang` : 'Berhasil masuk keranjang',
        visibilityTime: warningMessage ? 2500 : 1500,
      });
    }
  };

  const updateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalAmount = cart.reduce((sum, c) => sum + c.product.fix_price * c.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const { transactionId, invoiceNumber } = await createTransaction(cart);
      setCart([]);
      setCartVisible(false);
      Toast.show({ type: 'success', text1: 'Transaksi berhasil!', text2: invoiceNumber });
      router.push({ pathname: '/modals/checkout', params: { transactionId } });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Transaksi gagal', text2: e.message });
    } finally {
      setCheckingOut(false);
    }
  };

  // QR Code scan callback
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!data || scanned) return;
    setScanned(true); // Disable scanner temporarily to prevent duplicates
    try {
      const sku = data.trim().replace(/#/g, '-');
      const product = await getProductBySku(sku);
      if (!product) {
        Toast.show({
          type: 'error',
          text1: 'Produk tidak ditemukan',
          text2: `SKU: ${sku}`,
          visibilityTime: 2000,
        });
      } else if (product.stock === 0) {
        Toast.show({
          type: 'error',
          text1: 'Stok Produk Kosong!',
          text2: `${product.name} tidak memiliki sisa stok.`,
          visibilityTime: 2500,
        });
        setScannerVisible(false); // AUTO CLOSE MODAL ON EMPTY STOCK!
      } else {
        // Check if product is already in cart and at max stock
        const existing = cart.find((c) => c.product.id === product.id);
        const currentQty = existing ? existing.quantity : 0;
        if (currentQty >= product.stock) {
          Toast.show({
            type: 'error',
            text1: 'Stok Tidak Mencukupi!',
            text2: `Batas stok ${product.name} adalah ${product.stock} pcs.`,
            visibilityTime: 2500,
          });
          setScannerVisible(false); // AUTO CLOSE MODAL ON INSUFFICIENT STOCK!
        } else {
          // Add item to cart
          addToCart(product);
          setLastScannedProduct(product);
          setScannerVisible(false); // AUTO CLOSE MODAL!
        }
      }
    } catch (err) {
      console.error(err);
      Toast.show({
        type: 'error',
        text1: 'Gagal memindai',
        visibilityTime: 1500,
      });
    } finally {
      setScanned(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const inCart = cart.find((c) => c.product.id === item.id);
    const isOut = item.stock === 0;
    return (
      <View style={[styles.productCard, isOut && styles.productCardOut]}>
        {/* Tappable Info Area */}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => !isOut && !inCart && addToCart(item)}
          disabled={isOut || !!inCart}
          activeOpacity={0.75}
        >
          <View style={styles.productImg}>
            {item.picture ? (
              <Image source={{ uri: item.picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : (
              <Ionicons name="cube-outline" size={32} color={isOut ? Colors.textMuted : Colors.primary} />
            )}
            {inCart && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{inCart.quantity}</Text>
              </View>
            )}
            {isOut && (
              <View style={styles.outBadge}>
                <Text style={styles.outBadgeText}>Habis</Text>
              </View>
            )}
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.productSku}>{item.sku}</Text>
            <Text style={styles.productPrice}>{formatIDR(item.fix_price)}</Text>
            <Text style={styles.productStock}>Stok: {item.stock}</Text>
          </View>
        </TouchableOpacity>

        {/* Quantity +/- Buttons Block */}
        <View style={styles.actionContainer}>
          {inCart ? (
            <View style={styles.qtyContainer}>
              <TouchableOpacity
                style={styles.qtyCardBtn}
                onPress={() => updateQty(item.id, -1)}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{inCart.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyCardBtn}
                onPress={() => addToCart(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, isOut && styles.addBtnDisabled]}
              onPress={() => !isOut && addToCart(item)}
              disabled={isOut}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={14} color={isOut ? Colors.textMuted : Colors.white} style={{ marginRight: 4 }} />
              <Text style={[styles.addBtnText, isOut && styles.addBtnTextDisabled]}>
                {isOut ? 'Habis' : 'Tambah'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kasir</Text>
          <Text style={styles.sub}>Pilih produk untuk ditambahkan</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push('/modals/history')}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => setCartVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="cart" size={22} color={Colors.white} />
            {totalItems > 0 && (
              <View style={styles.cartCount}>
                <Text style={styles.cartCountText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Scan Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk..."
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

      {/* Product Grid */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={2}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProducts(); }} tintColor={Colors.primary} />
          }
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Checkout Bar */}
      {cart.length > 0 && (
        <View style={styles.checkoutBar}>
          <View>
            <Text style={styles.checkoutTotal}>{formatIDR(totalAmount)}</Text>
            <Text style={styles.checkoutItems}>{totalItems} item di keranjang</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => setCartVisible(true)}
          >
            <Ionicons name="cart-outline" size={20} color={Colors.white} />
            <Text style={styles.checkoutBtnText}>Lihat Keranjang</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Modal */}
      <Modal
        visible={cartVisible}
        animationType="slide"
        onRequestClose={() => setCartVisible(false)}
      >
        <SafeAreaView style={styles.cartModal}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Keranjang Belanja</Text>
            <TouchableOpacity onPress={() => setCartVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Ionicons name="cart-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyCartText}>Keranjang kosong</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.cartItems}>
                {cart.map((item) => (
                  <View key={item.product.id} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                      <Text style={styles.cartItemPrice}>{formatIDR(item.product.fix_price)}</Text>
                    </View>
                    <View style={styles.cartQtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product.id, -1)}>
                        <Ionicons name="remove" size={16} color={Colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qty}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product.id, 1)}>
                        <Ionicons name="add" size={16} color={Colors.text} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.subtotal}>{formatIDR(item.product.fix_price * item.quantity)}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(item.product.id)} style={styles.removeBtn}>
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.cartFooter}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{formatIDR(totalAmount)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.payBtn, checkingOut && styles.payBtnDisabled]}
                  onPress={() => setConfirmCheckout(true)}
                  disabled={checkingOut}
                >
                  {checkingOut ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                      <Text style={styles.payBtnText}>Bayar {formatIDR(totalAmount)}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => setConfirmClear(true)}
                >
                  <Text style={styles.clearBtnText}>Kosongkan Keranjang</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </SafeAreaView>

        <ConfirmModal
          visible={confirmClear}
          title="Kosongkan Keranjang?"
          message="Semua item akan dihapus dari keranjang."
          confirmText="Kosongkan"
          confirmColor={Colors.error}
          icon="trash-outline"
          onConfirm={() => { setCart([]); setConfirmClear(false); }}
          onCancel={() => setConfirmClear(false)}
        />

        <ConfirmModal
          visible={confirmCheckout}
          title="Konfirmasi Pembayaran"
          message="Apakah daftar produk yang dimasukkan ke keranjang sudah benar?"
          confirmText="Ya, Sudah Benar"
          cancelText="Periksa Kembali"
          confirmColor={Colors.accentGreen}
          icon="help-circle-outline"
          onConfirm={() => {
            setConfirmCheckout(false);
            handleCheckout();
          }}
          onCancel={() => setConfirmCheckout(false)}
        />
      </Modal>

      {/* QR Code Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => {
          setScannerVisible(false);
          setLastScannedProduct(null);
        }}
      >
        <SafeAreaView style={styles.scannerModal}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Pindai QR Code Produk</Text>
            <TouchableOpacity
              onPress={() => {
                setScannerVisible(false);
                setLastScannedProduct(null);
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
                      Arahkan kamera ke QR Code produk
                    </Text>
                  </View>
                </CameraView>
              )
            )}
          </View>

          {/* Last Scanned Status Bar */}
          <View style={styles.scannerFooter}>
            {lastScannedProduct ? (
              <View style={styles.lastScannedRow}>
                <Ionicons name="checkmark-circle-outline" size={24} color={Colors.accentGreen} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lastScannedName} numberOfLines={1}>
                    {lastScannedProduct.name}
                  </Text>
                  <Text style={styles.lastScannedSku}>{lastScannedProduct.sku}</Text>
                </View>
                <View style={styles.lastScannedQtyWrap}>
                  <Text style={styles.lastScannedQty}>
                    {cart.find((c) => c.product.id === lastScannedProduct.id)?.quantity ?? 0}x
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.scannerFooterPlaceholder}>Belum ada produk yang dipindai</Text>
            )}
            <View style={styles.scannerCartSummary}>
              <Text style={styles.scannerCartText}>Total: {totalItems} Item ({formatIDR(totalAmount)})</Text>
              <TouchableOpacity
                style={styles.scannerCartBtn}
                onPress={() => {
                  setScannerVisible(false);
                  setCartVisible(true);
                }}
              >
                <Text style={styles.scannerCartBtnText}>Lihat Keranjang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  historyBtn: {
    backgroundColor: Colors.surfaceElevated,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  cartBtn: {
    backgroundColor: Colors.primary, width: 48, height: 48,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  title: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },
  cartCount: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.accent, width: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  cartCountText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 44,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.sizes.sm },
  scanHeaderBtn: {
    backgroundColor: Colors.primary + '15',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: 60 },
  grid: { padding: Spacing.base, paddingTop: 0 },
  row: { gap: Spacing.sm, marginBottom: Spacing.sm },
  productCard: {
    width: CARD_WIDTH, backgroundColor: Colors.card,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
    paddingBottom: Spacing.sm,
  },
  productCardOut: { opacity: 0.5 },
  productImg: {
    height: 100, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
    marginBottom: Spacing.xs,
  },
  cartBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: Colors.primary, width: 22, height: 22,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  cartBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  outBadge: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: Colors.error, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 3,
  },
  outBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  productInfo: { paddingHorizontal: Spacing.sm, paddingBottom: 2 },
  productName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700', marginBottom: 2 },
  productSku: { color: Colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginTop: 1, marginBottom: 3 },
  productPrice: { color: Colors.accentGreen, fontWeight: '800', fontSize: Fonts.sizes.sm },
  productStock: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  actionContainer: {
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary + '33',
    borderWidth: 1,
    borderRadius: Radius.md,
    height: 36,
    overflow: 'hidden',
  },
  qtyCardBtn: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  qtyText: {
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
    fontWeight: '800',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 36,
  },
  addBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: Fonts.sizes.xs,
    fontWeight: '700',
  },
  addBtnTextDisabled: {
    color: Colors.textMuted,
  },

  checkoutBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, padding: Spacing.base,
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.lg,
  },
  checkoutTotal: { color: Colors.accentGreen, fontSize: Fonts.sizes.lg, fontWeight: '800' },
  checkoutItems: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    gap: Spacing.sm, ...Shadow.sm,
  },
  checkoutBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
  cartModal: { flex: 1, backgroundColor: Colors.background },
  cartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cartTitle: { color: Colors.text, fontSize: Fonts.sizes.lg, fontWeight: '800' },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  emptyCartText: { color: Colors.textMuted, fontSize: Fonts.sizes.md },
  cartItems: { flex: 1 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm,
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  cartItemPrice: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  cartQtyControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, overflow: 'hidden',
  },
  qtyBtn: { padding: Spacing.sm, backgroundColor: Colors.surfaceElevated },
  qty: { color: Colors.text, fontWeight: '700', paddingHorizontal: 10, fontSize: Fonts.sizes.sm },
  subtotal: { color: Colors.accentGreen, fontWeight: '700', fontSize: Fonts.sizes.sm, minWidth: 80, textAlign: 'right' },
  removeBtn: { padding: Spacing.xs },
  cartFooter: {
    padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.surface, gap: Spacing.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  totalLabel: { color: Colors.textSecondary, fontSize: Fonts.sizes.md, fontWeight: '600' },
  totalValue: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, ...Shadow.md,
  },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { color: Colors.white, fontWeight: '800', fontSize: Fonts.sizes.md },
  clearBtn: { alignItems: 'center', padding: Spacing.sm },
  clearBtnText: { color: Colors.error, fontSize: Fonts.sizes.sm, fontWeight: '600' },

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
  scannerFooter: { backgroundColor: Colors.surface, padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border },
  lastScannedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  lastScannedName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700' },
  lastScannedSku: { color: Colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  lastScannedQtyWrap: { backgroundColor: Colors.primary, borderRadius: Radius.full, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  lastScannedQty: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  scannerFooterPlaceholder: { color: Colors.textMuted, fontSize: Fonts.sizes.sm, fontStyle: 'italic', textAlign: 'center', marginBottom: Spacing.base },
  scannerCartSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scannerCartText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  scannerCartBtn: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: Radius.md },
  scannerCartBtnText: { color: Colors.primary, fontSize: Fonts.sizes.xs, fontWeight: '700' },
});
