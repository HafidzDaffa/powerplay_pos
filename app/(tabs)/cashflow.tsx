import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveCashflows, softDeleteCashflow } from '@/db/cashflow';
import { Cashflow } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';
import EmptyState from '@/components/EmptyState';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from 'react-native-toast-message';

interface CalendarDate {
  dateString: string; // YYYY-MM-DD
  dayNum: number;
  dayName: string;
  monthName: string;
}

type DateFilterType = 'all' | 'today' | 'week' | 'month' | 'custom';

export default function CashflowScreen() {
  const router = useRouter();
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cashflow | null>(null);
  
  // Arus Kas Type Filter ('all' | 'INCOME' | 'EXPENSE')
  const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');

  // Date Range Filters
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Generate last 30 days for calendar scroller
  const calendarDates = useMemo<CalendarDate[]>(() => {
    const dates: CalendarDate[] = [];
    const today = new Date();
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      dates.push({
        dateString: `${yyyy}-${mm}-${dd}`,
        dayNum: d.getDate(),
        dayName: dayNames[d.getDay()],
        monthName: monthNames[d.getMonth()],
      });
    }
    return dates;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await getActiveCashflows();
      setCashflows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const getLocalDateString = (dateObjOrStr: Date | string) => {
    const d = new Date(dateObjOrStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // 1. First step of pipeline: Filter cashflows by Date
  const dateFilteredCashflows = useMemo(() => {
    let filtered = [...cashflows];
    const now = new Date();

    if (dateFilterType === 'today') {
      const todayStr = getLocalDateString(now);
      filtered = filtered.filter((c) => getLocalDateString(c.created_at) === todayStr);
    } else if (dateFilterType === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0);
      filtered = filtered.filter((c) => new Date(c.created_at) >= oneWeekAgo);
    } else if (dateFilterType === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      oneMonthAgo.setHours(0, 0, 0, 0);
      filtered = filtered.filter((c) => new Date(c.created_at) >= oneMonthAgo);
    } else if (dateFilterType === 'custom' && startDate) {
      const startStr = startDate;
      const endStr = endDate || startDate;
      filtered = filtered.filter((c) => {
        const cDateStr = getLocalDateString(c.created_at);
        return cDateStr >= startStr && cDateStr <= endStr;
      });
    }
    return filtered;
  }, [cashflows, dateFilterType, startDate, endDate]);

  // 2. Second step of pipeline: Calculate summaries based EXACTLY on date-filtered entries!
  const totalIncome = useMemo(() => {
    return dateFilteredCashflows
      .filter((c) => c.type === 'INCOME')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [dateFilteredCashflows]);

  const totalExpense = useMemo(() => {
    return dateFilteredCashflows
      .filter((c) => c.type === 'EXPENSE')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [dateFilteredCashflows]);

  const netFlow = totalIncome - totalExpense;

  // 3. Third step of pipeline: Filter by Type (INCOME / EXPENSE / ALL) for list rendering
  const finalFilteredList = useMemo(() => {
    return filter === 'all'
      ? dateFilteredCashflows
      : dateFilteredCashflows.filter((c) => c.type === filter);
  }, [dateFilteredCashflows, filter]);

  const handleSelectDateFilterType = (type: DateFilterType) => {
    setDateFilterType(type);
    if (type === 'custom') {
      if (!startDate && calendarDates.length > 0) {
        setStartDate(calendarDates[0].dateString);
        setEndDate(null);
      }
    } else {
      setStartDate(null);
      setEndDate(null);
    }
  };

  const handleSelectCustomDate = (dateString: string) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateString);
      setEndDate(null);
    } else {
      const d1 = new Date(startDate);
      const d2 = new Date(dateString);

      if (d2 < d1) {
        setStartDate(dateString);
        setEndDate(startDate);
      } else {
        setEndDate(dateString);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDeleteCashflow(deleteTarget.id);
      Toast.show({ type: 'success', text1: 'Entri Arus Kas berhasil dihapus!' });
      setDeleteTarget(null);
      loadData();
    } catch {
      Toast.show({ type: 'error', text1: 'Gagal menghapus entri' });
    }
  };

  const renderItem = ({ item }: { item: Cashflow }) => (
    <View style={styles.card}>
      <View style={[styles.typeIcon, { backgroundColor: item.type === 'INCOME' ? Colors.accentGreen + '22' : Colors.error + '22' }]}>
        <Ionicons
          name={item.type === 'INCOME' ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={22}
          color={item.type === 'INCOME' ? Colors.accentGreen : Colors.error}
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDate}>{formatDateTime(item.created_at)}</Text>
        {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.cardAmount, { color: item.type === 'INCOME' ? Colors.accentGreen : Colors.error }]}>
          {item.type === 'INCOME' ? '+' : '-'}{formatIDR(item.amount)}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/modals/cashflow-form', params: { cashflowId: item.id } })}
          >
            <Ionicons name="create-outline" size={16} color={Colors.accentOrange} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setDeleteTarget(item)}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCalendarItem = ({ item }: { item: CalendarDate }) => {
    const isStart = startDate === item.dateString;
    const isEnd = endDate === item.dateString;
    const isSelected = isStart || isEnd;
    const inRange = startDate && endDate && item.dateString > startDate && item.dateString < endDate;

    return (
      <TouchableOpacity
        style={[
          styles.calCard,
          isSelected && styles.calCardSelected,
          inRange && styles.calCardInRange,
        ]}
        onPress={() => handleSelectCustomDate(item.dateString)}
        activeOpacity={0.7}
      >
        <Text style={[styles.calDayName, isSelected && styles.calTextSelected, inRange && styles.calTextInRange]}>
          {item.dayName}
        </Text>
        <Text style={[styles.calDayNum, isSelected && styles.calTextSelected, inRange && styles.calTextInRange]}>
          {item.dayNum}
        </Text>
        <Text style={[styles.calMonth, isSelected && styles.calMonthSelected, inRange && styles.calTextInRange]}>
          {item.monthName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Arus Kas</Text>
          <Text style={styles.sub}>Pemasukan & pengeluaran operasional</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/modals/cashflow-form')}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Date Filter Tabs */}
      <View style={styles.dateTabsWrap}>
        <FlatList
          data={[
            { type: 'all', label: 'Semua' },
            { type: 'today', label: 'Hari Ini' },
            { type: 'week', label: '7 Hari' },
            { type: 'month', label: '30 Hari' },
            { type: 'custom', label: 'Range Tanggal' },
          ]}
          keyExtractor={(item) => item.type}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateTabsList}
          renderItem={({ item }) => {
            const isActive = dateFilterType === item.type;
            return (
              <TouchableOpacity
                style={[styles.dateTabBtn, isActive && styles.dateTabBtnActive]}
                onPress={() => handleSelectDateFilterType(item.type as DateFilterType)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateTabText, isActive && styles.dateTabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Custom Horizontal Date Range Picker */}
      {dateFilterType === 'custom' && (
        <View style={styles.calendarWrap}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Pilih Range Arus Kas</Text>
            <View style={styles.rangeBadgeContainer}>
              {startDate ? (
                <Text style={styles.selectedDateBadge}>
                  {startDate.split('-')[2]} {calendarDates.find(d => d.dateString === startDate)?.monthName}
                </Text>
              ) : (
                <Text style={styles.placeholderBadge}>Mulai</Text>
              )}
              <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} />
              {endDate ? (
                <Text style={styles.selectedDateBadge}>
                  {endDate.split('-')[2]} {calendarDates.find(d => d.dateString === endDate)?.monthName}
                </Text>
              ) : (
                <Text style={styles.placeholderBadge}>Selesai</Text>
              )}
            </View>
          </View>
          <FlatList
            data={calendarDates}
            keyExtractor={(item) => item.dateString}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={renderCalendarItem}
            contentContainerStyle={styles.calendarList}
          />
        </View>
      )}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.accentGreen }]}>
          <Text style={styles.summaryLabel}>Pemasukan</Text>
          <Text style={[styles.summaryValue, { color: Colors.accentGreen }]} numberOfLines={1}>
            {formatIDR(totalIncome)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.error }]}>
          <Text style={styles.summaryLabel}>Pengeluaran</Text>
          <Text style={[styles.summaryValue, { color: Colors.error }]} numberOfLines={1}>
            {formatIDR(totalExpense)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: netFlow >= 0 ? Colors.primary : Colors.error }]}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text style={[styles.summaryValue, { color: netFlow >= 0 ? Colors.primary : Colors.error }]} numberOfLines={1}>
            {netFlow >= 0 ? '+' : ''}{formatIDR(netFlow)}
          </Text>
        </View>
      </View>

      {/* Transaction Type Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'INCOME', 'EXPENSE'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Semua' : f === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cashflow List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={finalFilteredList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
          }
          contentContainerStyle={finalFilteredList.length === 0 ? styles.empty : styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title="Tidak ada entri"
              subtitle={
                dateFilterType === 'custom'
                  ? "Tidak ada entri arus kas pada range tanggal terpilih"
                  : "Ketuk + untuk menambah pemasukan atau pengeluaran"
              }
            />
          }
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="Hapus Entri Arus Kas?"
        message={`"${deleteTarget?.title}" akan dipindahkan ke Tempat Sampah.`}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base,
  },
  title: { color: Colors.text, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.primary, width: 44, height: 44,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },

  // Date Tabs Bar Styles
  dateTabsWrap: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
  },
  dateTabsList: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.xs,
  },
  dateTabBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateTabText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  dateTabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // Premium Calendar Slider Styles
  calendarWrap: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
  },
  calendarTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rangeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  selectedDateBadge: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  placeholderBadge: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  calendarList: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.xs,
  },
  calCard: {
    width: 60,
    height: 76,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...Shadow.sm,
  },
  calCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    transform: [{ scale: 1.02 }],
    ...Shadow.md,
  },
  calCardInRange: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary + '44',
  },
  calDayName: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calDayNum: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  calMonth: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  calMonthSelected: {
    color: Colors.white + 'CC',
  },
  calTextSelected: {
    color: Colors.white,
  },
  calTextInRange: {
    color: Colors.primary,
  },

  // Summary Row Styles
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  summaryCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, borderLeftWidth: 3, ...Shadow.sm,
  },
  summaryLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  summaryValue: { fontSize: Fonts.sizes.sm - 1, fontWeight: '800', marginTop: 4 },

  // Filter Bar Styles
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.base },
  filterBtn: {
    flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, fontWeight: '600' },
  filterTextActive: { color: Colors.white },

  // List Styles
  loader: { marginTop: 60 },
  list: { padding: Spacing.sm },
  empty: { flex: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.lg, marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, gap: Spacing.md,
  },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700' },
  cardDate: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  cardNotes: { color: Colors.textSecondary, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', gap: Spacing.sm },
  cardAmount: { fontSize: Fonts.sizes.sm, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: {
    width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
});
