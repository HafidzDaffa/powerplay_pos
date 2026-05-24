import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Fonts, Shadow } from '../constants/theme';
import { Product } from '../types';
import { formatIDR } from '../utils/currency';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  onViewBarcode?: (product: Product) => void;
  onDownloadBarcode?: (product: Product) => void;
  showBarcodeActions?: boolean;
  disabled?: boolean;
}

export default function ProductCard({
  product,
  onPress,
  onViewBarcode,
  onDownloadBarcode,
  showBarcodeActions = false,
  disabled = false,
}: ProductCardProps) {
  const isLowStock = product.stock <= 5;
  const isOutOfStock = product.stock === 0;

  return (
    <TouchableOpacity
      style={[styles.card, isOutOfStock && styles.outOfStock, disabled && styles.disabled]}
      onPress={() => !disabled && onPress(product)}
      activeOpacity={0.75}
    >
      {/* Product image or placeholder */}
      <View style={styles.imageContainer}>
        {product.picture ? (
          <Image source={{ uri: product.picture }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color={Colors.primary} />
          </View>
        )}
        {isOutOfStock && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Habis</Text>
          </View>
        )}
      </View>

      {/* Product info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.sku}>{product.sku}</Text>
        {product.category_name && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{product.category_name}</Text>
          </View>
        )}
        <Text style={styles.price}>{formatIDR(product.fix_price)}</Text>
        {product.discount > 0 && (
          <Text style={styles.originalPrice}>{formatIDR(product.sell_price)}</Text>
        )}
        <View style={[styles.stockRow, isLowStock && styles.stockLow]}>
          <Ionicons
            name="layers-outline"
            size={12}
            color={isLowStock ? Colors.warning : Colors.textSecondary}
          />
          <Text style={[styles.stock, isLowStock && styles.stockTextLow]}>
            Stok: {product.stock}
          </Text>
        </View>
      </View>

      {/* Barcode actions */}
      {showBarcodeActions && (
        <View style={styles.barcodeActions}>
          <TouchableOpacity
            style={styles.barcodeBtn}
            onPress={() => onViewBarcode?.(product)}
          >
            <Ionicons name="barcode-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.barcodeBtn}
            onPress={() => onDownloadBarcode?.(product)}
          >
            <Ionicons name="download-outline" size={18} color={Colors.accentGreen} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  outOfStock: {
    opacity: 0.6,
    borderColor: Colors.error + '44',
  },
  disabled: { opacity: 0.5 },
  imageContainer: {
    width: '100%',
    height: 100,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outOfStockText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  info: { padding: Spacing.sm },
  name: {
    color: Colors.text,
    fontSize: Fonts.sizes.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  sku: {
    color: Colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  categoryBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  categoryText: { color: Colors.primary, fontSize: 10, fontWeight: '600' },
  price: {
    color: Colors.accentGreen,
    fontSize: Fonts.sizes.sm,
    fontWeight: '800',
  },
  originalPrice: {
    color: Colors.textMuted,
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  stockLow: {},
  stock: { color: Colors.textSecondary, fontSize: 10 },
  stockTextLow: { color: Colors.warning, fontWeight: '600' },
  barcodeActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  barcodeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
});
