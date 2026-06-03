import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Fonts, Spacing, Radius, Shadow } from '@/constants/theme';
import { getActiveTransactions } from '@/db/transactions';
import { exportTransactionsToExcel } from '@/services/exportService';
import { Transaction } from '@/types';
import { formatIDR, formatDateTime } from '@/utils/currency';
import EmptyState from '@/components/EmptyState';
import Toast from 'react-native-toast-message';

interface CalendarDate {
  dateString: string; // YYYY-MM-DD
  dayNum: number;
  dayName: string;
  monthName: string;
}

type DateFilterType = 'all' | 'today' | 'week' | 'month' | 'custom';

export default function HistoryModal() {
  const router = useRouter();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [filteredTxns, setFilteredTxns] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DateFilterType>('all');
  
  // Date Range States
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Generate last 30 days for horizontal calendar picker
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

  // Helper to convert date to YYYY-MM-DD localized string
  const getLocalDateString = (dateObjOrStr: Date | string) => {
    const d = new Date(dateObjOrStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Filter application logic
  const applyFilters = useCallback((
    allTxns: Transaction[],
    search: string,
    type: DateFilterType,
    start: string | null,
    end: string | null
  ) => {
    let filtered = [...allTxns];

    // 1. Invoice Search Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((t) =>
        t.invoice_number.toLowerCase().includes(q)
      );
    }

    // 2. Date / Date Range Filter
    const now = new Date();
    if (type === 'today') {
      const todayStr = getLocalDateString(now);
      filtered = filtered.filter((t) => getLocalDateString(t.created_at) === todayStr);
    } else if (type === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0);
      filtered = filtered.filter((t) => new Date(t.created_at) >= oneWeekAgo);
    } else if (type === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      oneMonthAgo.setHours(0, 0, 0, 0);
      filtered = filtered.filter((t) => new Date(t.created_at) >= oneMonthAgo);
    } else if (type === 'custom' && start) {
      const startStr = start;
      const endStr = end || start;
      filtered = filtered.filter((t) => {
        const txnDateStr = getLocalDateString(t.created_at);
        return txnDateStr >= startStr && txnDateStr <= endStr;
      });
    }

    setFilteredTxns(filtered);
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const allTxns = await getActiveTransactions();
      setTxns(allTxns);
      applyFilters(allTxns, searchQuery, filterType, startDate, endDate);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filterType, startDate, endDate, applyFilters]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilters(txns, text, filterType, startDate, endDate);
  };

  const handleSelectFilterType = (type: DateFilterType) => {
    setFilterType(type);
    let startVal = startDate;
    let endVal = endDate;

    if (type === 'custom') {
      if (!startDate && calendarDates.length > 0) {
        // Auto select today as start date of range
        startVal = calendarDates[0].dateString;
        endVal = null;
        setStartDate(startVal);
        setEndDate(null);
      }
    } else {
      startVal = null;
      endVal = null;
      setStartDate(null);
      setEndDate(null);
    }

    applyFilters(txns, searchQuery, type, startVal, endVal);
  };

  const handleSelectCustomDate = (dateString: string) => {
    if (!startDate || (startDate && endDate)) {
      // Start a brand new date range selection
      setStartDate(dateString);
      setEndDate(null);
      applyFilters(txns, searchQuery, 'custom', dateString, null);
    } else {
      // Second tap defines range end
      const d1 = new Date(startDate);
      const d2 = new Date(dateString);

      if (d2 < d1) {
        // Automatically swap if end is chronologically before start
        setStartDate(dateString);
        setEndDate(startDate);
        applyFilters(txns, searchQuery, 'custom', dateString, startDate);
      } else {
        setEndDate(dateString);
        applyFilters(txns, searchQuery, 'custom', startDate, dateString);
      }
    }
  };

  const handleExportExcel = async () => {
    if (filteredTxns.length === 0) return;
    setExporting(true);
    try {
      await exportTransactionsToExcel(filteredTxns);
      Toast.show({
        type: 'success',
        text1: 'Ekspor Excel Berhasil!',
        text2: `Mengekspor ${filteredTxns.length} transaksi ke lembar kerja Excel.`,
      });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Ekspor Excel Gagal',
        text2: e.message,
      });
    } finally {
      setExporting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const handleOpenReceipt = (transactionId: number) => {
    router.push({
      pathname: '/modals/checkout',
      params: { transactionId: String(transactionId), fromHistory: 'true' },
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    return (
      <TouchableOpacity
        style={styles.txnCard}
        onPress={() => handleOpenReceipt(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.txnIconWrap}>
          <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
        </View>
        <View style={styles.txnInfo}>
          <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
          <Text style={styles.txnDate}>{formatDateTime(item.created_at)}</Text>
          <Text style={styles.txnItemsCount}>{item.total_items} item terjual</Text>
        </View>
        <View style={styles.txnRight}>
          <Text style={styles.grossAmount}>{formatIDR(item.gross_amount)}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={[
          styles.calDayName,
          isSelected && styles.calTextSelected,
          inRange && styles.calTextInRange,
        ]}>
          {item.dayName}
        </Text>
        <Text style={[
          styles.calDayNum,
          isSelected && styles.calTextSelected,
          inRange && styles.calTextInRange,
        ]}>
          {item.dayNum}
        </Text>
        <Text style={[
          styles.calMonth,
          isSelected && styles.calMonthSelected,
          inRange && styles.calTextInRange,
        ]}>
          {item.monthName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
          <Text style={styles.headerSubTitle}>Daftar transaksi penjualan sukses</Text>
        </View>

        {/* Excel Export Button */}
        <TouchableOpacity
          style={[styles.exportBtn, filteredTxns.length === 0 && styles.exportBtnDisabled]}
          onPress={handleExportExcel}
          disabled={filteredTxns.length === 0 || exporting}
          activeOpacity={0.7}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={Colors.accentGreen} />
          ) : (
            <>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={filteredTxns.length === 0 ? Colors.textMuted : Colors.accentGreen}
              />
              <Text style={[
                styles.exportBtnText,
                filteredTxns.length === 0 && styles.exportBtnTextDisabled,
              ]}>
                Ekspor Excel
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nomor invoice..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Tabs */}
        <FlatList
          data={[
            { type: 'all', label: 'Semua' },
            { type: 'today', label: 'Hari Ini' },
            { type: 'week', label: '7 Hari' },
            { type: 'month', label: '30 Hari' },
            { type: 'custom', label: 'Pilih Tanggal (Range)' },
          ]}
          keyExtractor={(item) => item.type}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
          renderItem={({ item }) => {
            const isTabActive = filterType === item.type;
            return (
              <TouchableOpacity
                style={[styles.tabBtn, isTabActive && styles.tabBtnActive]}
                onPress={() => handleSelectFilterType(item.type as DateFilterType)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isTabActive && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        {/* Horizontal Scrollable Calendar Date Range Picker */}
        {filterType === 'custom' && (
          <View style={styles.calendarWrap}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Pilih Range Tanggal</Text>
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
      </View>

      {/* Transactions List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredTxns}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTransaction}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          contentContainerStyle={filteredTxns.length === 0 ? styles.empty : styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Tidak ada transaksi"
              subtitle={
                searchQuery
                  ? "Coba cari dengan kata kunci atau nomor invoice lain"
                  : filterType === 'custom'
                  ? "Tidak ada transaksi tercatat pada range tanggal yang dipilih"
                  : "Belum ada transaksi berhasil yang tercatat"
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loader: { marginTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.base,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface, gap: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
  },
  headerTitleContainer: { flex: 1 },
  headerTitle: { color: Colors.text, fontSize: Fonts.sizes.md, fontWeight: '700' },
  headerSubTitle: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, marginTop: 2 },

  // Header Excel Export Button
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentGreen + '12',
    borderColor: Colors.accentGreen + '25',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: Spacing.xs,
  },
  exportBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.border,
  },
  exportBtnText: {
    color: Colors.accentGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  exportBtnTextDisabled: {
    color: Colors.textMuted,
  },

  // Filter Section Styles
  filterSection: {
    paddingTop: Spacing.base,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 44,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
    marginHorizontal: Spacing.base,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.sizes.sm },

  // Horizontal Tabs Styles
  tabsContainer: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    gap: Spacing.xs,
  },
  tabBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // Premium Calendar Slider Styles
  calendarWrap: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
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

  // Transactions List
  list: { padding: Spacing.base },
  empty: { flex: 1 },
  txnCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.sm,
  },
  txnIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary + '22', alignItems: 'center', justifyContent: 'center',
  },
  txnInfo: { flex: 1, marginLeft: Spacing.md },
  invoiceNumber: { color: Colors.text, fontSize: Fonts.sizes.sm, fontWeight: '700', fontFamily: 'monospace' },
  txnDate: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  txnItemsCount: { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  txnRight: { alignItems: 'flex-end', justifyContent: 'center' },
  grossAmount: { color: Colors.accentGreen, fontWeight: '800', fontSize: Fonts.sizes.sm },
});
