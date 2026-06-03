import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getProductById, insertProduct, updateProduct } from '@/db/products';
import { getActiveCategories, insertCategory } from '@/db/categories';
import { ProductFormData, Category } from '@/types';
import { generateSKU } from '@/utils/currency';
import Toast from 'react-native-toast-message';

const INITIAL_FORM: ProductFormData = {
  sku: '', name: '', category_id: null,
  buy_price: '', sell_price: '', discount: '0',
  fix_price: '', stock: '0', picture: null,
};

const InputField = ({ label, value, onChangeText, keyboardType, placeholder, required }: any) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
    />
  </View>
);

export default function ProductFormModal() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const isEdit = !!productId;

  const [form, setForm] = useState<ProductFormData>(INITIAL_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cats = await getActiveCategories();
      setCategories(cats);
      if (isEdit && productId) {
        const product = await getProductById(parseInt(productId));
        if (product) {
          setForm({
            sku: product.sku,
            name: product.name,
            category_id: product.category_id,
            buy_price: product.buy_price.toString(),
            sell_price: product.sell_price.toString(),
            discount: product.discount.toString(),
            fix_price: product.fix_price.toString(),
            stock: product.stock.toString(),
            picture: product.picture,
          });
        }
      } else {
        setForm({ ...INITIAL_FORM, sku: generateSKU() });
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: keyof ProductFormData, value: string | number | null) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-calculate fix_price = sell_price - discount
      if (key === 'sell_price' || key === 'discount') {
        const sell = parseFloat(key === 'sell_price' ? (value as string) : prev.sell_price) || 0;
        const disc = parseFloat(key === 'discount' ? (value as string) : prev.discount) || 0;
        next.fix_price = Math.max(0, sell - disc).toString();
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Nama produk wajib diisi' }); return;
    }
    if (!form.sku.trim()) {
      Toast.show({ type: 'error', text1: 'SKU wajib diisi' }); return;
    }
    if (!form.buy_price || !form.sell_price) {
      Toast.show({ type: 'error', text1: 'Harga beli & jual wajib diisi' }); return;
    }
    if (form.category_id === null) {
      Toast.show({ type: 'error', text1: 'Kategori wajib dipilih' }); return;
    }
    setSaving(true);
    try {
      if (isEdit && productId) {
        await updateProduct(parseInt(productId), form);
        Toast.show({ type: 'success', text1: 'Produk diperbarui!' });
      } else {
        await insertProduct(form);
        Toast.show({ type: 'success', text1: 'Produk ditambahkan!' });
      }
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Gagal menyimpan', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 30}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isEdit ? 'Edit Produk' : 'Tambah Produk'}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Simpan</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informasi Dasar</Text>
            {/* SKU */}
            <View style={styles.field}>
              <Text style={styles.label}>SKU <Text style={styles.required}>*</Text></Text>
              <View style={styles.skuRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={form.sku}
                  onChangeText={(v) => updateField('sku', v)}
                  placeholder="Masukkan atau generate SKU"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={() => updateField('sku', generateSKU(form.name))}
                >
                  <Ionicons name="refresh" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <InputField label="Nama Produk" value={form.name} onChangeText={(v: string) => updateField('name', v)} placeholder="Nama produk" required />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kategori <Text style={styles.required}>*</Text></Text>
            <View style={styles.catGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, form.category_id === cat.id && styles.catChipActive]}
                  onPress={() => updateField('category_id', cat.id)}
                >
                  <Text style={[styles.catChipText, form.category_id === cat.id && styles.catChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Harga & Stok</Text>
            <View style={styles.twoCol}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Harga Beli (Rp) <Text style={styles.required}>*</Text></Text>
                <TextInput style={styles.input} value={form.buy_price} onChangeText={(v) => updateField('buy_price', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Harga Jual (Rp) <Text style={styles.required}>*</Text></Text>
                <TextInput style={styles.input} value={form.sell_price} onChangeText={(v) => updateField('sell_price', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Diskon (Rp)</Text>
                <TextInput style={styles.input} value={form.discount} onChangeText={(v) => updateField('discount', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Harga Fix (Rp)</Text>
                <View style={[styles.input, styles.fixPrice]}>
                  <Text style={styles.fixPriceText}>Rp {parseFloat(form.fix_price || '0').toLocaleString('id-ID')}</Text>
                  <Text style={styles.autoCalc}>auto</Text>
                </View>
              </View>
            </View>
            <InputField label="Stok" value={form.stock} onChangeText={(v: string) => updateField('stock', v)} keyboardType="numeric" placeholder="0" />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, minWidth: 70, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
  scroll: { flex: 1 },
  section: { margin: Spacing.base, backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
  field: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600', marginBottom: Spacing.xs },
  required: { color: Colors.error },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    color: Colors.text, fontSize: Fonts.sizes.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  skuRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  generateBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  catChipTextActive: { color: Colors.white },
  addCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary + '44',
    backgroundColor: Colors.primary + '11',
  },
  addCatText: { color: Colors.primary, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  newCatRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },
  twoCol: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  halfField: { flex: 1 },
  fixPrice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fixPriceText: { color: Colors.accentGreen, fontWeight: '700' },
  autoCalc: { color: Colors.textMuted, fontSize: 10, backgroundColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
