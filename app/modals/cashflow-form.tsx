import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getDatabase } from '@/db/database';
import { insertCashflow, updateCashflow } from '@/db/cashflow';
import { CashflowFormData, CashflowType, Cashflow } from '@/types';
import Toast from 'react-native-toast-message';

const INITIAL: CashflowFormData = { type: 'INCOME', title: '', amount: '', notes: '' };

export default function CashflowFormModal() {
  const router = useRouter();
  const { cashflowId } = useLocalSearchParams<{ cashflowId?: string }>();
  const isEdit = !!cashflowId;

  const [form, setForm] = useState<CashflowFormData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && cashflowId) {
      setLoading(true);
      const db = getDatabase();
      db.getFirstAsync<Cashflow>('SELECT * FROM cashflow WHERE id = ?', [parseInt(cashflowId)])
        .then((c) => {
          if (c) setForm({ type: c.type, title: c.title, amount: c.amount.toString(), notes: c.notes ?? '' });
        })
        .finally(() => setLoading(false));
    }
  }, [cashflowId]);

  const handleSave = async () => {
    if (!form.title.trim()) { Toast.show({ type: 'error', text1: 'Judul wajib diisi' }); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { Toast.show({ type: 'error', text1: 'Jumlah harus lebih dari 0' }); return; }
    setSaving(true);
    try {
      if (isEdit && cashflowId) {
        await updateCashflow(parseInt(cashflowId), form);
        Toast.show({ type: 'success', text1: 'Entri diperbarui!' });
      } else {
        await insertCashflow(form);
        Toast.show({ type: 'success', text1: 'Entri ditambahkan!' });
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isEdit ? 'Edit Entri' : 'Tambah Entri'}</Text>
          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.saveBtnText}>Simpan</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll}>
          {/* Type Selector */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Jenis Entri</Text>
            <View style={styles.typeRow}>
              {(['INCOME', 'EXPENSE'] as CashflowType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, form.type === t && (t === 'INCOME' ? styles.typeBtnIncome : styles.typeBtnExpense)]}
                  onPress={() => setForm((p) => ({ ...p, type: t }))}
                >
                  <Ionicons
                    name={t === 'INCOME' ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={24}
                    color={form.type === t ? Colors.white : Colors.textMuted}
                  />
                  <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>
                    {t === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Detail</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Judul / Keterangan <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
                placeholder="Mis: Pembayaran listrik, Modal tambahan..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Jumlah (Rp) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Catatan (opsional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.notes}
                onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
                placeholder="Tambahkan catatan..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
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
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '800' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, minWidth: 70, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontWeight: '700', fontSize: Fonts.sizes.sm },
  scroll: { flex: 1 },
  card: { margin: Spacing.base, backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surfaceElevated,
    borderWidth: 2, borderColor: Colors.border,
  },
  typeBtnIncome: { backgroundColor: Colors.accentGreen, borderColor: Colors.accentGreen },
  typeBtnExpense: { backgroundColor: Colors.error, borderColor: Colors.error },
  typeBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Fonts.sizes.sm },
  typeBtnTextActive: { color: Colors.white },
  field: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600', marginBottom: Spacing.xs },
  required: { color: Colors.error },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    color: Colors.text, fontSize: Fonts.sizes.sm, borderWidth: 1, borderColor: Colors.border,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
});
