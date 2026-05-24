import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Dimensions, RefreshControl,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveProducts, searchProducts, getProductBySku } from '@/db/products';
import { createTransaction } from '@/db/transactions';
import { Product, CartItem } from '@/types';
import { formatIDR } from '@/utils/currency';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.base * 2 - Spacing.sm * 2) / 3;

export default function POSScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

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

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const addToCart = (product: Product) => {
    if (product.stock === 0) {
      Toast.show({ type: 'error', text1: 'Stok habis', text2: product.name });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Toast.show({ type: 'error', text1: 'Stok tidak mencukupi' });
          return prev;
        }
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    Toast.show({ type: 'success', text1: product.name, text2: 'Ditambahkan ke keranjang', visibilityTime: 1000 });
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

  const renderProduct = ({ item }: { item: Product }) => {
    const inCart = cart.find((c) => c.product.id === item.id);
    const isOut = item.stock === 0;
    return (
      <TouchableOpacity
        style={[styles.productCard, isOut && styles.productCardOut]}
        onPress={() => addToCart(item)}
        activeOpacity={0.75}
        disabled={isOut}
      >
        <View style={styles.productImg}>
          {item.picture ? (
            <Image source={{ uri: item.picture }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={24} color={isOut ? Colors.textMuted : Colors.primary} />
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
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>{formatIDR(item.fix_price)}</Text>
          <Text style={styles.productStock}>Stok: {item.stock}</Text>
        </View>
      </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => setCartVisible(true)}
        >
          <Ionicons name="cart" size={22} color={Colors.white} />
          {totalItems > 0 && (
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{totalItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Product Grid */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          numColumns={3}
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
        presentationStyle="pageSheet"
        onRequestClose={() => setCartVisible(false)}
      >
        <View style={styles.cartModal}>
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
                  onPress={handleCheckout}
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
        </View>
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
  title: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },
  cartBtn: {
    backgroundColor: Colors.primary, width: 48, height: 48,
    borderRadius: 24, alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  cartCount: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.accent, width: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  cartCountText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  searchRow: { paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 44,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.sizes.sm },
  loader: { marginTop: 60 },
  grid: { padding: Spacing.base, paddingTop: 0 },
  row: { gap: Spacing.sm, marginBottom: Spacing.sm },
  productCard: {
    width: CARD_WIDTH, backgroundColor: Colors.card,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  productCardOut: { opacity: 0.5 },
  productImg: {
    height: 80, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  cartBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: Colors.primary, width: 22, height: 22,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  outBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: Colors.error, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  outBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  productInfo: { padding: Spacing.sm },
  productName: { color: Colors.text, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  productPrice: { color: Colors.accentGreen, fontWeight: '800', fontSize: 11 },
  productStock: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
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
});
