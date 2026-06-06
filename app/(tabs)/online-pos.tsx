import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Dimensions, RefreshControl,
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
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

export default function OnlinePOSScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  
  // Shipping Form Modal State
  const [shippingModalVisible, setShippingModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [shippingFee, setShippingFee] = useState('');
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
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      Toast.show({ type: 'error', text1: 'Form Belum Lengkap', text2: 'Mohon isi semua data pengiriman' });
      return;
    }

    const parsedFee = parseFloat(shippingFee.replace(/[^0-9]/g, '')) || 0;

    setCheckingOut(true);
    try {
      const { transactionId, invoiceNumber } = await createTransaction(
        cart,
        'ONLINE',
        'PENDING',
        customerName.trim(),
        customerPhone.trim(),
        customerAddress.trim(),
        parsedFee
      );
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setShippingFee('');
      setShippingModalVisible(false);
      setCartVisible(false);
      Toast.show({ type: 'success', text1: 'Transaksi Pending Berhasil Disimpan!', text2: invoiceNumber });
      
      // Redirect to checkout/receipt screen with transactionId and flag indicating it's online
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

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleOpenScanner = async () => {
    if (!cameraPermission || !cameraPermission.granted) {
      const status = await requestCameraPermission();
      if (!status.granted) {
        Toast.show({
          type: 'error',
          text1: 'Izin Kamera Ditolak',
          text2: 'Mohon berikan izin kamera pada pengaturan perangkat Anda.',
        });
        return;
      }
    }
    setLastScannedProduct(null);
    setScannerVisible(true);
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const cartItem = cart.find((c) => c.product.id === item.id);
    const qtyInCart = cartItem ? cartItem.quantity : 0;
    const isOutOfStock = item.stock === 0;

    return (
      <View style={[styles.productCard, isOutOfStock && styles.outOfStockCard]}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {item.picture ? (
            <Image source={{ uri: item.picture }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube-outline" size={24} color={Colors.primary} />
            </View>
          )}
          {isOutOfStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>HABIS</Text>
            </View>
          )}
        </View>

        {/* Product Details */}
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productSku}>{item.sku}</Text>
          <Text style={styles.productPrice}>{formatIDR(item.fix_price)}</Text>
          
          <View style={styles.stockRow}>
            <Ionicons name="layers-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.productStock}>Stok: {item.stock}</Text>
          </View>
        </View>

        {/* Quantity control footer */}
        <View style={styles.productFooter}>
          {qtyInCart > 0 ? (
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQty(item.id, -1)}
              >
                <Ionicons name="remove" size={16} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qtyInCart}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => addToCart(item)}
              >
                <Ionicons name="add" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
              onPress={() => !isOutOfStock && addToCart(item)}
              disabled={isOutOfStock}
            >
              <Ionicons name="cart-outline" size={16} color={Colors.white} />
              <Text style={styles.addBtnText}>Tambah</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subtitle}>Kasir Pemesanan</Text>
          <Text style={styles.title}>Online Shop</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => router.push('/modals/history')}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanBtn} onPress={handleOpenScanner} activeOpacity={0.7}>
            <Ionicons name="qr-code-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama produk atau SKU..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setLoading(true);
          }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setLoading(true); }}>
            <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Product List Grid */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProductItem}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Tidak ada produk ditemukan</Text>
            </View>
          }
        />
      )}

      {/* Persistent Floating Cart Bar */}
      {cart.length > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          activeOpacity={0.9}
          onPress={() => setCartVisible(true)}
        >
          <View style={styles.cartInfo}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalItems}</Text>
            </View>
            <View>
              <Text style={styles.cartTotalLabel}>Total Belanja</Text>
              <Text style={styles.cartTotalPrice}>{formatIDR(totalAmount)}</Text>
            </View>
          </View>
          <View style={styles.viewCart}>
            <Text style={styles.viewCartText}>Buka Keranjang</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.white} />
          </View>
        </TouchableOpacity>
      )}

      {/* Shopping Cart Drawer Modal */}
      <Modal
        visible={cartVisible}
        animationType="slide"
        onRequestClose={() => setCartVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Cart Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCartVisible(false)}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Keranjang Online Shop</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Cart Items List */}
          <FlatList
            data={cart}
            keyExtractor={(item) => item.product.id.toString()}
            contentContainerStyle={styles.cartList}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemDetails}>
                  <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                  <Text style={styles.cartItemSku}>{item.product.sku}</Text>
                  <Text style={styles.cartItemPrice}>{formatIDR(item.product.fix_price)} / pcs</Text>
                </View>
                <View style={styles.cartItemRight}>
                  <View style={styles.cartQtyControls}>
                    <TouchableOpacity
                      style={styles.cartQtyBtn}
                      onPress={() => updateQty(item.product.id, -1)}
                    >
                      <Ionicons name="remove" size={14} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.cartQtyVal}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.cartQtyBtn}
                      onPress={() => addToCart(item.product)}
                    >
                      <Ionicons name="add" size={14} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cartItemSubtotal}>
                    {formatIDR(item.product.fix_price * item.quantity)}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cart-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Keranjang belanja kosong</Text>
              </View>
            }
          />

          {/* Checkout Footer Summary */}
          {cart.length > 0 && (
            <View style={styles.modalFooter}>
              <View style={styles.priceSummary}>
                <Text style={styles.summaryText}>Total Belanja ({totalItems} item)</Text>
                <Text style={styles.summaryPrice}>{formatIDR(totalAmount)}</Text>
              </View>

              <View style={styles.checkoutActionRow}>
                <TouchableOpacity
                  style={[styles.payBtn, checkingOut && styles.payBtnDisabled]}
                  onPress={() => setShippingModalVisible(true)}
                  disabled={checkingOut}
                >
                  {checkingOut ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="receipt-outline" size={20} color={Colors.white} />
                      <Text style={styles.payBtnText}>Simpan & Cetak Invoice</Text>
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
            </View>
          )}
        </SafeAreaView>

        {/* Clear Cart Confirmation Modal */}
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

        {/* Shipping Form Input Modal */}
        <Modal
          visible={shippingModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setShippingModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.shippingOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.shippingCard}>
              <View style={styles.shippingHeader}>
                <Ionicons name="document-text-outline" size={28} color={Colors.primary} />
                <Text style={styles.shippingTitle}>Data Pengiriman Penerima</Text>
              </View>
              
              <ScrollView style={styles.shippingForm} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Nama Penerima *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Contoh: Dhany R.A"
                  placeholderTextColor={Colors.textMuted}
                  value={customerName}
                  onChangeText={setCustomerName}
                />

                <Text style={styles.inputLabel}>No. Handphone *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Contoh: (+62) 81-137-0404"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                />

                <Text style={styles.inputLabel}>Ongkos Kirim (Rp) *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Contoh: 15000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={shippingFee}
                  onChangeText={setShippingFee}
                />

                <Text style={styles.inputLabel}>Alamat Lengkap *</Text>
                <TextInput
                  style={[styles.formInput, styles.textAreaInput]}
                  placeholder="Contoh: Perumahan Citra Harmoni F4/3-5, Kel.Sidodadi, Kec.Taman, Sidoarjo"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={customerAddress}
                  onChangeText={setCustomerAddress}
                />
              </ScrollView>

              <View style={styles.shippingActions}>
                <TouchableOpacity
                  style={styles.shippingCancelBtn}
                  onPress={() => setShippingModalVisible(false)}
                  disabled={checkingOut}
                >
                  <Text style={styles.shippingCancelText}>Batal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.shippingSubmitBtn, checkingOut && styles.payBtnDisabled]}
                  onPress={handleCheckout}
                  disabled={checkingOut}
                >
                  {checkingOut ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.shippingSubmitText}>Buat Order Pending</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Modal>

      {/* QR Code Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => {
          setScannerVisible(false);
          setScanned(false);
        }}
      >
        <View style={styles.scannerModal}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan QR Code Produk</Text>
            <TouchableOpacity
              onPress={() => {
                setScannerVisible(false);
                setScanned(false);
              }}
            >
              <Ionicons name="close" size={24} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'code128', 'code39'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          >
            {/* Finders / Overlay targeting boxes */}
            <View style={styles.overlayContainer}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.middleContainer}>
                <View style={styles.unfocusedContainer} />
                <View style={styles.focusedContainer}>
                  {/* Viewfinder borders */}
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  {/* Dotted Laser */}
                  <View style={styles.laser} />
                </View>
                <View style={styles.unfocusedContainer} />
              </View>
              <View style={styles.unfocusedContainer} />
            </View>
          </CameraView>

          {/* Scanner Footer Tips / Scanning info */}
          <View style={styles.scannerFooter}>
            <Ionicons name="information-circle" size={16} color={Colors.primary} />
            <Text style={styles.scannerTips}>
              Posisikan QR Code di dalam kotak tengah untuk mendeteksi secara otomatis.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  subtitle: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Colors.primary, fontSize: Fonts.sizes.xl, fontWeight: '900' },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    paddingHorizontal: Spacing.md,
    height: 46,
    marginBottom: Spacing.base,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.sizes.sm },
  loader: { flex: 1, justifyContent: 'center' },
  listContent: {
    paddingHorizontal: Spacing.base - 4,
    paddingBottom: 100,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    margin: 4,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    ...Shadow.sm,
  },
  outOfStockCard: { opacity: 0.6 },
  imageContainer: {
    height: 100,
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outOfStockBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  outOfStockText: { color: Colors.white, fontSize: 8, fontWeight: '800' },
  productDetails: { padding: Spacing.sm, flex: 1 },
  productName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700', marginBottom: 2 },
  productSku: { color: Colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginBottom: 4 },
  productPrice: { color: Colors.accentGreen, fontSize: Fonts.sizes.sm, fontWeight: '800' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  productStock: { color: Colors.textMuted, fontSize: 10 },
  productFooter: {
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    padding: Spacing.xs,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
    width: '100%',
  },
  addBtnDisabled: { backgroundColor: Colors.textMuted },
  addBtnText: { color: Colors.white, fontSize: Fonts.sizes.xs, fontWeight: '700' },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '18',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  qtyBtn: { padding: 6, paddingHorizontal: 10 },
  qtyText: { color: Colors.primary, fontWeight: '700', paddingHorizontal: 8, fontSize: Fonts.sizes.sm },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.textMuted, fontSize: Fonts.sizes.sm, marginTop: Spacing.sm },
  cartBar: {
    position: 'absolute',
    bottom: Spacing.base,
    left: Spacing.base,
    right: Spacing.base,
    height: 60,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    ...Shadow.lg,
  },
  cartInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    backgroundColor: Colors.white,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: Colors.primary, fontSize: Fonts.sizes.xs, fontWeight: '800' },
  cartTotalLabel: { color: Colors.white + 'cc', fontSize: 10, fontWeight: '500' },
  cartTotalPrice: { color: Colors.white, fontSize: Fonts.sizes.sm, fontWeight: '800' },
  viewCart: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewCartText: { color: Colors.white, fontSize: Fonts.sizes.xs, fontWeight: '800' },

  // Modal styling
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  cartList: { paddingBottom: 160 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartItemDetails: { flex: 1 },
  cartItemName: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600', marginBottom: 2 },
  cartItemSku: { color: Colors.textMuted, fontSize: 10, fontFamily: 'monospace', marginBottom: 4 },
  cartItemPrice: { color: Colors.textMuted, fontSize: 11 },
  cartItemRight: { alignItems: 'flex-end', gap: Spacing.sm },
  cartQtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cartQtyBtn: { padding: 5, paddingHorizontal: 8 },
  cartQtyVal: { color: Colors.text, fontWeight: '700', paddingHorizontal: 6, fontSize: Fonts.sizes.xs },
  cartItemSubtotal: { color: Colors.accentGreen, fontWeight: '800', fontSize: Fonts.sizes.sm },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.base,
    paddingBottom: Platform.OS === 'ios' ? 24 : Spacing.base,
    ...Shadow.lg,
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  summaryText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  summaryPrice: { color: Colors.accentGreen, fontSize: Fonts.sizes.md, fontWeight: '900' },
  checkoutActionRow: { gap: Spacing.sm },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentGreen,
    borderRadius: Radius.lg,
    height: 48,
    gap: Spacing.sm,
    ...Shadow.md,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: Colors.white, fontSize: Fonts.sizes.sm, fontWeight: '800' },
  clearBtn: { alignItems: 'center', padding: Spacing.sm },
  clearBtnText: { color: Colors.error, fontSize: Fonts.sizes.sm, fontWeight: '600' },

  // Scanner UI
  scannerModal: { flex: 1, backgroundColor: Colors.background },
  scannerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, zIndex: 10,
    backgroundColor: Colors.background,
  },
  scannerTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  overlayContainer: { flex: 1, flexDirection: 'column' },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  middleContainer: { flexDirection: 'row', height: 260 },
  focusedContainer: {
    width: 260, height: 260, position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute', width: 24, height: 24,
    borderColor: Colors.primary, borderWidth: 4,
  },
  cornerTopLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTopRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  laser: {
    position: 'absolute', left: 8, right: 8, top: '50%',
    height: 2, backgroundColor: '#EF4444',
  },
  scannerFooter: {
    position: 'absolute', bottom: 40, left: Spacing.base, right: Spacing.base,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.base, flexDirection: 'row', gap: Spacing.sm,
    borderColor: Colors.border, borderWidth: 1,
  },
  scannerTips: { color: Colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },

  // Shipping Modal
  shippingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  shippingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderColor: Colors.border,
    borderWidth: 1,
    width: '100%',
    maxHeight: '80%',
    padding: Spacing.lg,
    ...Shadow.lg,
  },
  shippingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  shippingTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  shippingForm: { flexGrow: 0, marginBottom: Spacing.md },
  inputLabel: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600', marginBottom: 6 },
  formInput: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.base,
    fontSize: Fonts.sizes.sm,
  },
  textAreaInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
  },
  shippingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  shippingCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippingCancelText: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600' },
  shippingSubmitBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shippingSubmitText: { color: Colors.white, fontSize: Fonts.sizes.sm, fontWeight: '700' },
});
