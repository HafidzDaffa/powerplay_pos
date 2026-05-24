import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Fonts } from '../constants/theme';
import { CartItem as CartItemType } from '../types';
import { formatIDR } from '../utils/currency';

interface CartItemProps {
  item: CartItemType;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}

export default function CartItem({ item, onIncrease, onDecrease, onRemove }: CartItemProps) {
  const subtotal = item.product.fix_price * item.quantity;
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.product.name}</Text>
        <Text style={styles.price}>{formatIDR(item.product.fix_price)} / pcs</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onDecrease}>
          <Ionicons name="remove" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={onIncrease}>
          <Ionicons name="add" size={16} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.right}>
        <Text style={styles.subtotal}>{formatIDR(subtotal)}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  info: { flex: 1 },
  name: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '600', marginBottom: 2 },
  price: { color: Colors.textMuted, fontSize: 11 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  qtyBtn: { padding: 6, backgroundColor: Colors.surfaceElevated },
  qty: { color: Colors.text, fontWeight: '700', paddingHorizontal: 10, fontSize: Fonts.sizes.sm },
  right: { alignItems: 'flex-end', gap: 4 },
  subtotal: { color: Colors.accentGreen, fontWeight: '700', fontSize: Fonts.sizes.sm },
});
